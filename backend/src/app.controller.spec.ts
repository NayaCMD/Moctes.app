import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
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
});
