import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PoliciesService } from '../authorization/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CollaborationBroadcaster } from '../collaboration/collaboration-broadcaster.service';
import { assertValidDocumentPayload } from './document-schema.validator';

export interface PersistedDocumentResponse {
  id: string;
  workspaceId: string;
  version: number;
  collaborationSequence: number;
  document: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DocumentRevisionSummaryResponse {
  id: string;
  version: number;
  title: string;
  schemaVersion: number;
  restoredFromVersion: number | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface DocumentRevisionListResponse {
  documentId: string;
  currentVersion: number;
  revisions: DocumentRevisionSummaryResponse[];
}

export interface DocumentRevisionResponse extends DocumentRevisionSummaryResponse {
  documentId: string;
  document: Prisma.JsonValue;
}

const RETAINED_REVISIONS = 100;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly collaboration: CollaborationBroadcaster,
  ) {}

  async findAll(
    userId: string,
    workspaceId: string,
  ): Promise<PersistedDocumentResponse[]> {
    await this.policies.assertWorkspacePermission(
      userId,
      workspaceId,
      'document:read',
    );
    const documents = await this.prisma.document.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return documents.map(toResponse);
  }

  async findDeleted(
    userId: string,
    workspaceId: string,
  ): Promise<PersistedDocumentResponse[]> {
    await this.policies.assertWorkspacePermission(
      userId,
      workspaceId,
      'document:read',
    );
    const documents = await this.prisma.document.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
    return documents.map(toResponse);
  }

