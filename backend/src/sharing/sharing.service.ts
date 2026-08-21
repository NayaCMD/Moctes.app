import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AssetStatus, Prisma } from '@prisma/client';
import { PoliciesService } from '../authorization/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { ObjectStorageService } from '../object-storage/object-storage.service';

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly storage: ObjectStorageService,
  ) {}

  async list(userId: string, documentId: string) {
    await this.policies.assertDocumentPermission(
      userId,
      documentId,
      'document:share',
    );
    const links = await this.prisma.documentShareLink.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return links.map(toShareLinkResponse);
  }

  async create(userId: string, documentId: string, dto: CreateShareLinkDto) {
    await this.policies.assertDocumentPermission(
      userId,
      documentId,
      'document:share',
    );
    const token = randomBytes(32).toString('base64url');
    const link = await this.prisma.documentShareLink.create({
      data: {
        documentId,
        createdById: userId,
        tokenHash: hashToken(token),
        expiresAt: dto.expiresInDays
          ? new Date(Date.now() + dto.expiresInDays * 86_400_000)
          : null,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return { ...toShareLinkResponse(link), token };
  }

  async revoke(userId: string, documentId: string, linkId: string) {
    await this.policies.assertDocumentPermission(
      userId,
      documentId,
      'document:share',
    );
    const result = await this.prisma.documentShareLink.updateMany({
      where: { id: linkId, documentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Share link was not found or is revoked.');
    }
  }

  async resolvePublicLink(token: string) {
    if (token.length < 32 || token.length > 128) {
      throw new ForbiddenException('Invalid share link.');
    }
    const link = await this.prisma.documentShareLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { document: true },
    });
    if (!link || link.revokedAt || link.document.deletedAt) {
      throw new NotFoundException('Share link was not found.');
    }
    if (link.expiresAt && link.expiresAt <= new Date()) {
      throw new GoneException('Share link has expired.');
    }
    void this.prisma.documentShareLink
      .update({ where: { id: link.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    const publicDocument = await this.withPublicAssetUrls(
      link.document.workspaceId,
      link.document.content,
    );
    return {
      access: 'READ_ONLY' as const,
      documentId: link.document.id,
      document: publicDocument,
      updatedAt: link.document.updatedAt.toISOString(),
    };
  }

  private async withPublicAssetUrls(
    workspaceId: string,
    content: Prisma.JsonValue,
  ): Promise<Prisma.JsonValue> {
    const assetIds = new Set<string>();
    visitRecords(content, (record) => {
      if (typeof record.assetId === 'string') assetIds.add(record.assetId);
    });
    if (assetIds.size === 0) return content;
    const assets = await this.prisma.asset.findMany({
      where: {
        workspaceId,
        id: { in: [...assetIds] },
        status: AssetStatus.READY,
      },
      select: { id: true, objectKey: true, originalFilename: true },
    });
    const urls = new Map(
      await Promise.all(
        assets.map(
          async (asset) =>
            [
              asset.id,
              (
                await this.storage.createDownloadUrl(
                  asset.objectKey,
                  asset.originalFilename,
                )
              ).url,
            ] as const,
        ),
      ),
    );
    const clone = structuredClone(content);
    visitRecords(clone, (record) => {
      if (typeof record.assetId === 'string') {
        const url = urls.get(record.assetId);
        if (url) record.src = url;
      }
    });
    return clone;
  }
}

function visitRecords(
  value: Prisma.JsonValue,
  visit: (record: Record<string, Prisma.JsonValue>) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => visitRecords(item, visit));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const record = value as Record<string, Prisma.JsonValue>;
  visit(record);
  Object.values(record).forEach((item) => visitRecords(item, visit));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toShareLinkResponse(link: {
  id: string;
  documentId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  createdBy: { id: string; name: string };
}) {
  return {
    id: link.id,
    documentId: link.documentId,
    access: 'READ_ONLY' as const,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    createdBy: link.createdBy,
  };
}
