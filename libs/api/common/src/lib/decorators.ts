import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { WorkspaceRole } from '@org/types';

/** Identity attached to the request by JwtStrategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
/** Opts a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';
/**
 * Minimum workspace role required for the route. Applied by
 * `WorkspaceRoleGuard`, which resolves the caller's membership first.
 */
export const WorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);

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
