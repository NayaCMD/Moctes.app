import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { ObjectStorageService } from './../src/object-storage/object-storage.service';
import { ClamAvService } from './../src/assets/clamav.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([1]) },
        },
        {
          provide: ObjectStorageService,
          useValue: { checkHealth: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ClamAvService,
          useValue: { checkHealth: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          status?: unknown;
          application?: unknown;
          timestamp?: unknown;
        };

        expect(body).toMatchObject({
          status: 'ok',
          application: 'MOCTES API',
        });
        expect(typeof body.timestamp).toBe('string');
      });
  });

  it('/api/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: 'ready',
          dependencies: {
            postgres: 'ok',
            objectStorage: 'ok',
            antivirus: 'ok',
          },
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
