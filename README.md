# OneTab AI

Workspace and channel collaboration platform. Nx monorepo with a React 19 web
client, a NestJS 11 API and a shared design system.

**Phase 2 — Platform Foundation** is complete: workspaces, channels, members,
invitations, profiles, settings, theming and a JWT authentication flow.

**Phase 3 — Real-Time Communication** is complete: messaging, threads, presence,
receipts, reactions, media and voice notes, push notifications, end-to-end
encryption and device verification, built on Matrix. AI arrives in a later phase.

---

## Quick start

```sh
npm install
cp .env.example .env          # then fill in the values

npx prisma dev                # local Postgres (or point DATABASE_URL elsewhere)
npm run db:migrate            # apply migrations
npm run db:generate           # generate the Prisma client

npm run dev                   # API on :3000, web on :4200
```

| App   | URL                            |
| ----- | ------------------------------ |
| web   | `http://localhost:4200`        |
| admin | `http://localhost:4201`        |
| API   | `http://localhost:3000/api/v1` |

`GET /api/v1/health` reports process and database health.

---

## Layout

```text
apps/
  web/        React 19 + Vite 8 client
  admin/      internal admin console
  api/        NestJS 11 API (webpack + SWC)
  api-e2e/    API end-to-end tests (Vitest)
libs/
  shared/     types, validation, utils, config, constants, common,
              design-system, ui, api-client, hooks, realtime, chat-ui
  web/        auth, layout, workspace, channels, members, invitations,
              profile, settings, dashboard, search, upload, notifications,
              chat
  api/        database, common, auth, user, workspace, channel, member,
              matrix
packages/
  matrix-client/  the only door to Matrix (wraps matrix-js-sdk)
```

Every library carries a `README.md` describing its design decisions and surface.

### Module boundaries

Projects are tagged and the rules are enforced by
`@nx/enforce-module-boundaries` — a violation fails `nx lint`, not review.

| Tag                | May depend on                         |
| ------------------ | ------------------------------------- |
| `scope:shared`     | `scope:shared`                        |
| `scope:web`        | `scope:web`, `scope:shared`           |
| `scope:admin`      | `scope:admin`, `scope:shared`         |
| `scope:api`        | `scope:api`, `scope:shared`           |
| `type:feature`     | feature, ui, data-access, util, types |
| `type:ui`          | ui, util, types                       |
| `type:data-access` | data-access, util, types              |
| `type:util`        | util, types                           |
| `type:types`       | types                                 |

---

## Scripts

| Command              | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | API + web in watch mode                    |
| `npm run dev:all`    | API + web + admin                          |
| `npm run validate`   | lint, typecheck, test and build everything |
| `npm run affected`   | the same, limited to affected projects     |
| `npm test`           | unit tests (Vitest)                        |
| `npm run e2e`        | API end-to-end tests                       |
| `npm run graph`      | interactive project graph                  |
| `npm run db:migrate` | create and apply a migration               |
| `npm run db:studio`  | Prisma Studio                              |

---

## Architecture notes

**Authentication.** Short-lived JWT access tokens are held in memory only; the
refresh token is an opaque secret stored as a SHA-256 digest and delivered as an
httpOnly cookie scoped to `/api/v1/auth`. Refresh tokens rotate on every use, and
replaying a spent token revokes the whole session family. A password change
revokes every session.

**Authorization.** `JwtAuthGuard` is registered globally, so routes are
authenticated by default and must opt out with `@Public()`. `WorkspaceRoleGuard`
resolves the caller's membership and enforces `@WorkspaceRoles(...)`. Non-members
receive **404, not 403** — confirming that a workspace or private channel exists
is itself a disclosure.

**Validation.** Zod schemas in `@org/validation` are the single source of truth.
The browser uses them through `@hookform/resolvers`; the API uses the same
objects through `ZodValidationPipe`, so a rule cannot drift between the two.

**State.** Server state lives in TanStack Query; Zustand holds only session
identity. Query keys are hierarchical, so invalidating a subtree clears
everything beneath it.

**Styling.** Tailwind v4 with no config file — tokens are CSS custom properties
in `@org/design-system`, exposed through `@theme inline`. Library sources are
registered with `@source` in each app's `styles.css`, otherwise their classes are
tree-shaken away.

**Performance.** Routes are lazily loaded and vendor code is split into stable
chunks (`vendor-react`, `vendor-data`, `vendor-forms`, `vendor-ui`), so shipping
a feature does not invalidate the browser cache for React.

**Messaging.** Matrix is the communication engine, not the source of truth. Chat
is the default tab on a channel, mounted as `<ChannelChat>` from `@org/web-chat`
— the seam that keeps Matrix out of `@org/web-channels`, which passes a channel
id and gets a conversation back. All SDK access is confined to
`@org/matrix-client`, which exposes domain objects and one typed event stream —
an isolation the package asserts in its own tests, so a convenience re-export
cannot quietly couple the app to `matrix-js-sdk`. The
browser never holds a Matrix password: it exchanges our session for a single-use
login token via `POST /matrix/session`. Our database stores workspace metadata,
preferences, pins and activity; message content is not duplicated. Chat is
optional — with `MATRIX_ENABLED=false` (the default) the app runs unchanged and
reports chat as unavailable.

---

## Platform notes

Three decisions worth knowing before changing the build:

- **The API compiles with SWC, not ts-loader.** ts-loader compiles the app and
  every workspace library it imports as one flat program, which trips TS6059
  because those libraries live outside `apps/api`. Types are still checked — by
  the `typecheck` target, which uses TypeScript project references properly. A
  small webpack plugin raises SWC's target to ES2022; at Nx's default the
  downlevelled `PrismaService extends PrismaClient` throws at boot.

- **The Prisma client is generated as CommonJS** (`moduleFormat = "cjs"`). The
  default ESM output uses `import.meta.url`, which is a syntax error under the
  CJS target the API bundles to.

- **Vitest specs rely on `globals: true`** rather than importing from `vitest`
  directly. On Windows, Nx invokes the runner with a lowercase drive letter while
  Node resolves an uppercase one, and an explicit import resolves a second,
  uninitialised vitest instance.
