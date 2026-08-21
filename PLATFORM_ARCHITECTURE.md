# PLATFORM_ARCHITECTURE.md

> Derived from the codebase at `D:\Onetab-AI\onetab-ai` on 2026-08-21.
> Every claim below is a statement about what the code does, not about what the
> README or a module comment says it does. Where the two disagree, the
> disagreement is called out.

---

## 1. Shape of the repository

Nx monorepo, npm workspaces, TypeScript throughout, ESM (`.js` import
specifiers on relative paths).

```
apps/
  api/        NestJS 11 (webpack + SWC)   — 4 source files, everything lives in libs/api
  web/        React 19 + Vite 8           — 10 source files, routing only
  admin/      internal admin console      — 7 source files
  desktop/    Electron shell              — 24 source files
  api-e2e/    Vitest API e2e              — 5 spec files
libs/
  api/        22 Nest libraries           — 326 files
  web/        20 React feature libraries  — 411 files
  shared/     14 cross-cutting libraries  — 264 files
  admin/      4 admin feature libraries   —  48 files
packages/
  matrix-client/  the only door to Matrix — 21 files
prisma/       schema.prisma (996 lines, 44 models, 13 enums), 11 migrations
docker/       Postgres/Redis compose + a throwaway Synapse
```

~291,000 lines of TypeScript across `apps/ + libs/ + packages/`.

---

## 2. Runtime topology

```
                 ┌───────────────────────┐
   Browser ──────│ apps/web (Vite :4200) │──── HTTP ───┐
                 └───────────────────────┘             │
                            │                          │
                            │ matrix-js-sdk            ▼
                            │              ┌──────────────────────────┐
                            │              │ apps/api (Nest :3000)    │
                            ▼              │  /api/v1/*               │
                 ┌──────────────────┐      │  JwtAuthGuard (global)   │
                 │ Synapse :8008    │◀─────│  ThrottlerGuard (global) │
                 │ (Matrix)         │  AS  │  HttpExceptionFilter     │
                 └──────────────────┘ ─────▶└──────────────────────────┘
                                       │                │
                     appservice txns ──┘                │ Prisma
                                                        ▼
                                            ┌──────────────────────┐
                                            │ PostgreSQL           │
                                            └──────────────────────┘
                                                        │
                                     optional, degraded ▼
                            Redis (cache lib)   ·   local disk (.storage)
                            Ollama (AI, best-effort)  ·  Qdrant (declared, never called)
```

**What is real and load-bearing:** Postgres, the Nest API, the React client,
Synapse, the local filesystem for uploads.

**What is declared but not connected:** Qdrant (vector search), Meilisearch
(full-text), MinIO/S3 (object store), any queue, any scheduler, any AI provider
other than a best-effort local Ollama call. Each has a service wrapper whose
methods log and return an empty or fabricated value. Details in
`PLATFORM_AUDIT_REPORT.md` §7.

---

## 3. Backend layering

`apps/api/src/app/app.module.ts` imports 20 feature modules and installs three
global providers:

| Provider | Effect |
| --- | --- |
| `JwtAuthGuard` (APP_GUARD) | Every route authenticated by default; opt out with `@Public()` |
| `ThrottlerGuard` (APP_GUARD) | 120 req / 60 s default, env-tunable |
| `HttpExceptionFilter` (APP_FILTER) | One error body shape |

The layering per feature library is consistent:

```
*.controller.ts   route + DTO validation + guard decorators
*.service.ts      business logic, always takes workspaceId as its first argument
PrismaService     the only data access layer — there is no repository tier
```

There is **no repository layer, no domain layer, no event bus, no queue, and no
worker process.** Controllers call services, services call Prisma. That is the
whole backend architecture. It is simple and, for the modules that are finished,
correct — but it means anything that needs to happen *after* a write (notify,
index, log activity, trigger a workflow) has nowhere to hook, which is the root
cause of most of the disconnections catalogued in the audit report.

### 3.1 The authorization model — the strongest part of the codebase

`libs/api/auth/src/lib/guards.ts` defines three guards:

- **`JwtAuthGuard`** — global, fail-closed.
- **`SystemRoleGuard`** — platform-operator gate, fail-closed (a route carrying
  the guard without `@SystemRoles(...)` admits nobody). Returns 404, not 403.
