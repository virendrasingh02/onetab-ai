import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { hashToken } from './crypto-secrets.js';

@Injectable()
export class ScimBearerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Authorization header with Bearer token is required for SCIM endpoints.',
      });
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
      throw new UnauthorizedException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Invalid Bearer token authorization format.',
      });
    }

    const rawToken = match[1].trim();
    const tokenHash = hashToken(rawToken);

    // Look up SSOConfig with matching token hash (or legacy plaintext fallback if not yet rotated)
    const ssoConfig = await this.prisma.sSOConfig.findFirst({
      where: {
        OR: [
          { scimTokenHash: tokenHash },
          { scimToken: rawToken },
        ],
        scimEnabled: true,
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    if (!ssoConfig) {
      throw new UnauthorizedException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Invalid or revoked SCIM bearer token.',
      });
    }

    // Check expiration
    if (ssoConfig.scimTokenExpiresAt && ssoConfig.scimTokenExpiresAt < new Date()) {
      throw new UnauthorizedException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'SCIM bearer token has expired. Rotate token in the Enterprise settings.',
      });
    }

    // Update last sync timestamp asynchronously
    void this.prisma.sSOConfig
      .update({
        where: { id: ssoConfig.id },
        data: { scimLastSyncAt: new Date() },
      })
      .catch(() => undefined);

    // Bind tenant context
    request.scimOrganizationId = ssoConfig.organizationId;
    request.scimOrganization = ssoConfig.organization;

    return true;
  }
}
