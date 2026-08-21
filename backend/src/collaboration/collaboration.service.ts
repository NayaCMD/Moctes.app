import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PoliciesService } from '../authorization/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  applyCollaborationPatches,
  collaborationPatchesConflict,
  validateCollaborationPatches,
} from './collaboration-patches';
import type { CollaborationOperationInput } from './collaboration.types';
import { assertValidDocumentPayload } from '../documents/document-schema.validator';

const MAX_OPERATION_RETRIES = 5;
const RETAINED_OPERATIONS = 5_000;
const RETAINED_REVISIONS = 100;

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
  ) {}

  async getSnapshot(userId: string, documentId: string, afterSequence = 0) {
    const access = await this.policies.assertDocumentPermission(
      userId,
      documentId,
      'document:read',
    );
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        content: true,
        version: true,
        collaborationSequence: true,
        updatedAt: true,
      },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }
    const operations =
      afterSequence > 0 && afterSequence < document.collaborationSequence
        ? await this.prisma.documentOperation.findMany({
            where: { documentId, sequence: { gt: afterSequence } },
            orderBy: { sequence: 'asc' },
            take: 500,
          })
        : [];
    return {
      documentId,
      workspaceId: access.workspaceId,
      role: access.role,
      version: document.version,
      sequence: document.collaborationSequence,
      document: document.content,
      operations: operations.map(toOperationResponse),
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  async applyOperation(
    userId: string,
    documentId: string,
    input: CollaborationOperationInput,
  ) {
    await this.policies.assertDocumentPermission(
      userId,
      documentId,
      'document:update',
    );
    validateOperationEnvelope(input);
    const patches = validateCollaborationPatches(input.patches);

    for (let attempt = 0; attempt < MAX_OPERATION_RETRIES; attempt += 1) {
      const duplicate = await this.prisma.documentOperation.findUnique({
        where: {
          documentId_operationId: {
            documentId,
            operationId: input.operationId,
          },
        },
      });
      if (duplicate) return toOperationResponse(duplicate);

      const current = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          content: true,
          collaborationSequence: true,
          version: true,
          title: true,
          type: true,
          schemaVersion: true,
          deletedAt: true,
        },
      });
      if (!current || current.deletedAt) {
        throw new NotFoundException(`Document ${documentId} was not found.`);
      }
      if (input.baseSequence > current.collaborationSequence) {
        throw new BadRequestException(
          'Operation base sequence is ahead of the server.',
        );
      }
      if (input.baseSequence < current.collaborationSequence) {
        const intervening = await this.prisma.documentOperation.findMany({
          where: {
            documentId,
            sequence: {
              gt: input.baseSequence,
              lte: current.collaborationSequence,
            },
          },
          select: { patches: true },
        });
        const hasConflict = intervening.some((operation) =>
          collaborationPatchesConflict(
            patches,
            operation.patches as unknown as typeof patches,
          ),
        );
        if (hasConflict) {
          throw new ConflictException({
            code: 'COLLABORATION_OPERATION_CONFLICT',
            message: 'The operation overlaps a newer collaborative change.',
            currentSequence: current.collaborationSequence,
            baseSequence: input.baseSequence,
          });
        }
      }
      const nextSequence = current.collaborationSequence + 1;
      const nextVersion = current.version + 1;
      const nextContent = applyCollaborationPatches(current.content, patches);
      assertValidDocumentPayload(documentId, nextContent);
      const metadata = readDocumentMetadata(nextContent, current);

      try {
        const operation = await this.prisma.$transaction(
          async (transaction) => {
            const updated = await transaction.document.updateMany({
              where: {
                id: documentId,
                collaborationSequence: current.collaborationSequence,
                version: current.version,
                deletedAt: null,
              },
              data: {
                title: metadata.title,
                type: metadata.type,
                schemaVersion: metadata.schemaVersion,
                content: nextContent as Prisma.InputJsonValue,
                collaborationSequence: nextSequence,
                version: nextVersion,
              },
            });
            if (updated.count === 0) throw new ConcurrentOperationError();
            await transaction.documentRevision.create({
              data: {
                documentId,
                version: nextVersion,
                title: metadata.title,
                schemaVersion: metadata.schemaVersion,
                content: nextContent as Prisma.InputJsonValue,
                createdById: userId,
              },
            });
            return transaction.documentOperation.create({
              data: {
                documentId,
                sequence: nextSequence,
                operationId: input.operationId,
                clientId: input.clientId,
                baseSequence: input.baseSequence,
                documentVersion: nextVersion,
                patches: patches as unknown as Prisma.InputJsonValue,
                actorId: userId,
              },
            });
          },
        );
        void this.pruneOperations(documentId, nextSequence);
        void this.pruneRevisions(documentId, nextVersion);
        return toOperationResponse(operation);
      } catch (error) {
        if (error instanceof ConcurrentOperationError) continue;
        if (isUniqueConstraintError(error)) {
          const duplicateAfterRace =
            await this.prisma.documentOperation.findUnique({
              where: {
                documentId_operationId: {
                  documentId,
                  operationId: input.operationId,
                },
              },
            });
          if (duplicateAfterRace)
            return toOperationResponse(duplicateAfterRace);
          continue;
        }
        throw error;
      }
    }
    throw new ConcurrentOperationError(
      'Document is receiving too many concurrent operations. Retry shortly.',
    );
  }

  private async pruneOperations(
    documentId: string,
    currentSequence: number,
  ): Promise<void> {
    const threshold = currentSequence - RETAINED_OPERATIONS;
    if (threshold <= 0) return;
    await this.prisma.documentOperation.deleteMany({
      where: { documentId, sequence: { lte: threshold } },
    });
  }

  private async pruneRevisions(
    documentId: string,
    currentVersion: number,
  ): Promise<void> {
    const threshold = currentVersion - RETAINED_REVISIONS;
    if (threshold <= 0) return;
    await this.prisma.documentRevision.deleteMany({
      where: { documentId, version: { lte: threshold } },
    });
  }
}

