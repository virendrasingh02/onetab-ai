import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  IS_PUBLIC_KEY,
  SYSTEM_ROLES_KEY,
  WORKSPACE_ROLES_KEY,
  type AuthenticatedUser,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import { SystemRole, WorkspaceRole, hasWorkspaceRole } from '@org/types';

/**
 * Applied globally in `AppModule`, so routes are authenticated by default and
 * must opt out with `@Public()`. Defaulting to closed means a new endpoint
 * cannot be accidentally exposed by forgetting a decorator.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/**
 * Enforces `@SystemRoles(...)` — the platform-operator gate.
 *
 * For administration that belongs to no single workspace, where
 * `WorkspaceRoleGuard` has nothing to resolve. Fails closed: a route carrying
 * this guard without the decorator admits nobody, so a missing annotation
 * cannot silently open an operator endpoint to every signed-in account.
 */
@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Authentication is required.');

    const required = this.reflector.getAllAndOverride<SystemRole[]>(
      SYSTEM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length || !required.includes(user.systemRole)) {
      // 404, not 403: that these endpoints exist is not worth confirming to
      // an account that may not use them.
      throw new NotFoundException('Not found.');
    }

    return true;
  }
}

/**
 * Resolves the caller's membership of the workspace named in the route and
 * enforces the minimum role from `@WorkspaceRoles(...)`.
 *
 * Accepts either `:workspaceId` or `:workspaceSlug`, and caches the resolved
 * workspace id and role on the request so handlers do not repeat the lookup.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Authentication is required.');

    const { workspaceId, workspaceSlug } = request.params ?? {};
    if (!workspaceId && !workspaceSlug) {
      throw new NotFoundException('No workspace was specified.');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: workspaceId ? { id: workspaceId } : { slug: workspaceSlug },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      select: { role: true },
    });

    // Report a missing membership as 404, not 403: confirming that a workspace
    // exists to a non-member is itself a disclosure.
    if (!membership) throw new NotFoundException('Workspace not found.');

    const required = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const role = membership.role as WorkspaceRole;

    if (required?.length) {
      const minimum = required.reduce((lowest, candidate) =>
        hasWorkspaceRole(lowest, candidate) ? candidate : lowest,
      );
      if (!hasWorkspaceRole(role, minimum)) {
        throw new ForbiddenException(
          `This action requires the ${minimum} role or higher.`,
        );
      }
    }

    request.workspaceId = workspace.id;
    request.workspaceRole = role;
    return true;
  }
}
