import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ObjectStorageService } from './object-storage/object-storage.service';
import { ClamAvService } from './assets/clamav.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
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

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('returns the API health payload', () => {
      const response = appController.getHealth();

      expect(response).toMatchObject({
        status: 'ok',
        application: 'MOCTES API',
      });
      expect(typeof response.timestamp).toBe('string');
    });
  });

  describe('getReadiness', () => {
    it('checks critical dependencies', async () => {
      await expect(appController.getReadiness()).resolves.toMatchObject({
        status: 'ready',
        dependencies: {
          postgres: 'ok',
          objectStorage: 'ok',
          antivirus: 'ok',
        },
      });
    });

    it('fails readiness when a critical dependency is degraded', async () => {
      const controller = new AppController({
        getReadiness: jest.fn().mockResolvedValue({
          status: 'degraded',
          dependencies: { postgres: 'ok', objectStorage: 'error' },
        }),
      } as unknown as AppService);

      await expect(controller.getReadiness()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
