import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { PoliciesService } from '../authorization/policies.service';
import { DocumentsService } from './documents.service';
import type { CollaborationBroadcaster } from '../collaboration/collaboration-broadcaster.service';

const now = new Date('2026-08-11T12:30:00.000Z');
const content = {
  id: 'document-1',
  title: 'Caderno',
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

interface RevisionCreateInput {
  data: {
    documentId: string;
    version: number;
    createdById: string;
    [key: string]: unknown;
  };
}

function createPrismaMock() {
  const revisionInputs: RevisionCreateInput[] = [];
  const transaction = {
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    documentRevision: {
      create: jest.fn((input: RevisionCreateInput) => {
        revisionInputs.push(input);
        return Promise.resolve({});
      }),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return {
    ...transaction,
    revisionInputs,
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
}

function createPoliciesMock() {
  return {
    assertWorkspacePermission: jest.fn().mockResolvedValue({ role: 'OWNER' }),
    assertDocumentPermission: jest
      .fn()
      .mockResolvedValue({ workspaceId: 'workspace-1', role: 'OWNER' }),
  };
}

function createCollaborationMock() {
  return {
    publishSnapshot: jest.fn(),
    publishDeleted: jest.fn(),
  };
}

describe('DocumentsService', () => {
  it('persists a canonical document', async () => {
    const prisma = createPrismaMock();
    prisma.document.create.mockResolvedValue({
      id: 'document-1',
      workspaceId: 'workspace-1',
      title: 'Caderno',
      type: 'notebook',
      schemaVersion: 3,
      content,
      version: 1,
      collaborationSequence: 0,
      createdAt: now,
      updatedAt: now,
    });
    const policies = createPoliciesMock();
    const service = new DocumentsService(
      prisma as unknown as PrismaService,
      policies as unknown as PoliciesService,
      createCollaborationMock() as unknown as CollaborationBroadcaster,
    );

    const result = await service.create('user-1', {
      workspaceId: 'workspace-1',
      id: 'document-1',
      title: 'Caderno',
      type: 'notebook',
      schemaVersion: 3,
      document: content,
    });

    expect(result).toMatchObject({
      id: 'document-1',
      workspaceId: 'workspace-1',
      version: 1,
      document: content,
    });
    expect(prisma.document.create).toHaveBeenCalledTimes(1);
    expect(prisma.documentRevision.create).toHaveBeenCalledTimes(1);
    const revisionInput = prisma.revisionInputs[0];
    expect(revisionInput).toMatchObject({
      data: {
        documentId: 'document-1',
        version: 1,
        createdById: 'user-1',
      },
    });
  });

  it('rejects stale optimistic versions', async () => {
    const prisma = createPrismaMock();
    prisma.document.updateMany.mockResolvedValue({ count: 0 });
    prisma.document.findUnique.mockResolvedValue({ version: 4 });
    const policies = createPoliciesMock();
    const service = new DocumentsService(
      prisma as unknown as PrismaService,
      policies as unknown as PoliciesService,
      createCollaborationMock() as unknown as CollaborationBroadcaster,
    );

    await expect(
      service.update('user-1', 'document-1', {
        expectedVersion: 3,
        expectedCollaborationSequence: 0,
        document: content,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects metadata that disagrees with the canonical payload', async () => {
    const service = new DocumentsService(
      createPrismaMock() as unknown as PrismaService,
      createPoliciesMock() as unknown as PoliciesService,
      createCollaborationMock() as unknown as CollaborationBroadcaster,
    );

    await expect(
      service.create('user-1', {
        workspaceId: 'workspace-1',
        id: 'document-1',
        title: 'Título divergente',
        type: 'notebook',
        schemaVersion: 3,
        document: content,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
