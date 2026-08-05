import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

export interface SCIMUserPayload {
  schemas: string[];
  userName: string;
  name: { formatted?: string; familyName?: string; givenName?: string };
  emails: Array<{ value: string; primary?: boolean }>;
  active: boolean;
}

@Injectable()
export class SCIMService {
  private readonly logger = new Logger(SCIMService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({ take: 50 });
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: users.length,
      Resources: users.map((u) => ({
        id: u.id,
        userName: u.email,
        displayName: u.name,
        active: u.presence !== 'OFFLINE',
      })),
    };
  }

  async provisionUser(payload: SCIMUserPayload) {
    this.logger.log(`SCIM Provisioning user: ${payload.userName}`);
    const email = payload.emails?.[0]?.value ?? payload.userName;
    const name = payload.name?.formatted ?? payload.userName.split('@')[0];

    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash: '$2b$10$scim_provisioned_placeholder' },
      update: { name },
    });

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      displayName: user.name,
      active: true,
    };
  }
}