class ConcurrentOperationError extends Error {}

function validateOperationEnvelope(input: CollaborationOperationInput): void {
  if (
    !input ||
    typeof input.operationId !== 'string' ||
    input.operationId.length < 8 ||
    input.operationId.length > 128 ||
    typeof input.clientId !== 'string' ||
    input.clientId.length < 8 ||
    input.clientId.length > 128 ||
    !Number.isInteger(input.baseSequence) ||
    input.baseSequence < 0
  ) {
    throw new BadRequestException('Invalid collaboration operation envelope.');
  }
}

function toOperationResponse(operation: {
  id: string;
  documentId: string;
  sequence: number;
  operationId: string;
  clientId: string;
  baseSequence: number;
  documentVersion: number | null;
  patches: Prisma.JsonValue;
  actorId: string;
  createdAt: Date;
}) {
  return {
    id: operation.id,
    documentId: operation.documentId,
    sequence: operation.sequence,
    operationId: operation.operationId,
    clientId: operation.clientId,
    baseSequence: operation.baseSequence,
    version: operation.documentVersion ?? undefined,
    patches: operation.patches,
    actorId: operation.actorId,
    createdAt: operation.createdAt.toISOString(),
  };
}

function readDocumentMetadata(
  value: unknown,
  fallback: { title: string; type: string; schemaVersion: number },
): { title: string; type: string; schemaVersion: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(
      'Collaborative patches produced an invalid document.',
    );
  }
  const document = value as Record<string, unknown>;
  const title = document.title ?? fallback.title;
  const type = document.type ?? fallback.type;
  const schemaVersion = document.schemaVersion ?? fallback.schemaVersion;
  if (typeof title !== 'string' || !title.trim()) {
    throw new BadRequestException('Document title must be a non-empty string.');
  }
  if (typeof type !== 'string' || !type.trim()) {
    throw new BadRequestException('Document type must be a non-empty string.');
  }
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    throw new BadRequestException(
      'Document schema version must be a positive integer.',
    );
  }
  return { title, type, schemaVersion };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
