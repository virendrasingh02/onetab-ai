import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type {
  SystemRole,
  WorkspacePermission,
  WorkspaceRole,
} from '@org/types';

/** Identity attached to the request by JwtStrategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  /** Platform-wide role. Workspace permissions come from WorkspaceRoleGuard. */
  systemRole: SystemRole;
  /** Active session ID from token claim. */
  sid?: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
/** Opts a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const SYSTEM_ROLES_KEY = 'systemRoles';
/**
 * Restricts a route to platform operators.
 *
 * For administration that is not scoped to any one workspace — where
 * `WorkspaceRoleGuard` has no workspace to resolve and so cannot help.
 */
export const SystemRoles = (...roles: SystemRole[]) =>
  SetMetadata(SYSTEM_ROLES_KEY, roles);

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';
/**
 * Minimum workspace role required for the route. Applied by
 * `WorkspaceRoleGuard`, which resolves the caller's membership first.
 */
export const WorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);

export const WORKSPACE_PERMISSIONS_KEY = 'workspacePermissions';
/**
 * Capabilities the route requires, all of which the caller must hold.
 *
 * Prefer this to `@WorkspaceRoles()` for anything new. A route that asks for
 * `MANAGE_MEMBERS` keeps saying what it means when the role table changes,
 * whereas "at least ADMIN" silently becomes wrong the moment a role exists
 * that outranks ADMIN without managing members. Enforced by
 * `WorkspaceRoleGuard` against the shared grant table in `@org/types`.
 */
export const RequireWorkspacePermissions = (
  ...permissions: WorkspacePermission[]
) => SetMetadata(WORKSPACE_PERMISSIONS_KEY, permissions);

export const ALLOW_ARCHIVED_KEY = 'allowArchivedWorkspace';
/**
 * Lets a route run against an archived workspace.
 *
 * Archiving freezes writes, so mutating routes are refused by default. The
 * handful that must still work — unarchiving it, deleting it, leaving it —
 * opt back in with this.
 */
export const AllowArchivedWorkspace = () =>
  SetMetadata(ALLOW_ARCHIVED_KEY, true);

/** Injects the authenticated user, or one of its fields. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    return field ? user?.[field] : user;
  },
);

/**
 * Injects the resolved workspace id for the route.
 *
 * `WorkspaceRoleGuard` already looked the workspace up to check permissions,
 * so handlers reuse that instead of re-parsing the param.
 */
export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspaceId as string | undefined;
  },
);

/** Injects the caller's role in the resolved workspace. */
export const WorkspaceMemberRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspaceRole as WorkspaceRole | undefined;
  },
);

/**
 * Injects every permission the caller holds in the resolved workspace.
 *
 * For handlers that shape a response by capability — returning the actions a
 * client may offer — rather than gating the route outright.
 */
export const WorkspacePermissions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspacePermissions as
      | readonly WorkspacePermission[]
      | undefined;
  },
);

export const REQUIRE_PLAN_KEY = 'requirePlan';
/**
 * Minimum plan tier required for this route (e.g. 'pro', 'business', 'enterprise').
 */
export const RequirePlan = (plan: 'starter' | 'pro' | 'business' | 'enterprise') =>
  SetMetadata(REQUIRE_PLAN_KEY, plan);

export const REQUIRE_PLAN_FEATURE_KEY = 'requirePlanFeature';
/**
 * Specific plan feature required for this route (e.g. 'custom_llm', 'audit_logs').
 */
export const RequirePlanFeature = (feature: string) =>
  SetMetadata(REQUIRE_PLAN_FEATURE_KEY, feature);

/**
 * Injects the resolved workspace plan tier.
 */
export const WorkspacePlan = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspacePlan as string | undefined;
  },
);

