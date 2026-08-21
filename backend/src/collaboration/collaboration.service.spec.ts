import type { PoliciesService } from '../authorization/policies.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CollaborationService } from './collaboration.service';
import { ConflictException } from '@nestjs/common';

describe('CollaborationService', () => {
  it('persists an idempotent, sequenced operation', async () => {
    const operation = {
      id: 'stored-operation',
      documentId: 'document-1',
      sequence: 8,
      operationId: 'operation-123',
      clientId: 'client-12345',
      baseSequence: 7,
      documentVersion: 4,
      patches: [{ op: 'set', path: ['title'], value: 'Together' }],
      actorId: 'user-1',
      createdAt: new Date('2026-08-13T12:00:00.000Z'),
    };
    const transaction = {
      document: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      documentRevision: {
        create: jest.fn().mockResolvedValue({}),
      },
      documentOperation: { create: jest.fn().mockResolvedValue(operation) },
    };
    const prisma = {
      documentOperation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      documentRevision: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      document: {
        findUnique: jest.fn().mockResolvedValue({
          content: validDocument('Before'),
          collaborationSequence: 7,
          version: 3,
          title: 'Before',
          type: 'notebook',
          schemaVersion: 3,
          deletedAt: null,
        }),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const policies = {
      assertDocumentPermission: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        role: 'EDITOR',
      }),
    };
    const service = new CollaborationService(
      prisma as unknown as PrismaService,
      policies as unknown as PoliciesService,
    );

    await expect(
      service.applyOperation('user-1', 'document-1', {
        operationId: 'operation-123',
        clientId: 'client-12345',
        baseSequence: 7,
        patches: [{ op: 'set', path: ['title'], value: 'Together' }],
      }),
    ).resolves.toMatchObject({ sequence: 8, operationId: 'operation-123' });

    expect(transaction.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        collaborationSequence: 7,
        version: 3,
        deletedAt: null,
      },
      data: {
        title: 'Together',
        type: 'notebook',
        schemaVersion: 3,
        collaborationSequence: 8,
        version: 4,
        content: validDocument('Together'),
      },
    });
    expect(transaction.documentRevision.create).toHaveBeenCalledTimes(1);
    expect(transaction.documentOperation.create).toHaveBeenCalledTimes(1);
  });

  it('returns an already stored operation without applying it twice', async () => {
    const duplicate = {
      id: 'stored-operation',
      documentId: 'document-1',
      sequence: 2,
      operationId: 'operation-123',
      clientId: 'client-12345',
      baseSequence: 1,
      documentVersion: 2,
      patches: [],
      actorId: 'user-1',
      createdAt: new Date(),
    };
    const prisma = {
      documentOperation: {
        findUnique: jest.fn().mockResolvedValue(duplicate),
      },
      document: { findUnique: jest.fn() },
    };
    const policies = {
      assertDocumentPermission: jest.fn().mockResolvedValue({ role: 'EDITOR' }),
    };
    const service = new CollaborationService(
      prisma as unknown as PrismaService,
      policies as unknown as PoliciesService,
    );

    await expect(
      service.applyOperation('user-1', 'document-1', {
        operationId: 'operation-123',
        clientId: 'client-12345',
        baseSequence: 1,
        patches: [{ op: 'set', path: ['title'], value: 'Ignored duplicate' }],
      }),
    ).resolves.toMatchObject({ id: 'stored-operation', sequence: 2 });
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a stale operation that overlaps a newer operation', async () => {
    const prisma = {
      documentOperation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            patches: [{ op: 'set', path: ['title'], value: 'Newer title' }],
          },
        ]),
      },
      document: {
        findUnique: jest.fn().mockResolvedValue({
          content: validDocument('Newer title'),
          collaborationSequence: 8,
          version: 4,
          title: 'Newer title',
          type: 'notebook',
          schemaVersion: 3,
          deletedAt: null,
        }),
      },
      $transaction: jest.fn(),
    };
    const policies = {
      assertDocumentPermission: jest.fn().mockResolvedValue({ role: 'EDITOR' }),
    };
    const service = new CollaborationService(
      prisma as unknown as PrismaService,
      policies as unknown as PoliciesService,
    );

    await expect(
      service.applyOperation('user-1', 'document-1', {
        operationId: 'operation-stale',
        clientId: 'client-12345',
        baseSequence: 7,
        patches: [{ op: 'set', path: ['title'], value: 'Stale title' }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

function validDocument(title: string) {
  return {
    id: 'document-1',
    title,
    type: 'notebook',
    schemaVersion: 3,
    activePageId: 'page-1',
    dividers: [],
    pages: [
      {
        id: 'page-1',
        documentId: 'document-1',
        order: 0,
        paperType: 'dotted',
        paperColor: '#ffffff',
        elements: [],
      },
    ],
  };
}
