import {
  applyDecorators,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@org/api-common';
import { PrismaService } from '@org/database';
import { canManageOwnedAIResource, type WorkspacePermission } from '@org/types';

type ManagedResource = 'entity' | 'workflow';

interface ManageTarget {
  resource: ManagedResource;
  param: string;
}

const MANAGE_TARGET_KEY = 'ai-resource:manage-target';

/**
 * Refuses the request unless the caller may change the AI agent/coworker named
 * by route parameter `param` — its creator, or a member who can manage
 * workspace settings (`canManageOwnedAIResource`).
 *
 * Must sit on a controller already guarded by `WorkspaceRoleGuard`, which
 * resolves the workspace and the caller's permissions this reads. Nest runs
 * controller-level guards before method-level ones, so that order holds.
 */
export function CanManageAIEntity(param: string) {
  return manage({ resource: 'entity', param });
}

/** The same rule for an automation workflow, which also runs as its creator. */
export function CanManageWorkflow(param: string) {
  return manage({ resource: 'workflow', param });
}

function manage(target: ManageTarget) {
  return applyDecorators(SetMetadata(MANAGE_TARGET_KEY, target), UseGuards(AIResourceManageGuard));
}

@Injectable()
export class AIResourceManageGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = this.reflector.get<ManageTarget>(MANAGE_TARGET_KEY, context.getHandler());
    if (!target) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const workspaceId = request.workspaceId as string | undefined;
    const permissions = request.workspacePermissions as readonly WorkspacePermission[] | undefined;
    const id = request.params?.[target.param] as string | undefined;

    if (!user || !workspaceId) {
      // WorkspaceRoleGuard did not run — fail closed rather than guess.
      throw new ForbiddenException('Workspace access could not be verified.');
    }

    const owner = id ? await this.findOwner(target.resource, workspaceId, id) : null;
    if (!owner) {
      throw new NotFoundException(
        target.resource === 'workflow' ? 'Workflow not found.' : 'AI entity not found.',
      );
    }

    if (!canManageOwnedAIResource(owner.creatorId, { userId: user.id, permissions })) {
      throw new ForbiddenException(
        `Only this ${owner.noun}'s creator or a workspace admin can change it.`,
      );
    }
    return true;
  }

  private async findOwner(
    resource: ManagedResource,
    workspaceId: string,
    id: string,
  ): Promise<{ creatorId: string | null; noun: string } | null> {
    if (resource === 'workflow') {
      const row = await this.prisma.automationWorkflow.findFirst({
        where: { id, workspaceId },
        select: { creatorId: true },
      });
      return row ? { creatorId: row.creatorId, noun: 'workflow' } : null;
    }
    const row = await this.prisma.aIAgent.findFirst({
      where: { id, workspaceId },
      select: { creatorId: true, type: true },
    });
    return row
      ? { creatorId: row.creatorId, noun: row.type === 'coworker' ? 'coworker' : 'agent' }
      : null;
  }
}
