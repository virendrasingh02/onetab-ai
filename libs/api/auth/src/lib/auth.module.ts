import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, WorkspaceRoleGuard } from './guards.js';
import { JwtStrategy } from './jwt.strategy.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    // Secrets are passed per-call in TokenService so access and refresh
    // concerns stay independent; no global signing secret is registered here.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    WorkspaceRoleGuard,
  ],
  exports: [AuthService, TokenService, JwtAuthGuard, WorkspaceRoleGuard],
})
export class AuthModule {}
