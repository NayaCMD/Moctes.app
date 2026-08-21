import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

export interface StoredObjectMetadata {
  size: number;
  mimeType: string | null;
}

export interface StoredObjectSummary {
  key: string;
  lastModified: Date | null;
  size: number;
}

export interface WriteObjectOptions {
  cacheControl?: string;
}

@Injectable()
export class ObjectStorageService {
  private readonly bucket: string;
  private readonly uploadExpiresInSeconds: number;
  private readonly downloadExpiresInSeconds: number;
  private readonly autoCreateBucket: boolean;
  private readonly internalClient: S3Client;
  private readonly signingClient: S3Client;
  private bucketReady: Promise<void> | null = null;

  constructor(config: ConfigService) {
    const region = config.get<string>('OBJECT_STORAGE_REGION') ?? 'us-east-1';
    const endpoint =
      config.get<string>('OBJECT_STORAGE_ENDPOINT') ?? 'http://localhost:9000';
    const publicEndpoint =
      config.get<string>('OBJECT_STORAGE_PUBLIC_ENDPOINT') ?? endpoint;
    const accessKeyId =
      config.get<string>('OBJECT_STORAGE_ACCESS_KEY') ?? 'moctes';
    const secretAccessKey =
      config.get<string>('OBJECT_STORAGE_SECRET_KEY') ?? 'moctes-development';
    const credentials = { accessKeyId, secretAccessKey };
    const common = {
      region,
      credentials,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
    };

    this.bucket =
      config.get<string>('OBJECT_STORAGE_BUCKET') ?? 'moctes-assets';
    this.uploadExpiresInSeconds = readPositiveInteger(
      config.get<string>('OBJECT_STORAGE_UPLOAD_EXPIRES_SECONDS'),
      300,
    );
    this.downloadExpiresInSeconds = readPositiveInteger(
      config.get<string>('OBJECT_STORAGE_DOWNLOAD_EXPIRES_SECONDS'),
      43_200,
    );
    const autoCreateBucket = config.get<string>(
      'OBJECT_STORAGE_AUTO_CREATE_BUCKET',
    );
    this.autoCreateBucket = autoCreateBucket
      ? autoCreateBucket === 'true'
      : isLocalEndpoint(endpoint);
    this.internalClient = new S3Client({ ...common, endpoint });
    this.signingClient = new S3Client({ ...common, endpoint: publicEndpoint });
  }

  async checkHealth(): Promise<void> {
    await this.ensureBucket();
    await this.internalClient.send(
      new HeadBucketCommand({ Bucket: this.bucket }),
    );
  }

  async createUploadUrl(
    objectKey: string,
    mimeType: string,
    size: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    await this.ensureBucket();
    const expiresAt = new Date(
      Date.now() + this.uploadExpiresInSeconds * 1_000,
    );
    const url = await getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: mimeType,
        ContentLength: size,
      }),
      { expiresIn: this.uploadExpiresInSeconds },
    );
    return { url, expiresAt };
  }

  async createDownloadUrl(
    objectKey: string,
    filename: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    await this.ensureBucket();
    const expiresAt = new Date(
      Date.now() + this.downloadExpiresInSeconds * 1_000,
    );
    const encodedFilename = encodeURIComponent(safeDownloadFilename(filename));
    const url = await getSignedUrl(
      this.signingClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodedFilename}`,
      }),
      { expiresIn: this.downloadExpiresInSeconds },
    );
    return { url, expiresAt };
  }

  async inspectObject(objectKey: string): Promise<StoredObjectMetadata | null> {
    await this.ensureBucket();
    try {
      const result = await this.internalClient.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        size: result.ContentLength ?? 0,
        mimeType:
          result.ContentType?.split(';')[0]?.trim().toLowerCase() ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async readObject(objectKey: string, maximumBytes: number): Promise<Buffer> {
    await this.ensureBucket();
    const result = await this.internalClient.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    if (!result.Body) {
      throw new Error(`Object ${objectKey} has no readable body.`);
    }
    if (!(result.Body instanceof Readable)) {
      throw new Error(`Object ${objectKey} did not return a Node.js stream.`);
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const value of result.Body) {
      const chunk = toBuffer(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maximumBytes) {
        throw new Error(`Object ${objectKey} exceeds the processing limit.`);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, totalBytes);
  }

  async writeObject(
    objectKey: string,
    body: Buffer,
    mimeType: string,
    options: WriteObjectOptions = {},
  ): Promise<void> {
    await this.ensureBucket();
    await this.internalClient.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: mimeType,
        ContentLength: body.byteLength,
        CacheControl: options.cacheControl,
      }),
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.ensureBucket();
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }

  async listObjects(
    prefix: string,
    maxObjects = 1_000,
    startAfter?: string,
  ): Promise<StoredObjectSummary[]> {
    await this.ensureBucket();
    const objects: StoredObjectSummary[] = [];
    let continuationToken: string | undefined;
    do {
      const remaining = maxObjects - objects.length;
      if (remaining <= 0) {
        break;
      }
      const result = await this.internalClient.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          StartAfter: continuationToken ? undefined : startAfter,
          ContinuationToken: continuationToken,
          MaxKeys: Math.min(remaining, 1_000),
        }),
      );
      for (const object of result.Contents ?? []) {
        if (!object.Key) {
          continue;
        }
        objects.push({
          key: object.Key,
          lastModified: object.LastModified ?? null,
          size: object.Size ?? 0,
        });
      }
      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);
    return objects;
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= this.prepareBucket().catch((error: unknown) => {
      this.bucketReady = null;
      throw error;
    });
    return this.bucketReady;
  }

  private async prepareBucket(): Promise<void> {
    try {
      await this.internalClient.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
      );
    } catch (error) {
      if (!this.autoCreateBucket || !isNotFound(error)) {
        throw error;
      }
      try {
        await this.internalClient.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
      } catch (createError) {
        if (!isAlreadyOwned(createError)) {
          throw createError;
        }
      }
    }
  }
}

function toBuffer(value: unknown): Buffer {
  if (typeof value === 'string') {
    return Buffer.from(value);
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  throw new Error('Object storage returned an unsupported stream chunk.');
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isLocalEndpoint(endpoint: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(
      new URL(endpoint).hostname,
    );
  } catch {
    return false;
  }
}

function isNotFound(error: unknown): boolean {
  return readErrorName(error) === 'NotFound' || readStatusCode(error) === 404;
}

function isAlreadyOwned(error: unknown): boolean {
  return ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(
    readErrorName(error),
  );
}

function readErrorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';
}

function readStatusCode(error: unknown): number | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('$metadata' in error) ||
    typeof error.$metadata !== 'object' ||
    error.$metadata === null ||
    !('httpStatusCode' in error.$metadata)
  ) {
    return undefined;
  }
  const value = error.$metadata.httpStatusCode;
  return typeof value === 'number' ? value : undefined;
}

function safeDownloadFilename(filename: string): string {
  return (
    filename
      .replace(/[\r\n\\/]/g, '-')
      .split('')
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim()
      .slice(0, 180) || 'asset'
  );
}
