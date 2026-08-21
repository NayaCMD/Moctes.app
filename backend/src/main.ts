import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

  const port = configService.get<number>('PORT') ?? 3000;

  app.enableShutdownHooks();
  app.use(helmet());
  if (configService.get<string>('TRUST_PROXY') === 'true') {
    app.set('trust proxy', 1);
  }
  app.setGlobalPrefix('api');
  app.useBodyParser('json', {
    limit: configService.get<string>('DOCUMENT_BODY_LIMIT') ?? '10mb',
  });

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);

  console.log(`MOCTES API: http://localhost:${port}/api`);
}

void bootstrap();
