import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { parseCorsOrigins } from '@org/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');
  // URI versioning keeps old clients working when a contract has to change.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Refresh tokens travel as httpOnly cookies, so the parser is required.
  app.use(cookieParser());

  const origins = parseCorsOrigins(config.get<string>('CORS_ORIGINS', ''));
  app.enableCors({
    // `credentials` requires an explicit origin list — `*` is rejected by
    // browsers once cookies are involved.
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Lets Nest run onModuleDestroy hooks (closing the DB pool) on SIGTERM.
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  Logger.log(`OneTab AI API listening on http://localhost:${port}/api/v1`);
  if (!isProduction) {
    Logger.log(`CORS origins: ${origins.join(', ') || '(none configured)'}`);
  }
}

bootstrap().catch((error) => {
  Logger.error('Failed to start the API', error);
  process.exit(1);
});
