import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '@org/database';
import type { AuthenticatedUser } from '@org/api-common';
import type { SystemRole } from '@org/types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AccessTokenPayload } from './token.service.js';

/**
 * Validates the bearer access token and resolves the caller.
 *
 * The user is re-read on every request rather than trusted wholesale from the
 * JWT claims, so a deleted account cannot keep acting for the remaining life
 * of an already-issued token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      // `systemRole` is read here rather than carried in the JWT so that
      // revoking an operator takes effect on the next request, not whenever
      // their current access token happens to expire.
      select: { id: true, email: true, name: true, systemRole: true },
    });

    if (!user) {
      throw new UnauthorizedException('The account no longer exists.');
    }

    return {
      ...user,
      systemRole: user.systemRole as SystemRole,
      sid: payload.sid,
    };
  }
}
