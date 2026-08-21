import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authenticated document persistence (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerCookie: string;
  let viewerCookie: string;
  let workspaceId: string;
  const suffix = crypto.randomUUID();
  const ownerEmail = `owner-${suffix}@example.com`;
  const viewerEmail = `viewer-${suffix}@example.com`;
  const documentId = `document-e2e-${suffix}`;
  const document = {
    id: documentId,
    schemaVersion: 3,
    type: 'notepad',
    title: 'Documento E2E',
    coverColor: '#ffffff',
    favorite: false,
    pages: [
      {
        id: `page-${documentId}`,
        documentId,
        title: 'Página',
        order: 1,
        paperType: 'blank',
        paperColor: '#ffffff',
        patternColor: '#000000',
        patternOpacity: 0,
        patternSize: 20,
        elements: [],
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
    dividers: [],
    activePageId: `page-${documentId}`,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
  };

  function createReserveDocument(source: typeof document) {
    const id = `document-reserve-${suffix}`;
    const pageId = `page-${id}`;
    return {
      ...source,
      id,
      title: 'Documento de reserva E2E',
      activePageId: pageId,
      pages: source.pages.map((page) => ({
        ...page,
        id: pageId,
        documentId: id,
      })),
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

    const owner = await register(ownerEmail, 'Workspace owner');
    ownerCookie = owner.cookie;
    workspaceId = owner.workspaceId;
    const viewer = await register(viewerEmail, 'Workspace viewer');
    viewerCookie = viewer.cookie;
  });

  it('rejects document access without a session', async () => {
    await request(app.getHttpServer())
      .get(`/api/documents?workspaceId=${workspaceId}`)
      .expect(401);
  });

  it('returns the authenticated session and personal workspace', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          authenticated: true,
          user: { email: ownerEmail },
          workspaces: [{ id: workspaceId, role: 'OWNER' }],
        });
      });
  });

  it('updates workspace metadata through owner policy', async () => {
    await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Espaço E2E atualizado' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: workspaceId,
          name: 'Espaço E2E atualizado',
          role: 'OWNER',
        });
      });
  });

  it('creates, versions and deletes a document inside the workspace', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        id: document.id,
        title: document.title,
        type: document.type,
        schemaVersion: document.schemaVersion,
        document,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      id: document.id,
      workspaceId,
      version: 1,
    });

    const updatedDocument = { ...document, title: 'Documento atualizado' };
    await request(app.getHttpServer())
      .put(`/api/documents/${document.id}`)
      .set('Cookie', ownerCookie)
      .send({
        expectedVersion: 1,
        expectedCollaborationSequence: 0,
        document: updatedDocument,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: document.id,
          version: 2,
          document: { title: 'Documento atualizado' },
        });
      });

    await request(app.getHttpServer())
      .put(`/api/documents/${document.id}`)
      .set('Cookie', ownerCookie)
      .send({
        expectedVersion: 1,
        expectedCollaborationSequence: 0,
        document: updatedDocument,
      })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/documents/${document.id}/revisions`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          documentId: document.id,
          currentVersion: 2,
          revisions: [
            { version: 2, title: 'Documento atualizado' },
            { version: 1, title: document.title },
          ],
        });
      });

    const share = await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/share-links`)
      .set('Cookie', ownerCookie)
      .send({ expiresInDays: 7 })
      .expect(201);
    const shareToken = readStringProperty(share.body as unknown, 'token');
    const shareLinkId = readStringProperty(share.body as unknown, 'id');
    if (!shareToken || !shareLinkId) {
      throw new Error('Share creation did not return its token and id.');
    }
    await request(app.getHttpServer())
      .get(`/api/shares/${shareToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          access: 'READ_ONLY',
          documentId: document.id,
          document: { title: 'Documento atualizado' },
        });
      });
    await request(app.getHttpServer())
      .delete(`/api/documents/${document.id}/share-links/${shareLinkId}`)
      .set('Cookie', ownerCookie)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/shares/${shareToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/documents/${document.id}/revisions/1`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          version: 1,
          document: { title: document.title },
        });
      });

    await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions/1/restore`)
      .set('Cookie', ownerCookie)
      .send({ expectedVersion: 2, expectedCollaborationSequence: 0 })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: document.id,
          version: 3,
          document: { title: document.title },
        });
      });

    await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions/2/restore`)
      .set('Cookie', ownerCookie)
      .send({ expectedVersion: 2, expectedCollaborationSequence: 0 })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/documents/${document.id}/revisions`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          currentVersion: 3,
          revisions: [
            { version: 3, restoredFromVersion: 1 },
            { version: 2, restoredFromVersion: null },
            { version: 1, restoredFromVersion: null },
          ],
        });
      });
  });

  it('enforces the viewer policy on document writes', async () => {
    await request(app.getHttpServer())
      .get(`/api/documents?workspaceId=${workspaceId}`)
      .set('Cookie', viewerCookie)
      .expect(403);

    const invitation = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: viewerEmail, role: 'VIEWER' })
      .expect(201);

    const invitationToken = readStringProperty(
      invitation.body as unknown,
      'token',
    );
    if (!invitationToken) {
      throw new Error('Invitation creation did not return its token.');
    }
    await request(app.getHttpServer())
      .post(`/api/workspaces/invitations/${invitationToken}/accept`)
      .set('Cookie', viewerCookie)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/workspaces/invitations/${invitationToken}/accept`)
      .set('Cookie', viewerCookie)
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: workspaceId,
          role: 'VIEWER',
        });
      });

    await request(app.getHttpServer())
      .get(`/api/documents?workspaceId=${workspaceId}`)
      .set('Cookie', viewerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}`)
      .set('Cookie', viewerCookie)
      .send({ name: 'Alteração indevida' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/documents/${document.id}/revisions`)
      .set('Cookie', viewerCookie)
      .expect(200)
      .expect((response) => {
        const responseBody: unknown = response.body;
        expect(responseBody).toMatchObject({ currentVersion: 3 });
      });

    await request(app.getHttpServer())
      .post(`/api/documents/${document.id}/revisions/1/restore`)
      .set('Cookie', viewerCookie)
      .send({ expectedVersion: 3, expectedCollaborationSequence: 0 })
      .expect(403);

    await request(app.getHttpServer())
      .put(`/api/documents/${document.id}`)
      .set('Cookie', viewerCookie)
      .send({ expectedVersion: 2, expectedCollaborationSequence: 0, document })
      .expect(403);

    const reserveDocument = createReserveDocument(document);
    await request(app.getHttpServer())
      .post('/api/documents')
      .set('Cookie', ownerCookie)
      .send({
        workspaceId,
        id: reserveDocument.id,
        title: reserveDocument.title,
        type: reserveDocument.type,
        schemaVersion: reserveDocument.schemaVersion,
        document: reserveDocument,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/documents/${document.id}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/documents/${document.id}`)
      .set('Cookie', ownerCookie)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/documents/trash?workspaceId=${workspaceId}`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({ id: document.id }),
        ]);
      });

    await request(app.getHttpServer())
      .post(
        `/api/documents/${document.id}/restore-deleted?workspaceId=${workspaceId}`,
      )
      .set('Cookie', ownerCookie)
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: document.id });
      });

    await request(app.getHttpServer())
      .get(`/api/documents/${document.id}`)
      .set('Cookie', ownerCookie)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/documents/${reserveDocument.id}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/documents/${document.id}`)
      .set('Cookie', ownerCookie)
      .expect(409);
  });

  it('revokes the current session and permits a new login', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', ownerCookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect({ authenticated: false });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'secure-password-123' })
      .expect('set-cookie', /moctes_session=/)
      .expect(200);
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
    if (!cookie) {
      throw new Error('Registration did not issue a session cookie.');
    }
    const responseBody = response.body as unknown;
    const createdWorkspaceId = readFirstWorkspaceId(responseBody);
    if (!createdWorkspaceId) {
      throw new Error('Registration did not create a personal workspace.');
    }
    return {
      cookie: cookie.split(';')[0],
      workspaceId: createdWorkspaceId,
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

function readFirstWorkspaceId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('workspaces' in value)) {
    return undefined;
  }
  const workspaces = value.workspaces;
  if (!isUnknownArray(workspaces)) {
    return undefined;
  }
  const first = workspaces[0];
  if (typeof first !== 'object' || first === null || !('id' in first)) {
    return undefined;
  }
  const id = first.id;
  return typeof id === 'string' ? id : undefined;
}

function readStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (typeof value !== 'object' || value === null || !(property in value)) {
    return undefined;
  }
  const propertyValue = (value as Record<string, unknown>)[property];
  return typeof propertyValue === 'string' ? propertyValue : undefined;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
