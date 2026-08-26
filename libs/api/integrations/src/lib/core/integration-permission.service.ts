import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { WorkspaceRole } from '@org/types';

@Injectable()
export class IntegrationPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asserts that a user has permission to access or modify a specific integration.
   */
  async assertIntegrationAccess(
    integrationId: string,
    userId: string,
    workspaceId?: string,
    action: 'view' | 'sync' | 'manage' | 'disconnect' = 'view',
  ) {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found.');
    }

    // User-scoped integration check
    if (integration.scopeType === 'USER') {
      if (integration.userId !== userId) {
        throw new ForbiddenException('You do not have access to this user integration.');
      }
      return integration;
    }

    // Workspace-scoped integration check
    if (integration.workspaceId) {
      if (workspaceId && integration.workspaceId !== workspaceId) {
        throw new ForbiddenException('Integration does not belong to this workspace.');
      }

      // Check membership in the integration's workspace
      const member = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: integration.workspaceId,
            userId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenException('You are not a member of the workspace for this integration.');
      }

      // Mutating actions require ADMIN or OWNER for workspace-level integrations
      if (action === 'manage' || action === 'disconnect') {
        if (member.role !== WorkspaceRole.ADMIN && member.role !== WorkspaceRole.OWNER) {
          throw new ForbiddenException('Workspace administrator permission is required to manage workspace integrations.');
        }
      }
    }

    return integration;
  }
}
