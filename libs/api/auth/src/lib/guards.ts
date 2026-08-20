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
  ALLOW_ARCHIVED_KEY,
  IS_PUBLIC_KEY,
  SYSTEM_ROLES_KEY,
  WORKSPACE_PERMISSIONS_KEY,
  WORKSPACE_ROLES_KEY,
  type AuthenticatedUser,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  MembershipStatus,
  SystemRole,
  WorkspacePermission,
  WorkspaceRole,
  WorkspaceStatus,
  hasWorkspaceRole,
  permissionsForRole,
  roleHasPermission,
} from '@org/types';

/** HTTP methods that change state, and so are refused on a frozen workspace. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
 * The account context for a request: resolves the workspace named in the
 * route, proves the caller belongs to it, and enforces what their role allows.
 *
 * Accepts either `:workspaceId` or `:workspaceSlug`, and caches the resolved
 * workspace id, role and permission set on the request so handlers do not
 * repeat the lookup.
 *
 * The workspace is only ever read from the route — never from a body or a
 * header — and membership is re-checked on every request rather than carried
 * in the JWT, so revoking someone takes effect on their next call instead of
 * at their next login.
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
      select: { id: true, status: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      select: { role: true, status: true },
    });

    // Report a missing membership as 404, not 403: confirming that a workspace
    // exists to a non-member is itself a disclosure. A suspended member is
    // told the same thing — they are, for now, not a member.
    if (!membership || membership.status === MembershipStatus.SUSPENDED) {
      throw new NotFoundException('Workspace not found.');
    }

    const role = membership.role as WorkspaceRole;

    // An archived workspace stays readable so its history is not stranded, but
    // refuses writes. Checked on the HTTP method rather than per route, so a
    // new endpoint is frozen by default instead of by remembering to say so.
    if (
      workspace.status === WorkspaceStatus.ARCHIVED &&
      MUTATING_METHODS.has(request.method) &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_ARCHIVED_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      throw new ForbiddenException(
        'This workspace is archived. Restore it to make changes.',
      );
    }

    this.assertRole(context, role);
    this.assertPermissions(context, role);

    request.workspaceId = workspace.id;
    request.workspaceRole = role;
    request.workspacePermissions = permissionsForRole(role);
    return true;
  }

  /** Legacy `@WorkspaceRoles(...)` gate — the lowest listed role wins. */
  private assertRole(context: ExecutionContext, role: WorkspaceRole): void {
    const required = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return;

    const minimum = required.reduce((lowest, candidate) =>
      hasWorkspaceRole(lowest, candidate) ? candidate : lowest,
    );
    if (!hasWorkspaceRole(role, minimum)) {
      throw new ForbiddenException(
        `This action requires the ${minimum} role or higher.`,
      );
    }
  }

  /** `@RequireWorkspacePermissions(...)` — every listed capability is needed. */
  private assertPermissions(
    context: ExecutionContext,
    role: WorkspaceRole,
  ): void {
    const required = this.reflector.getAllAndOverride<WorkspacePermission[]>(
      WORKSPACE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return;

    const missing = required.filter(
      (permission) => !roleHasPermission(role, permission),
    );
    if (missing.length > 0) {
      throw new ForbiddenException(
        `You do not have permission to do this (requires: ${missing.join(', ')}).`,
      );
    }
  }
}
