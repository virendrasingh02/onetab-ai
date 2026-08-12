import { Logger, type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { parseCorsOrigins } from '@org/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createServer } from 'node:net';
import { AppModule } from './app/app.module';

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

async function getAvailablePort(
  port: number,
  host: string,
  isProduction: boolean,
): Promise<number> {
  const maxAttempts = isProduction ? 1 : 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidatePort = port + attempt;

    if (await canListen(candidatePort, host)) {
      return candidatePort;
    }

    if (!isProduction && attempt < maxAttempts - 1) {
      Logger.warn(
        `Port ${candidatePort} is in use, trying ${candidatePort + 1}`,
      );
    }
  }

  throw new Error(
    `No available port found from ${port} to ${port + maxAttempts - 1}`,
  );
}

function getCorsOrigins(configuredOrigins: string[], _isProduction: boolean) {
  const localWebOrigins = Array.from(
    { length: 10 },
    (_, index) => `http://localhost:${4200 + index}`,
  );

  return [...new Set([...configuredOrigins, ...localWebOrigins])];
}

async function listen(
  app: INestApplication,
  port: number,
  host: string,
  isProduction: boolean,
): Promise<number> {
  const actualPort = await getAvailablePort(port, host, isProduction);
  await app.listen(actualPort, host);
  return actualPort;
}

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

  const origins = getCorsOrigins(
    parseCorsOrigins(config.get<string>('CORS_ORIGINS', '')),
    isProduction,
  );
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
  const host = config.get<string>('HOST', 'localhost');
  const actualPort = await listen(app, port, host, isProduction);

  Logger.log(`OneTab AI API listening on http://${host}:${actualPort}/api/v1`);
  if (!isProduction) {
    Logger.log(`CORS origins: ${origins.join(', ') || '(none configured)'}`);
  }
}

bootstrap().catch((error) => {
  Logger.error('Failed to start the API', error);
  process.exit(1);
});
