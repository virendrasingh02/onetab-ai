import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
    /**
     * An explicit shadow database is required here.
     *
     * `prisma dev` serves the application database from a Postgres instance
     * whose `template1` already carries our schema — and Postgres clones
     * `template1` for every `CREATE DATABASE`. Without this, the shadow
     * database Prisma creates for `migrate dev` starts with our types already
     * defined and replaying the first migration fails with "type already
     * exists". The dev server exposes a separate instance on :51215 for
     * exactly this purpose.
     */
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
});
