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

For chat, add a homeserver — `npm run start:chat` does all three:

```sh
npm run matrix:start          # throwaway Synapse on :8008
npm run matrix:setup          # grant the appservice sender admin rights
npm run dev
```

`matrix:setup` is required, not a convenience: minting the browser's login token
goes through Synapse's admin API, which checks *server admin* rights rather than
appservice rights, so without it `POST /matrix/session` returns 502. See
[docker/matrix/README.md](docker/matrix/README.md). Set `MATRIX_ENABLED="false"`
to run without a homeserver — the app is fully functional and reports chat as
unavailable.

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
              design-system, ui, api-client, hooks, realtime, chat-ui,
              analytics-ui
  web/        auth, layout, workspace, channels, members, invitations,
              profile, settings, dashboard, search, upload, notifications,
              chat, analytics
  admin/      layout, analytics, enterprise, marketplace
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
| `npm run start:chat` | Synapse + admin grant + API and web        |
| `npm run matrix:*`   | `start`, `setup`, `logs`, `stop`, `reset`  |

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

**Admin console.** Anything that is *not* scoped to a workspace lives in
`apps/admin`, not behind a role check in the web app: platform operations
(health, performance, error tracking), enterprise governance (SSO, audit log)
and marketplace catalogue administration. The split is enforced by the
`scope:admin` tag rather than by a route guard a future change could forget —
`scope:admin` cannot reach `scope:web`, so a console screen physically cannot
resolve "the current workspace". Screens whose data needs one — usage,
storage, AI spend, reports, installing a listing — stay in the web app for that
reason. Presentational code shared by both sides moves to `scope:shared`, which
is why `@org/analytics-ui` exists.

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
optional — with `MATRIX_ENABLED=false` the app runs unchanged and reports chat
as unavailable.

The homeserver URL handed to the browser is the configured
`MATRIX_HOMESERVER_URL`, not one derived from `MATRIX_SERVER_NAME`. The two are
different things — the server name is the Matrix identity inside user and room
ids (`localhost`), while the client needs a dialable address that carries a
scheme and, locally, a port (`http://localhost:8008`).

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
