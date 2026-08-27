import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DesktopAuthService } from './desktop-auth.service.js';
import { DeviceAuthService } from './device-auth.service.js';
import { JwtAuthGuard, WorkspaceRoleGuard } from './guards.js';
import { JwtStrategy } from './jwt.strategy.js';
import { TokenCleanupService } from './token-cleanup.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DesktopAuthService,
    DeviceAuthService,
    TokenService,
    TokenCleanupService,
    JwtStrategy,
    JwtAuthGuard,
    WorkspaceRoleGuard,
  ],
  exports: [
    AuthService,
    DesktopAuthService,
    DeviceAuthService,
    TokenService,
    JwtAuthGuard,
    WorkspaceRoleGuard,
  ],
})
export class AuthModule {}
