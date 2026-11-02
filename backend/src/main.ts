import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { rateLimit, securityHeaders } from './security/rate-limit.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Render and other reverse proxies provide the original client address here.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(securityHeaders, rateLimit);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  Logger.log(`🪒 API listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
