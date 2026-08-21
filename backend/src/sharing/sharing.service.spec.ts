import { NotFoundException } from '@nestjs/common';
import type { PoliciesService } from '../authorization/policies.service';
import type { ObjectStorageService } from '../object-storage/object-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SharingService } from './sharing.service';

describe('SharingService', () => {
  it('stores only the token hash and returns the secret once', async () => {
    let storedTokenHash = '';
    const prisma = {
      documentShareLink: {
        create: jest
          .fn()
          .mockImplementation(
            (input: { data: { tokenHash: string; documentId: string } }) => {
              storedTokenHash = input.data.tokenHash;
              return Promise.resolve({
                id: 'link-1',
                documentId: input.data.documentId,
                expiresAt: null,
                revokedAt: null,
                lastUsedAt: null,
                createdAt: new Date('2026-08-13T12:00:00.000Z'),
                createdBy: { id: 'user-1', name: 'Owner' },
              });
            },
          ),
      },
    };
    const policies = {
      assertDocumentPermission: jest.fn().mockResolvedValue({ role: 'OWNER' }),
    };
    const service = new SharingService(
      prisma as unknown as PrismaService,
      policies as unknown as PoliciesService,
      {} as ObjectStorageService,
    );

    const response = await service.create('user-1', 'document-1', {});

    expect(response.token).toHaveLength(43);
    expect(storedTokenHash).not.toBe(response.token);
    expect(storedTokenHash).toHaveLength(64);
  });

  it('does not reveal revoked public links', async () => {
    const prisma = {
      documentShareLink: {
        findUnique: jest.fn().mockResolvedValue({ revokedAt: new Date() }),
      },
    };
    const service = new SharingService(
      prisma as unknown as PrismaService,
      {} as PoliciesService,
      {} as ObjectStorageService,
    );

    await expect(
      service.resolvePublicLink('x'.repeat(43)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
