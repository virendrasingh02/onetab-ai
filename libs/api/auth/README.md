# @org/api-auth

Authentication, session management and authorization guards.

## Design

Short-lived JWT access tokens plus rotating opaque refresh tokens. Only SHA-256 digests of refresh tokens are stored.

## Surface

- `POST /auth/register|login|refresh|logout`, `GET /auth/me`, `POST /auth/forgot-password|reset-password|change-password`.
- `JwtAuthGuard` — registered globally in `AppModule`; routes are authenticated by default and opt out with `@Public()`.
- `WorkspaceRoleGuard` — resolves the caller membership from `:workspaceId`/`:workspaceSlug` and enforces `@WorkspaceRoles()`.
- `TokenService` — issues and rotates the pair; replaying a spent refresh token revokes the whole session family.

## Notes

The refresh token is an httpOnly cookie scoped to `/api/v1/auth` and never appears in a response body.

## Commands

```sh
nx test @org/api-auth
nx lint @org/api-auth
nx typecheck @org/api-auth
```
