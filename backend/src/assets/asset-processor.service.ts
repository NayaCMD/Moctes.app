import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssetStatus,
  AssetVariantKind,
  Prisma,
  type Asset,
} from '@prisma/client';
import sharp from 'sharp';
import { ObjectStorageService } from '../object-storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClamAvService } from './clamav.service';
import { SvgSanitizerService, UnsafeSvgError } from './svg-sanitizer.service';

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_PIXELS = 40_000_000;
const DEFAULT_MAX_DIMENSION = 16_384;

type FailureDisposition = 'rejected' | 'quarantined';

export class AssetProcessingError extends Error {
  constructor(
    readonly disposition: FailureDisposition,
    readonly code: string,
    readonly publicMessage: string,
    message = publicMessage,
  ) {
    super(message);
    this.name = 'AssetProcessingError';
  }
}

interface GeneratedVariant {
  kind: AssetVariantKind;
  objectKey: string;
  mimeType: string;
  body: Buffer;
  width: number;
  height: number;
}

export interface AssetProcessingResult {
  assetId: string;
  detectedMimeType: string;
  width: number;
  height: number;
  storageBytes: number;
}

@Injectable()
export class AssetProcessorService {
  private readonly logger = new Logger(AssetProcessorService.name);
  private readonly maxPixels: number;
  private readonly maxDimension: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly antivirus: ClamAvService,
    private readonly svgSanitizer: SvgSanitizerService,
  ) {
    this.maxPixels = positiveInteger(
      config.get<string>('ASSET_MAX_INPUT_PIXELS'),
      DEFAULT_MAX_PIXELS,
    );
    this.maxDimension = positiveInteger(
      config.get<string>('ASSET_MAX_INPUT_DIMENSION'),
      DEFAULT_MAX_DIMENSION,
    );
  }

  async process(assetId: string): Promise<AssetProcessingResult | null> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset || asset.status === AssetStatus.READY) {
      return null;
    }
    if (asset.status !== AssetStatus.PROCESSING || !asset.sourceObjectKey) {
      throw new AssetProcessingError(
        'rejected',
        'INVALID_PROCESSING_STATE',
        'O arquivo não está em um estado válido para processamento.',
      );
    }

    const source = await this.storage.readObject(
      asset.sourceObjectKey,
      Math.min(MAX_SOURCE_BYTES, asset.sourceSize) + 1,
    );
    if (source.byteLength !== asset.sourceSize) {
      throw new AssetProcessingError(
        'rejected',
        'SOURCE_SIZE_MISMATCH',
        'O tamanho real do arquivo é diferente do upload declarado.',
      );
    }

    const detectedMimeType = detectImageMimeType(source);
    if (!detectedMimeType || detectedMimeType !== asset.sourceMimeType) {
      throw new AssetProcessingError(
        'rejected',
        'SOURCE_TYPE_MISMATCH',
        'O conteúdo do arquivo não corresponde ao tipo de imagem informado.',
      );
    }

    const scan = await this.antivirus.scan(source);
    if (scan.status === 'infected') {
      this.logger.warn(
        JSON.stringify({
          event: 'asset.malware_detected',
          assetId,
          workspaceId: asset.workspaceId,
          signature: scan.signature,
        }),
      );
      throw new AssetProcessingError(
        'quarantined',
        'MALWARE_DETECTED',
        'O arquivo foi isolado porque o antivírus detectou conteúdo suspeito.',
      );
    }

    let safeSource = source;
    if (detectedMimeType === 'image/svg+xml') {
      try {
        safeSource = this.svgSanitizer.sanitize(source);
      } catch (error) {
        if (error instanceof UnsafeSvgError) {
          throw new AssetProcessingError(
            'rejected',
            'UNSAFE_SVG',
            'O SVG contém recursos não permitidos.',
            error.message,
          );
        }
        throw error;
      }
    }

    const metadata = await readImageMetadata(safeSource, this.maxPixels);
    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;
    const pages = metadata.pages ?? 1;
    if (
      width < 1 ||
      height < 1 ||
      width > this.maxDimension ||
      height > this.maxDimension ||
      width * height * pages > this.maxPixels
    ) {
      throw new AssetProcessingError(
        'rejected',
        'UNSAFE_IMAGE_DIMENSIONS',
        'As dimensões da imagem são inválidas ou excedem o limite seguro.',
      );
    }

    const variants = await generateVariants(
      safeSource,
      asset.workspaceId,
      asset.id,
      this.maxPixels,
      detectedMimeType === 'image/gif' && pages > 1,
    );
    const primary =
      detectedMimeType === 'image/svg+xml'
        ? {
            objectKey: `assets/${asset.workspaceId}/${asset.id}/original.svg`,
            mimeType: 'image/svg+xml',
            body: safeSource,
            width,
            height,
          }
        : (() => {
            const display = variants.find(
              (variant) => variant.kind === AssetVariantKind.DISPLAY_WEBP,
            );
            if (!display) {
              throw new Error('The display WebP variant was not generated.');
            }
            return display;
          })();

    const writes = uniqueWrites([
      ...variants,
      {
        kind: AssetVariantKind.DISPLAY_WEBP,
        ...primary,
      },
    ]);
    try {
      await Promise.all(
        writes.map((output) =>
          this.storage.writeObject(
            output.objectKey,
            output.body,
            output.mimeType,
            { cacheControl: 'private, max-age=31536000, immutable' },
          ),
        ),
      );
      const storageBytes = writes.reduce(
        (total, output) => total + output.body.byteLength,
        0,
      );
      await this.commitProcessedAsset(
        asset,
        detectedMimeType,
        width,
        height,
        primary,
        variants,
        storageBytes,
      );

      await this.storage.deleteObject(asset.sourceObjectKey).catch((error) => {
        this.logger.warn(
          JSON.stringify({
            event: 'asset.source_cleanup_failed',
            assetId,
            objectKey: asset.sourceObjectKey,
            error: errorMessage(error),
          }),
        );
      });
      return { assetId, detectedMimeType, width, height, storageBytes };
    } catch (error) {
      await Promise.allSettled(
        writes.map((output) => this.storage.deleteObject(output.objectKey)),
      );
      throw error;
    }
  }

  async markFailed(
    assetId: string,
    status: typeof AssetStatus.REJECTED | typeof AssetStatus.QUARANTINED,
    code: string,
    message: string,
  ): Promise<void> {
    const result = await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const asset = await transaction.asset.findUnique({
            where: { id: assetId },
          });
          if (!asset || asset.status !== AssetStatus.PROCESSING) {
            return null;
          }
          const releaseBytes =
            status === AssetStatus.REJECTED ? asset.storageBytes : 0;
          await transaction.asset.update({
            where: { id: assetId },
            data: {
              status,
              processingErrorCode: code,
              processingErrorMessage: message.slice(0, 500),
              processedAt: new Date(),
              storageBytes:
                status === AssetStatus.REJECTED ? 0 : asset.storageBytes,
              sourceObjectKey:
                status === AssetStatus.REJECTED ? null : asset.sourceObjectKey,
            },
          });
          if (releaseBytes > 0) {
            await transaction.workspace.update({
              where: { id: asset.workspaceId },
              data: { storageUsedBytes: { decrement: releaseBytes } },
            });
          }
          return status === AssetStatus.REJECTED ? asset.sourceObjectKey : null;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    if (result) {
      await this.storage.deleteObject(result).catch(() => undefined);
    }
  }

  private async commitProcessedAsset(
    asset: Asset,
    detectedMimeType: string,
    width: number,
    height: number,
    primary: {
      objectKey: string;
      mimeType: string;
      body: Buffer;
    },
    variants: GeneratedVariant[],
    storageBytes: number,
  ): Promise<void> {
    await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.asset.findUnique({
            where: { id: asset.id },
          });
          if (!current || current.status !== AssetStatus.PROCESSING) {
            throw new Error('The asset is no longer available for processing.');
          }
          const workspace = await transaction.workspace.findUniqueOrThrow({
            where: { id: asset.workspaceId },
            select: { storageUsedBytes: true, storageLimitBytes: true },
          });
          const delta = storageBytes - current.storageBytes;
          if (
            workspace.storageUsedBytes + delta >
            workspace.storageLimitBytes
          ) {
            throw new AssetProcessingError(
              'rejected',
              'PROCESSED_ASSET_QUOTA_EXCEEDED',
              'As versões processadas da imagem excederiam a cota do workspace.',
            );
          }

          await transaction.assetVariant.deleteMany({
            where: { assetId: asset.id },
          });
          await transaction.assetVariant.createMany({
            data: variants.map((variant) => ({
              assetId: asset.id,
              kind: variant.kind,
              objectKey: variant.objectKey,
              mimeType: variant.mimeType,
              size: variant.body.byteLength,
              width: variant.width,
              height: variant.height,
            })),
          });
          await transaction.asset.update({
            where: { id: asset.id },
            data: {
              objectKey: primary.objectKey,
              sourceObjectKey: null,
              mimeType: primary.mimeType,
              detectedMimeType,
              size: primary.body.byteLength,
              storageBytes,
              width,
              height,
              status: AssetStatus.READY,
              processingErrorCode: null,
              processingErrorMessage: null,
              processedAt: new Date(),
            },
          });
          if (delta !== 0) {
            await transaction.workspace.update({
              where: { id: asset.workspaceId },
              data: { storageUsedBytes: { increment: delta } },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
}

export function detectImageMimeType(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  const header = buffer.subarray(0, 12).toString('ascii');
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) {
    return 'image/gif';
  }
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  const start = buffer
    .subarray(0, Math.min(buffer.length, 4_096))
    .toString('utf8');
  if (
    /^\uFEFF?\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*<svg(?:\s|>)/i.test(
      start,
    )
  ) {
    return 'image/svg+xml';
  }
  return null;
}

async function readImageMetadata(buffer: Buffer, maxPixels: number) {
  try {
    return await sharp(buffer, {
      failOn: 'warning',
      limitInputPixels: maxPixels,
      pages: 1,
    }).metadata();
  } catch (error) {
    throw new AssetProcessingError(
      'rejected',
      'IMAGE_DECODE_FAILED',
      'A imagem está corrompida ou não pode ser processada com segurança.',
      errorMessage(error),
    );
  }
}

async function generateVariants(
  buffer: Buffer,
  workspaceId: string,
  assetId: string,
  maxPixels: number,
  animatedWebp: boolean,
): Promise<GeneratedVariant[]> {
  const specs = [
    {
      kind: AssetVariantKind.DISPLAY_WEBP,
      mimeType: 'image/webp',
      extension: 'webp',
      maximum: 4_096,
    },
    {
      kind: AssetVariantKind.DISPLAY_AVIF,
      mimeType: 'image/avif',
      extension: 'avif',
      maximum: 4_096,
    },
    {
      kind: AssetVariantKind.THUMBNAIL_WEBP,
      mimeType: 'image/webp',
      extension: 'webp',
      maximum: 512,
    },
    {
      kind: AssetVariantKind.THUMBNAIL_AVIF,
      mimeType: 'image/avif',
      extension: 'avif',
      maximum: 512,
    },
  ] as const;

  try {
    const variants: GeneratedVariant[] = [];
    for (const spec of specs) {
      let pipeline = sharp(buffer, {
        failOn: 'warning',
        limitInputPixels: maxPixels,
        ...(animatedWebp && spec.mimeType === 'image/webp'
          ? { animated: true }
          : { pages: 1 }),
      })
        .rotate()
        .resize({
          width: spec.maximum,
          height: spec.maximum,
          fit: 'inside',
          withoutEnlargement: true,
        });
      pipeline =
        spec.mimeType === 'image/webp'
          ? pipeline.webp({ quality: 84, effort: 4 })
          : pipeline.avif({ quality: 55, effort: 4 });
      const generated = await pipeline.toBuffer({ resolveWithObject: true });
      variants.push({
        kind: spec.kind,
        objectKey: `assets/${workspaceId}/${assetId}/${spec.kind.toLowerCase()}.${spec.extension}`,
        mimeType: spec.mimeType,
        body: generated.data,
        width: generated.info.width,
        height: generated.info.pageHeight ?? generated.info.height,
      });
    }
    return variants;
  } catch (error) {
    throw new AssetProcessingError(
      'rejected',
      'IMAGE_CONVERSION_FAILED',
      'Não foi possível gerar versões seguras desta imagem.',
      errorMessage(error),
    );
  }
}

function uniqueWrites<T extends { objectKey: string }>(outputs: T[]): T[] {
  return [
    ...new Map(outputs.map((output) => [output.objectKey, output])).values(),
  ];
}

async function retrySerializableTransaction<T>(
  action: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt === 3
      ) {
        throw error;
      }
    }
  }
  throw new Error('The asset processing transaction could not be completed.');
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
