import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule, JwtAuthGuard } from '@org/api-auth';
import { ChannelModule } from '@org/api-channel';
import { HttpExceptionFilter } from '@org/api-common';
import { MatrixModule } from '@org/api-matrix';
import { MemberModule } from '@org/api-member';
import { UserModule } from '@org/api-user';
import { WorkspaceModule } from '@org/api-workspace';
import { validateApiEnv } from '@org/config';
import { PrismaModule } from '@org/database';
import { InfrastructureModule } from '@org/api-infrastructure';
import { WorkToolsModule } from '@org/api-work-tools';
import { AgentsModule } from '@org/api-agents';
import { AutomationsModule } from '@org/api-automations';
import { EnterpriseModule } from '@org/api-enterprise';
import { IntegrationsModule } from '@org/api-integrations';
import { AnalyticsModule } from '@org/api-analytics';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Fails fast at boot with every misconfigured variable listed.
      validate: validateApiEnv,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env['THROTTLE_TTL_MS'] ?? 60_000),
        limit: Number(process.env['THROTTLE_LIMIT'] ?? 120),
      },
    ]),
    InfrastructureModule,
    PrismaModule,
    AuthModule,
    UserModule,
    WorkspaceModule,
    ChannelModule,
    MemberModule,
    MatrixModule,
    WorkToolsModule,
    AgentsModule,
    AutomationsModule,
    EnterpriseModule,
    IntegrationsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Authenticated by default; routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // One consistent error body for every failure path.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