- **`WorkspaceRoleGuard`** — the account context. Resolves `:workspaceId` or
  `:workspaceSlug` *from the route only*, re-reads membership from the database
  on every request (so revocation is immediate, not next-login), rejects
  `SUSPENDED` members as 404, freezes mutating HTTP methods on an `ARCHIVED`
  workspace, then enforces `@WorkspaceRoles(...)` and
  `@RequireWorkspacePermissions(...)`. It caches `workspaceId`, `workspaceRole`
  and `workspacePermissions` onto the request.

Services then take that authorized `workspaceId` and filter every query on it —
including queries that address a row by its own primary key. `WorkToolsService`
states the rule explicitly and follows it: `assertProject`, `assertTask`,
`assertEvent`, `assertDocument`, `assertWhiteboard`.

This design is sound. The gaps are not in the design; they are the specific
routes that sit outside `/workspaces/:workspaceId` and therefore never run the
guard (`/matrix/*`, `/users/:userId`, parts of `/marketplace`), and the
foreign-key fields that are written without a tenancy check. Both are
enumerated in the audit report §8.

### 3.2 API surface

19 controllers, 175 routes, all under `/api/v1`. Route families:

| Prefix | Controller | Guard posture |
| --- | --- | --- |
| `auth` | AuthController | `@Public()` on register/login/refresh/forgot/reset |
| `users`, `workspaces/:id/users` | UserController | **`GET /users/:userId` has no workspace guard** |
| `workspaces` | WorkspaceController | per-route `WorkspaceRoleGuard`; `GET :id/logo` is `@Public()` |
| `workspaces/:id/channels` | ChannelController | class-level `WorkspaceRoleGuard` |
| `workspaces/:id/members`, `/invitations` | MemberController | class-level |
| `workspaces/:id/work-tools` | WorkToolsController | class-level |
| `workspaces/:id/agents` | AgentsController | class-level |
| `workspaces/:id/automations` | AutomationsController | class-level |
| `workspaces/:id/ai`, `/prompt-templates` | AI controllers | class-level |
| `workspaces/:id/integrations` | IntegrationsController | class-level |
| `workspaces/:id/uploads` | UploadController | class-level |
| `workspaces/:id/search` | SearchController | class-level |
| `workspaces/:id/notifications` | NotificationsController | class-level |
| `analytics` | AnalyticsController | **per-route**, mixed `SystemRoleGuard` / `WorkspaceRoleGuard` |
| `marketplace` | MarketplaceController | **per-route**, several routes ungated |
| `matrix` | MatrixController | **no guard** — checks are inside the service |
| `matrix/appservice` | MatrixAppserviceController | `@Public()`, `hs_token` compared in the handler |
| `enterprise` | EnterpriseController | class-level `SystemRoleGuard` |
| `admin` | AdminController | class-level `SystemRoleGuard` |

---

## 4. Frontend layering

```
apps/web/src/app/app.tsx        the entire route table (63 route entries)
  └─ ProtectedRoute / PublicOnlyRoute
       └─ AppShell (libs/web/layout)   sidebar + header + right panel
            └─ 40 feature views from libs/web/*

libs/shared/api-client            http.ts (axios + refresh) · endpoints.ts (1378 lines)
                                  query-keys.ts (TanStack Query key factory)
libs/shared/ui, design-system     Radix + Tailwind component kit
libs/shared/chat-ui, realtime     message rendering, presence
libs/shared/types, validation     Zod schemas shared with the API
packages/matrix-client            wraps matrix-js-sdk; the browser's only Matrix path
```

State management is layered three ways, deliberately:

1. **Server state** — TanStack Query over `libs/shared/api-client`. This is the
   dominant, well-built path: `endpoints.ts` maps essentially 1:1 onto the 137
   API routes.
2. **Session state** — Zustand (`auth.store.ts`), Redux Toolkit is a dependency
   but barely used.
3. **`localStorage`** — used as a *substitute for missing endpoints*, not just
   for preferences. This is the architectural problem on the client side; see §6.

### 4.1 Route table vs. product scope

63 `<Route>` entries exist (including layout wrappers). Eight of them (`/settings`, `/settings/*`, `/import-export`,
`/integrations/import`, `/billing`, `/plans`, `/analytics`, `/analytics/*`) all
render the **same** component, `WorkspaceSettingsPage` — a 2,589-line file in
`libs/web/workspace/src/lib/pages/`. `libs/web/settings` and `libs/web/profile`
are Nx libraries that contain nothing but a re-export of that component;
`libs/web/settings/src/lib/settings-layout.tsx` is a one-line re-export, and
`@org/web-settings` is imported by nothing at all.