  async findOne(
    userId: string,
    id: string,
  ): Promise<PersistedDocumentResponse> {
    await this.policies.assertDocumentPermission(userId, id, 'document:read');
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document ${id} was not found.`);
    }
    return toResponse(document);
  }

  async create(
    userId: string,
    dto: CreateDocumentDto,
  ): Promise<PersistedDocumentResponse> {
    await this.policies.assertWorkspacePermission(
      userId,
      dto.workspaceId,
      'document:create',
    );
    assertValidDocumentPayload(dto.id, dto.document);
    const title = readRequiredString(dto.document, 'title');
    const type = readRequiredString(dto.document, 'type');
    const schemaVersion = readSchemaVersion(dto.document);
    if (
      dto.title !== title ||
      dto.type !== type ||
      (dto.schemaVersion !== undefined && dto.schemaVersion !== schemaVersion)
    ) {
      throw new BadRequestException(
        'Document metadata must match the canonical document payload.',
      );
    }
    try {
      const document = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.document.create({
          data: {
            id: dto.id,
            workspaceId: dto.workspaceId,
            title,
            type,
            schemaVersion,
            content: dto.document as Prisma.InputJsonValue,
          },
        });
        await createRevision(transaction, created, userId);
        return created;
      });
      const response = toResponse(document);
      this.collaboration.publishSnapshot(document.id, response);
      return response;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(`Document ${dto.id} already exists.`);
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDocumentDto,
  ): Promise<PersistedDocumentResponse> {
    const access = await this.policies.assertDocumentPermission(
      userId,
      id,
      'document:update',
    );
    assertValidDocumentPayload(id, dto.document);
    const title = readRequiredString(dto.document, 'title');
    const type = readRequiredString(dto.document, 'type');
    const schemaVersion = readSchemaVersion(dto.document);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.document.updateMany({
        where: {
          id,
          workspaceId: access.workspaceId,
          deletedAt: null,
          version: dto.expectedVersion,
          collaborationSequence: dto.expectedCollaborationSequence,
        },
        data: {
          title,
          type,
          schemaVersion,
          content: dto.document as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        await throwDocumentVersionError(
          transaction,
          id,
          dto.expectedVersion,
          dto.expectedCollaborationSequence,
        );
      }
      const document = await transaction.document.findUnique({ where: { id } });
      if (!document) {
        throw new NotFoundException(`Document ${id} was not found.`);
      }
      await createRevision(transaction, document, userId);
      return document;
    });
    const response = toResponse(updated);
    this.collaboration.publishSnapshot(id, response);
    return response;
  }

  async listRevisions(
    userId: string,
    id: string,
  ): Promise<DocumentRevisionListResponse> {
    await this.policies.assertDocumentPermission(userId, id, 'document:read');
    const [document, revisions] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id },
        select: { version: true },
      }),
      this.prisma.documentRevision.findMany({
        where: { documentId: id },
        orderBy: { version: 'desc' },
        take: 100,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
    ]);
    if (!document) {
      throw new NotFoundException(`Document ${id} was not found.`);
    }
    return {
      documentId: id,
      currentVersion: document.version,
      revisions: revisions.map(toRevisionSummary),
    };
  }

  async findRevision(
    userId: string,
    id: string,
    version: number,
  ): Promise<DocumentRevisionResponse> {
    await this.policies.assertDocumentPermission(userId, id, 'document:read');
    const revision = await this.prisma.documentRevision.findUnique({
      where: { documentId_version: { documentId: id, version } },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!revision) {
      throw new NotFoundException(
        `Revision ${version} of document ${id} was not found.`,
      );
    }
    return {
      ...toRevisionSummary(revision),
      documentId: revision.documentId,
      document: revision.content,
    };
  }

  async restoreRevision(
    userId: string,
    id: string,
    version: number,
    expectedVersion: number,
    expectedCollaborationSequence: number,
  ): Promise<PersistedDocumentResponse> {
    const access = await this.policies.assertDocumentPermission(
      userId,
      id,
      'document:update',
    );
    const restored = await this.prisma.$transaction(async (transaction) => {
      const revision = await transaction.documentRevision.findUnique({
        where: { documentId_version: { documentId: id, version } },
      });
      if (!revision) {
        throw new NotFoundException(
          `Revision ${version} of document ${id} was not found.`,
        );
      }
      const revisionDocument = revision.content as Record<string, unknown>;
      assertValidDocumentPayload(id, revisionDocument);
      const type = readRequiredString(revisionDocument, 'type');
      const result = await transaction.document.updateMany({
        where: {
          id,
          workspaceId: access.workspaceId,
          version: expectedVersion,
          collaborationSequence: expectedCollaborationSequence,
        },
        data: {
          title: revision.title,
          type,
          schemaVersion: revision.schemaVersion,
          content: revision.content as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        await throwDocumentVersionError(
          transaction,
          id,
          expectedVersion,
          expectedCollaborationSequence,
        );
      }
      const document = await transaction.document.findUnique({ where: { id } });
      if (!document) {
        throw new NotFoundException(`Document ${id} was not found.`);
      }
      await createRevision(transaction, document, userId, version);
      return document;
    });
    const response = toResponse(restored);
    this.collaboration.publishSnapshot(id, response);
    return response;
  }

  async remove(userId: string, id: string): Promise<void> {
    const access = await this.policies.assertDocumentPermission(
      userId,
      id,
      'document:delete',
    );
    const result = await this.prisma.$transaction(async (transaction) => {
      const activeCount = await transaction.document.count({
        where: { workspaceId: access.workspaceId, deletedAt: null },
      });
      if (activeCount <= 1) {
        throw new ConflictException(
          'A workspace must keep at least one active document.',
        );
      }
      return transaction.document.updateMany({
        where: { id, workspaceId: access.workspaceId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    });
    if (result.count === 0) {
      throw new NotFoundException(`Document ${id} was not found.`);
    }
    this.collaboration.publishDeleted(id);
  }

  async restoreDeleted(
    userId: string,
    id: string,
    workspaceId: string,
  ): Promise<PersistedDocumentResponse> {
    await this.policies.assertWorkspacePermission(
      userId,
      workspaceId,
      'document:update',
    );
    const restored = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.document.updateMany({
        where: { id, workspaceId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      if (result.count === 0) {
        throw new NotFoundException(`Deleted document ${id} was not found.`);
      }
      return transaction.document.findUniqueOrThrow({ where: { id } });
    });
    const response = toResponse(restored);
    this.collaboration.publishSnapshot(id, response);
    return response;
  }
}

function toResponse(document: {
  id: string;
  workspaceId: string;
  version: number;
  collaborationSequence: number;
  content: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): PersistedDocumentResponse {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    version: document.version,
    collaborationSequence: document.collaborationSequence,
    document: document.content,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    deletedAt: document.deletedAt?.toISOString() ?? null,
  };
}

function toRevisionSummary(revision: {
  id: string;
  version: number;
  title: string;
  schemaVersion: number;
  restoredFromVersion: number | null;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
}): DocumentRevisionSummaryResponse {
  return {
    id: revision.id,
    version: revision.version,
    title: revision.title,
    schemaVersion: revision.schemaVersion,
    restoredFromVersion: revision.restoredFromVersion,
    createdAt: revision.createdAt.toISOString(),
    createdBy: revision.createdBy,
  };
}

async function createRevision(
  transaction: Prisma.TransactionClient,
  document: {
    id: string;
    version: number;
    title: string;
    schemaVersion: number;
    content: Prisma.JsonValue;
  },
  userId: string,
  restoredFromVersion?: number,
): Promise<void> {
  await transaction.documentRevision.create({
    data: {
      documentId: document.id,
      version: document.version,
      title: document.title,
      schemaVersion: document.schemaVersion,
      content: document.content as Prisma.InputJsonValue,
      createdById: userId,
      restoredFromVersion,
    },
  });
  const retentionThreshold = document.version - RETAINED_REVISIONS;
  if (retentionThreshold > 0) {
    await transaction.documentRevision.deleteMany({
      where: {
        documentId: document.id,
        version: { lte: retentionThreshold },
      },
    });
  }
}

async function throwDocumentVersionError(
  transaction: Prisma.TransactionClient,
  id: string,
  expectedVersion: number,
  expectedCollaborationSequence: number,
): Promise<never> {
  const existing = await transaction.document.findUnique({
    where: { id },
    select: { version: true, collaborationSequence: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    throw new NotFoundException(`Document ${id} was not found.`);
  }
  throw new ConflictException({
    message: `Document ${id} has a newer version.`,
    currentVersion: existing.version,
    expectedVersion,
    currentCollaborationSequence: existing.collaborationSequence,
    expectedCollaborationSequence,
  });
}

function readRequiredString(
  document: Record<string, unknown>,
  field: string,
): string {
  const value = document[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(
      `Document ${field} must be a non-empty string.`,
    );
  }
  return value;
}

function readSchemaVersion(document: Record<string, unknown>): number {
  const value = document.schemaVersion;
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : 1;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
