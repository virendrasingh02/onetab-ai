# @org/database

Prisma client, PrismaService and PrismaModule.

## Design

Owns the single database connection for the process. Prisma 7 connects through the node-postgres driver adapter rather than its own pool, so pool sizing comes from the connection string.

## Surface

- `PrismaService` — extends the generated `PrismaClient`; connects on module init, disconnects on destroy.
- `PrismaModule` — `@Global()`, so feature modules inject `PrismaService` without re-importing.
- Re-exports the generated model types so nothing reaches into `src/generated` by path.

## Notes

The generated client is gitignored. Run `npm run db:generate` after changing `prisma/schema.prisma`.

## Commands

```sh
nx test @org/database
nx lint @org/database
nx typecheck @org/database
```
