# @org/api-common

Framework utilities shared by every API feature module.

## Design

Deliberately free of database and feature dependencies (tagged `type:util`), so it can be imported anywhere in the API without creating a cycle.

## Surface

- `ZodValidationPipe` / `zodBody()` — validates request bodies against the shared `@org/validation` schemas.
- `HttpExceptionFilter` — normalises every failure into one `ApiErrorBody` shape.
- Decorators — `@Public()`, `@CurrentUser()`, `@WorkspaceRoles()`, `@WorkspaceId()`.
- Tokens — `generateToken`/`hashToken` for refresh, reset and invitation secrets.
- Serializers — Prisma row to DTO mappers that strip credentials and stringify dates.

## Notes

Serializers accept structural shapes, not Prisma types — that is what keeps this library database-free.

## Commands

```sh
nx test @org/api-common
nx lint @org/api-common
nx typecheck @org/api-common
```