---

## 5. Data architecture

`prisma/schema.prisma`: 44 models, 13 enums, 53 `@@index`, 10 `@@unique`,
50 `onDelete: Cascade`.

### 5.1 The tenancy spine

```
User ──< WorkspaceMember >── Workspace ──< everything else
                                 │
                                 ├── Channel ──< ChannelMember, ChannelPin, Upload, RecentActivity
                                 ├── Project ──< Milestone, Sprint, Task ──< TaskComment
                                 ├── WorkDocument (self-referencing tree), Whiteboard
                                 ├── CalendarEvent, Upload
                                 ├── AIAgent ──< AgentSchedule, AgentExecutionLog
                                 ├── AutomationWorkflow ──< WorkflowExecution
                                 ├── PromptTemplate, AIMemory, AIChatSession
                                 ├── ExternalIntegration, ImportJob
                                 ├── MarketplaceInstallation
                                 └── NotificationPreference, AnalyticsEvent
```

Every tenant-scoped model carries `workspaceId` with a cascading FK to
`Workspace`. That part is clean.

### 5.2 The enterprise island

```
Organization ──< Department
             ──< SSOConfig
             ──< EnterpriseAuditLog
             ──< OrganizationSubscription
```

**`Organization` has no relation to `Workspace` or to `User`.** There is no
`organizationId` on `Workspace`, no `Account` model, and no join table. The
"User → Account → Workspace" hierarchy in the product scope does not exist in
the schema; `Organization` is an isolated four-table subgraph reachable only
from `/api/v1/enterprise` and `/api/v1/admin`, both of which are gated to
platform operators. Consequences in the audit report §1 and §15.

### 5.3 Schema-level gaps

- **No soft deletion anywhere.** `deletedAt` appears zero times. `archivedAt`
  appears twice (Workspace, Channel). Combined with 50 cascading deletes,
  deleting a project irrecoverably deletes its milestones, sprints, tasks and
  task comments.
- **No audit columns** on tenant data — no `createdById` on `Task`,
  `CalendarEvent` or `Whiteboard`; no `updatedById` anywhere.
- **`Task` has no `parentTaskId`,** no dependency table, no recurrence fields,
  no custom-field storage, no attachment relation, no `completedAt`.
- **`WorkDocument` has no version table,** no comment table, no per-document ACL.
- **No `Meeting` model.** The Meetings screen is built on `CalendarEvent`.
- **No `ExportJob`** to pair with `ImportJob`.
- **Models without any `@@index`:** `User`, `ChatSettings`, `AIMemory`,
  `Organization`, `PluginRegistration`.
- **`AIMemory` and `AgentSchedule` have zero runtime references** outside the
  generated Prisma client and a TypeScript interface — they are schema-only.

---

## 6. Client-side persistence that stands in for the backend

`libs/shared/hooks/src/lib/workspace-registries.ts` says so in its own header
comment: *"Local storage stands in for endpoints that do not exist yet — the
same stopgap the project and doc trees use."*

| Concern | Where it actually lives | Keys |
| --- | --- | --- |
| Installed agents (sidebar) | browser `localStorage` | `onetab_installed_agents_v1` |
| Connected apps (sidebar) | browser `localStorage` | `onetab_connected_apps_v1` |
| Saved workflows (sidebar) | browser `localStorage` | `onetab_workflows_v1` |
| Agent Builder graph | browser `localStorage` | `libs/web/agents/.../use-agent-graph.ts` |
| Sidebar favourites / pinned nav | browser `localStorage` | `use-sidebar-favorites.ts` |
| Channel agents & apps + their message feed | in-memory seed + `localStorage` | `use-channel-agents-apps.ts` |

The first four are cross-device product state living in one browser. There is a
real `AIAgent` table and a real `AutomationWorkflow` table with working CRUD
endpoints behind them — the sidebar registries simply do not use them.

---

## 7. Matrix integration

`packages/matrix-client` is a genuine single door: three `createClient()` call
sites, all inside that package. The design is correct and the code is careful.

- **Provisioning** — `MatrixAdminService` uses either an appservice token or a
  server-admin account. Users are provisioned lazily on first chat use; the
  Matrix localpart is derived from the platform user id.
