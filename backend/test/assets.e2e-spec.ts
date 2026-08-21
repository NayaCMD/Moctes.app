import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AssetMaintenanceService } from '../src/assets/asset-maintenance.service';
import { ObjectStorageService } from '../src/object-storage/object-storage.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Signed asset uploads (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerCookie: string;
  let viewerCookie: string;
  let workspaceId: string;
  let assetId: string;
  const suffix = crypto.randomUUID();
  const ownerEmail = `asset-owner-${suffix}@example.com`;
  const viewerEmail = `asset-viewer-${suffix}@example.com`;
  const storage = {
    createUploadUrl: jest.fn().mockResolvedValue({
      url: 'https://storage.example/upload',
      expiresAt: new Date('2026-08-11T15:05:00.000Z'),
    }),
    createDownloadUrl: jest.fn().mockResolvedValue({
      url: 'https://storage.example/download',
      expiresAt: new Date('2026-08-12T03:00:00.000Z'),
    }),
    inspectObject: jest.fn().mockResolvedValue({
      size: 68,
      mimeType: 'image/png',
    }),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    listObjects: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ObjectStorageService)
      .useValue(storage)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await register(ownerEmail, 'Asset owner');
    ownerCookie = owner.cookie;
    workspaceId = owner.workspaceId;
    viewerCookie = (await register(viewerEmail, 'Asset viewer')).cookie;
  });

  it('creates a pending record and returns a short-lived signed PUT', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        folderId: 'folder-default-assets',
        type: 'image',
        name: 'Pixel',
        originalFilename: '../../pixel.png',
        mimeType: 'image/png',
        size: 68,
        width: 1,
        height: 1,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      asset: {
        workspaceId,
        status: 'PENDING',
        downloadUrl: null,
      },
      upload: {
        url: 'https://storage.example/upload',
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
      },
    });
    const body: unknown = response.body;
    assetId = readNestedString(body, 'asset', 'id');
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^quarantine/${workspaceId}/${assetId}/source\\.png$`),
      ),
      'image/png',
      68,
    );
    const storedAsset = await prisma.asset.findUniqueOrThrow({
      where: { id: assetId },
      select: { objectKey: true },
    });
    expect(storedAsset.objectKey).not.toContain('..');
  });

  it('hides incomplete uploads and queues a verified object for processing', async () => {
    await request(app.getHttpServer())
      .get(`/api/assets?workspaceId=${workspaceId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect({ items: [], nextCursor: null });

    await request(app.getHttpServer())
      .post(`/api/assets/${assetId}/complete`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: assetId,
          status: 'PROCESSING',
          downloadUrl: null,
        });
      });

    await request(app.getHttpServer())
      .get(`/api/assets?workspaceId=${workspaceId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        const responseBody = response.body as unknown as {
          items: unknown[];
          nextCursor: string | null;
        };
        expect(responseBody).toMatchObject({ nextCursor: null });
        expect(responseBody.items).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/api/assets/usage?workspaceId=${workspaceId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          usedBytes: 68,
          readyBytes: 0,
          pendingBytes: 68,
          assetCount: 1,
        });
      });
  });

  it('blocks cross-workspace access even when an asset id is known', async () => {
    await request(app.getHttpServer())
      .get(`/api/assets?workspaceId=${workspaceId}`)
      .set('Cookie', viewerCookie)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/assets/${assetId}/complete`)
      .set('Cookie', viewerCookie)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/assets/${assetId}`)
      .set('Cookie', viewerCookie)
      .expect(403);
  });

  it('rejects an invalid pagination cursor', async () => {
    await request(app.getHttpServer())
      .get(`/api/assets?workspaceId=${workspaceId}&cursor=unknown-asset`)
      .set('Cookie', ownerCookie)
      .expect(400);
  });

  it('rejects unsupported media and oversized declarations', async () => {
    await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        type: 'image',
        name: 'HTML payload',
        originalFilename: 'payload.html',
        mimeType: 'text/html',
        size: 20,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        type: 'image',
        name: 'Oversized',
        originalFilename: 'large.png',
        mimeType: 'image/png',
        size: 5 * 1024 * 1024 + 1,
      })
      .expect(400);
  });

  it('allows viewers to read but not upload or delete assets', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Cookie', ownerCookie)
      .send({ email: viewerEmail, role: 'VIEWER' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/assets?workspaceId=${workspaceId}`)
      .set('Cookie', viewerCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', viewerCookie)
      .send({
        workspaceId,
        type: 'image',
        name: 'Blocked',
        originalFilename: 'blocked.png',
        mimeType: 'image/png',
        size: 68,
      })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/assets/${assetId}`)
      .set('Cookie', viewerCookie)
      .expect(403);
  });

  it('deletes both object and metadata for an authorized editor', async () => {
    await request(app.getHttpServer())
      .delete(`/api/assets/${assetId}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer())
      .get(`/api/assets?workspaceId=${workspaceId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect({ items: [], nextCursor: null });
  });

  it('rejects an object whose stored metadata differs from the ticket', async () => {
    const upload = await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        type: 'image',
        name: 'Mismatched pixel',
        originalFilename: 'mismatched.png',
        mimeType: 'image/png',
        size: 68,
      })
      .expect(201);
    const mismatchedAssetId = readNestedString(upload.body, 'asset', 'id');
    storage.inspectObject.mockResolvedValueOnce({
      size: 67,
      mimeType: 'image/png',
    });

    await request(app.getHttpServer())
      .post(`/api/assets/${mismatchedAssetId}/complete`)
      .set('Cookie', ownerCookie)
      .expect(422);

    await expect(
      prisma.asset.findUniqueOrThrow({
        where: { id: mismatchedAssetId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: 'REJECTED' });
    await request(app.getHttpServer())
      .get(`/api/assets/${mismatchedAssetId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: 'REJECTED',
          downloadUrl: null,
          thumbnailUrl: null,
          variants: [],
          processingError: { code: 'UPLOAD_METADATA_MISMATCH' },
        });
      });
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });

  it('enforces the workspace quota before creating pending metadata', async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageLimitBytes: 32 },
    });

    await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        type: 'image',
        name: 'Over quota',
        originalFilename: 'over-quota.png',
        mimeType: 'image/png',
        size: 68,
      })
      .expect(413)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: 'ASSET_STORAGE_QUOTA_EXCEEDED',
          usedBytes: 0,
          limitBytes: 32,
        });
      });

    await expect(
      prisma.asset.count({
        where: { workspaceId, status: 'PENDING' },
      }),
    ).resolves.toBe(0);
    await request(app.getHttpServer())
      .get(`/api/assets/usage?workspaceId=${workspaceId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          usedBytes: 0,
          limitBytes: 32,
          observability: { quotaRejections: 1 },
        });
      });

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageLimitBytes: 100 * 1024 * 1024 },
    });
  });

  it('prevents parallel reservations from oversubscribing the quota', async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageLimitBytes: 100 },
    });
    const payload = {
      workspaceId,
      type: 'image',
      name: 'Concurrent upload',
      originalFilename: 'concurrent.png',
      mimeType: 'image/png',
      size: 68,
    };

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/assets/uploads')
        .set('Cookie', ownerCookie)
        .send(payload),
      request(app.getHttpServer())
        .post('/api/assets/uploads')
        .set('Cookie', ownerCookie)
        .send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 413,
    ]);
    await expect(
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { storageUsedBytes: true },
      }),
    ).resolves.toEqual({ storageUsedBytes: 68 });

    const created = responses.find((response) => response.status === 201);
    const createdBody: unknown = created?.body;
    const createdId = readNestedString(createdBody, 'asset', 'id');
    await request(app.getHttpServer())
      .delete(`/api/assets/${createdId}`)
      .set('Cookie', ownerCookie)
      .expect(204);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageLimitBytes: 100 * 1024 * 1024 },
    });
  });

  it('limits the number of active asset records', async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { assetLimit: 1 },
    });
    const payload = {
      workspaceId,
      type: 'image',
      name: 'Counted upload',
      originalFilename: 'counted.png',
      mimeType: 'image/png',
      size: 12,
    };
    const first = await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send(payload)
      .expect(413)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: 'ASSET_COUNT_QUOTA_EXCEEDED',
          assetCount: 1,
          assetLimit: 1,
        });
      });

    const firstBody: unknown = first.body;
    await request(app.getHttpServer())
      .delete(`/api/assets/${readNestedString(firstBody, 'asset', 'id')}`)
      .set('Cookie', ownerCookie)
      .expect(204);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { assetLimit: 500 },
    });
  });

  it('cleans expired reservations and old storage orphans', async () => {
    const upload = await request(app.getHttpServer())
      .post('/api/assets/uploads')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        type: 'image',
        name: 'Abandoned',
        originalFilename: 'abandoned.png',
        mimeType: 'image/png',
        size: 24,
      })
      .expect(201);
    const abandonedId = readNestedString(upload.body, 'asset', 'id');
    const abandoned = await prisma.asset.update({
      where: { id: abandonedId },
      data: { uploadExpiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    storage.listObjects.mockResolvedValueOnce([
      {
        key: 'assets/orphan/source.png',
        lastModified: new Date(Date.now() - 48 * 60 * 60 * 1000),
        size: 10,
      },
    ]);

    const cleanup = await app.get(AssetMaintenanceService).runCleanup();

    expect(cleanup).toEqual({ deletedRecords: 1, deletedOrphans: 1 });
    expect(storage.deleteObject).toHaveBeenCalledWith(abandoned.objectKey);
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'assets/orphan/source.png',
    );
    await expect(
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { storageUsedBytes: true },
      }),
    ).resolves.toEqual({ storageUsedBytes: 0 });
  });

  async function register(
    email: string,
    name: string,
  ): Promise<{ cookie: string; workspaceId: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password: 'secure-password-123' })
      .expect(201);
    const headers = response.headers as unknown as Record<string, unknown>;
    const cookieHeader = headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader)
      ? cookieHeader.find((value): value is string => typeof value === 'string')
      : typeof cookieHeader === 'string'
        ? cookieHeader
        : undefined;
    const body: unknown = response.body;
    if (!cookie) {
      throw new Error('Registration did not issue a session cookie.');
    }
    return {
      cookie: cookie.split(';')[0],
      workspaceId: readFirstWorkspaceId(body),
    };
  }

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, viewerEmail] } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.workspace.deleteMany({
      where: { createdById: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });
});

function readFirstWorkspaceId(value: unknown): string {
  const workspaceId = readNestedString(value, 'workspaces', 0, 'id');
  if (!workspaceId) {
    throw new Error('Registration did not create a personal workspace.');
  }
  return workspaceId;
}

function readNestedString(
  value: unknown,
  ...path: Array<string | number>
): string {
  let current = value;
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) {
        return '';
      }
      current = current[segment];
    } else {
      if (
        typeof current !== 'object' ||
        current === null ||
        !(segment in current)
      ) {
        return '';
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }
  return typeof current === 'string' ? current : '';
}