- **Sessions** — `POST /matrix/session` mints browser credentials; the browser
  never sees a Matrix password. Credentials are persisted client-side so a
  device is created once per browser, not once per page load.
- **Channel ↔ room** — `Channel.matrixRoomId` (unique, nullable). Created lazily
  by `linkChannelToRoom`, which correctly re-implements the membership check the
  guard would have done (public channel → workspace membership; private channel
  → channel membership), and returns 404 rather than 403.
- **DMs** — created entirely client-side via `getOrCreateDirectMessage`,
  recorded in `m.direct`. The server only resolves the peer's Matrix id.
- **Inbound** — `PUT /matrix/appservice/transactions/:txnId` receives Synapse
  transactions; `MatrixSyncService.handleTransaction` is the **only** writer of
  `RecentActivity` in the entire codebase.
- **Push** — `POST /matrix/appservice/notify` bridges Matrix pushes into
  `PushRegistration` rows.

Membership mirroring (`syncChannelMembership`) is best-effort and logs failures
with the comment *"reconciled later"* — there is no reconciler, because there is
no scheduler. See audit report §18.

---

## 8. Where the architecture is load-bearing vs. decorative

**Load-bearing and well-built:** the guard stack, the workspace tenancy rule in
services, the Prisma schema's tenancy spine, `packages/matrix-client`,
`libs/shared/api-client`, the design system, the auth/refresh flow, uploads,
channels, members, invitations, work-tools CRUD.

**Present but not connected to anything:** search indexing, notifications
beyond Matrix pushes, activity for non-chat events, RAG, agent tools, workflow
actions, import, marketplace installation effects.

**Decorative — renders convincingly but does nothing:** billing, the workflow
canvas Save button, Google Workspace connect, the channel AI-agent message feed,
the multi-provider AI layer.

The dividing line is almost exactly *Phase 3* in the README. Everything the
README claims as complete (Phases 2 and 3 — platform foundation and real-time
communication) is genuinely complete. Everything after it — the AI, agent,
automation, integration, marketplace and enterprise surface — is a UI shell over
a service layer that logs and returns placeholder values.

---

## 9. Build, test and CI posture

- `npm run validate` = `nx run-many -t lint typecheck test build`.
- **20 test files for ~291k LOC.** 5 API e2e specs (auth, health,
  infrastructure, workspace, workspace-isolation), 2 Electron specs, 13 unit
  specs mostly on `libs/shared/ui` primitives.
- **Zero tests** for: work-tools, agents, automations, AI, search,
  notifications, marketplace, integrations, analytics, storage, member,
  channel, matrix, admin, enterprise.
- `apps/api-e2e/src/api/workspace-isolation.spec.ts` is the only cross-tenant
  security test in the repository.
- Husky + lint-staged + commitlint are configured.

> **Baseline not captured.** `nx` could not be executed during this audit: the
> repository's `node_modules` contains the Windows-native Nx binary, and the
> session's shell into the connected folder is Linux (`TypeError:
> WorkspaceContext is not a constructor`). Run `npm run validate` on the
> Windows host to capture a real build/lint/typecheck/test baseline before any
> remediation begins.

---

## 10. Module dependency graph (API)

```
                    ┌─────────────┐
                    │  database   │◀── everything
                    └─────────────┘
                    ┌─────────────┐
                    │   common    │◀── decorators, filters, PUBLIC_USER_SELECT
                    └─────────────┘
  auth ─────────────▶ common, database
  user, workspace, member, channel ──▶ auth, common, database
  matrix ──▶ database, common          (+ Synapse admin API over HTTP)
  storage ──▶ database                 (+ local filesystem)
  search ──▶ database
  notifications ──▶ database
  ai ──▶ config                        (+ Ollama HTTP, Qdrant declared)
  agents ──▶ ai, database
  automations ──▶ ai, database
  work-tools ──▶ database
  integrations ──▶ database
  marketplace ──▶ database
  analytics ──▶ database, cache
  enterprise, admin ──▶ database
  infrastructure ──▶ cache (Redis)
```

Notice what is **absent** from this graph: nothing depends on `search` except
its own controller; nothing depends on `notifications` except its own
controller; `agents` and `automations` depend on `ai` but not on `work-tools`,
`channel` or `storage`, which is why agent tools re-implement task and document
writes against raw Prisma instead of calling the services that enforce the
rules.
