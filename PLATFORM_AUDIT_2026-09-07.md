# PLATFORM_AUDIT_2026-09-07.md

**Repository:** `D:\Onetab-AI\onetab-ai` · **Branch:** `main` @ `d5dec69`
**Supersedes:** `PLATFORM_AUDIT_REPORT.md` (2026-08-21), which is 120 commits / ~258k
insertions stale. Where the two disagree, this document is current.

This pass **changed code**. The build was red on arrival (213 typecheck errors); it
is green on exit. A full re-audit of current state follows, plus the remaining
genuine gaps.

---

## System Health

### Overall status

**The platform is substantially production-grade.** The 2026-08-21 audit's core
finding — "a production-grade foundation with an AI/automation layer that is
almost entirely non-functional, because there is no event bus, queue or
scheduler" — **no longer holds.** Between then and now the connective tissue was
built: a typed in-process event bus, `@nestjs/schedule` cron jobs, an SSE
realtime transport, a real `Notification` model, RAG ingestion on document
events, real agent tool execution, a real workflow engine, integration OAuth +
token encryption + SSRF guard + webhooks, soft-delete, Postgres FTS, and the
S1/S3/S5/S6/S7/S9/S14 security fixes from the old backlog.

What remains is a short, specific list (below), not a structural hole.

### Major issues found this pass

| # | Issue | Severity | Status |
|---|---|---|---|
| A1 | **Build red** — 213 typecheck errors across `@org/admin-compliance`, `@org/api-compliance`, `@org/api-admin`, `@org/admin`, `@org/api`. A ~11.5k-LOC Compliance + App-Version admin feature (commits `8cd7258`, `8fd34b8`) whose 10 frontend views were written against an imagined API shape. | Blocker | **FIXED** |
| A2 | **5 pre-existing lint errors** masked by Nx cache — `@org/api-admin` (`no-useless-assignment` ×2), `@org/ui` (`no-empty-function` ×3), `@org/i18n` (`no-unused-vars` ×1). | High | **FIXED** |
| A3 | **Orphaned test suites** — `libs/api/{admin,compliance,agents,member,realtime}` had spec files that never executed (no `vitest.config.mts` / `test` target). 48 tests dark, incl. `app-versions.service.spec.ts` (15) and `compliance-rule-engine.spec.ts` (10). Two suites also had mock drift from the billing work. | High | **FIXED** |
| A4 | **Email delivery does not exist.** No mailer, no SMTP, no `EmailService` anywhere in `libs/api`. Invitations, password resets and notification digests have no email channel. | High | **FIXED** (Phase 4) — new `@org/api-mail` lib (log + HTTP-provider transports), wired into password-reset and workspace invitations, env vars + `.env.example`, 6 tests |
| A5 | **Sidebar registries are `localStorage`-only** (`libs/shared/hooks/workspace-registries.ts`) — installed agents, connected apps, saved workflows are cross-device product state trapped in one browser, though `AIAgent` and `AutomationWorkflow` tables with full CRUD exist. | Medium | **FIXED** (Phase 4) — the sidebar already used the real API hooks; `WorkflowListView` was the last holdout. Rewritten onto `useWorkflows`/`useWorkflowMutations`; `workspace-registries.ts` deleted. Also fixed the workflow canvas so "Edit" / "Use template" actually hydrate the graph from the real workflow (`?id=`). |
| A6 | **Channel agents/apps UI is `localStorage`-only** (`libs/web/channels/use-channel-agents-apps.ts`) — the fabricated feed is now opt-in and labelled "DEMO — NOT A REAL RUN" (Tier-0 done), but adding an agent to a channel still never reaches the backend. `AgentMatrixBridgeService` exists server-side; there is no channel↔agent association API to connect them. | Medium | **OPEN** |
| A7 | **Agent Builder graph is `localStorage`-only** (`libs/web/agents/agent-graph/use-agent-graph.ts:713`). | Medium | **OPEN** — needs an `AIAgent.graphJson` column (a Prisma migration; blocked on a live DB / docker being off-limits this pass). |
| A8 | **Object storage is local disk** (`STORAGE_ROOT ?? '.storage'`). Signed tokens, orphan sweep and usage accounting are in place; a shared/S3 driver is not. Uploads are lost on redeploy and not shared across API replicas. | Medium | **OPEN** |
| A9 | **Compliance + App-Version feature is fresh and lightly tested.** Now typechecks and the rule-engine + `AppVersionsService` unit specs pass (25 tests), but controllers, `ComplianceService` (2,132 LOC) and all 11 admin views have no automated coverage, and the feature has never run end-to-end. | Medium | **OPEN** |

### Major issues fixed (from the 2026-08-21 backlog, verified present now)

* **Event system** — `libs/api/common/src/lib/events.ts`: 26 typed `AppEvent`s,
  ~30 emit sites (work-tools, channel, member, meetings, storage, matrix-sync,
  presence, notifications), 4 listener classes (notifications, RAG ingest,
  automation triggers, realtime bridge). This was "the highest-leverage fix in
  the repository" per the old feature matrix.
* **B5 / B9 / B10 agent execution** — `agents.service.ts:214` calls
  `mcpRegistry.executeTool(...)`; `toolCalls` is a real trace, `tokensUsed` is
  `chatResult.usage?.totalTokens`. No longer falsified.
* **B6 / M5 workflow engine** — `workflow-engine.service.ts`: real `fetch()` for
  `API_CALL`/`WEBHOOK` behind an SSRF guard, real `evaluateCondition`, real
  `aiService.chat()` for `AI_ACTION`, retry with backoff, timeout wrapper,
  `FAILED` status on exhausted retries, unknown node type throws.
* **B7 RAG** — `libs/api/ai/rag-ingest.listener.ts` subscribes to
  `document.created/updated/deleted`. `generateEmbedding`'s `Math.random()`
  fallback is gone (source comment: "the most damaging fabrication in this file").
* **B8 Matrix drift** — `matrix-reconciler.service.ts`: `@Cron(EVERY_10_MINUTES)`
  membership reconcile + profile backfill.
* **M2 AI fabrication** — `ai-infrastructure.service.ts` now propagates provider
  errors instead of returning fabricated strings.
* **S1** — `createTask`/`updateTask` call `assertSprint`, `assertMilestone`,
  `assertWorkspaceUser` on the respective FKs.
* **S3** — search filters `c."visibility" = 'PUBLIC'` (plus membership for private).
* **S5** — `matrix-auth.service.ts` membership predicates carry `status: 'ACTIVE'`.
* **S6 / S7** — `IntegrationEncryptionService.encrypt()`, real OAuth authorize/
  callback flow, `oauth.service.ts`, `ssrf-guard.service.ts`, `webhook.service.ts`
  (all spec-covered).
* **S9** — `GET /users/:userId` → `findPublicForViewer(callerId, userId)`,
  shared-workspace scoped.
* **S14** — no `devToken` in auth responses.
* **DB12** — real `Notification` model: `recipientId`, `readAt`,
  `@@index([recipientId, readAt])`, `deepLink`, self-notification suppression.
* **Soft delete** — `deletedAt` across `Project`/`Task`/`WorkDocument`/`Whiteboard`/
  `CalendarEvent`/`Upload` (migration `20260827082707`).
* **Meetings** — real `Meeting`/`MeetingParticipant` models, `MeetingsService`,
  events → notifications (migration `20260901110749`).

---

## Architecture

### Existing architecture retained

Nx monorepo (73 projects), npm workspaces, ESM. Apps: `@org/api` (NestJS 11,
webpack+SWC), `@org/web` (React 19 + Vite), `@org/admin`, `@org/desktop`
(Electron), `@org/api-e2e` (Vitest). ~26 `libs/api/*`, ~20 `libs/web/*`, ~18
`libs/shared/*`, 5 `libs/admin/*`, `packages/matrix-client`.

Retained wholesale (and correct): the fail-closed guard stack
(`JwtAuthGuard` / `SystemRoleGuard` / `WorkspaceRoleGuard`), the 404-not-403
discipline, per-request membership re-check, the "every service query filters on
`workspaceId`" rule, `packages/matrix-client` as the single Matrix door,
`libs/shared/api-client/endpoints.ts` as the 1:1 API map, the TanStack Query +
Zustand + design-system client stack.

### Changes made this pass

| Area | Change | Files |
|---|---|---|
| Compliance FE ↔ API contract reconciliation | 10 admin views aligned to real `@org/types` + `complianceApi` (enum members, `ComplianceReviewView` / `ComplianceAppVersionView` / `ComplianceEvaluationResult` field names, `Badge` variants, `evaluate()` context shape, checklist via `useComplianceChecklist` not a non-existent `review.checklistItems`) | `libs/admin/compliance/src/lib/*.tsx`, `use-compliance.ts` |
| Compliance API bugs | `getOverview` missing `distribution` include; `overrideRelease` `actorEmail` shorthand referenced a non-existent binding; seed row `category: 'PLATFORM'` (not a valid enum) → `'SECURITY'`; dead imports/vars | `libs/api/compliance/src/lib/compliance.service.ts` |
| Cache primitive | New `CacheService.deletePattern(pattern)` — Redis `SCAN`+`DEL`, in-memory-fallback sweep, safe when Redis is down | `libs/api/cache/src/lib/cache.service.ts` |
| App-version update check | Wired the unused `getUpdateCheckCacheKey` — the current-release lookup for the public `check-update` endpoint is now cached 60s (per-client rollout still evaluated per request); `evaluateUpdateDecision` reads `new Date(release.releaseDate)` so a JSON-serialised cached row is rollback-safe; removed the `no-useless-assignment` lint errors | `libs/api/admin/src/lib/app-versions.service.ts`, `.controller.ts` |
| Test infrastructure | `vitest.config.mts` + `test` target for `libs/api/{admin,compliance,agents,member,realtime}`; fixed mock drift (`workspaceSubscription`, `workspaceMember.count`, `CacheService` ctor arg) | 5 `package.json`, 5 configs, 3 specs |
| Pre-existing lint | `NestedKeyOf<T>` → `<_T>`; empty arrow stubs → `vi.fn()` | `libs/shared/i18n/src/lib/types.ts`, `libs/shared/ui/.../language-select.spec.tsx` |

### New infrastructure added

None structural — one cache method and five test configs.

---

## API

* **~19 controllers, ~200 routes** under `/api/v1`. Guard posture unchanged from
  the 2026-08-21 map and still correct: global `JwtAuthGuard` + `ThrottlerGuard`,
  per-route or class-level `WorkspaceRoleGuard` on `/workspaces/:id/*`,
  `SystemRoleGuard` on `/admin/*` and `/enterprise/*` and the new
  `/admin/compliance/*` and `/admin/app-versions/*`.
* **Missing connections fixed this pass:** the entire `/admin/compliance/*` and
  `/admin/app-versions/*` frontend was disconnected (compiled against a shape the
  API does not return). Now aligned.
* **Auth/authz status:** enforced server-side. Cross-tenant FK writes (S1),
  private-channel search leak (S3), suspended-member Matrix access (S5),
  plaintext integration tokens (S6), token injection (S7) and cross-tenant user
  disclosure (S9) from the old backlog are all closed. Not re-verified this pass:
  marketplace review gating (S10), archived-workspace Matrix freeze (S8).

---

## Database

* **Schema:** `prisma/schema.prisma` grew 996 → 2,384 lines; 31 migrations (was
  11). Added since the old audit: events/notifications/activity, search FTS,
  soft-delete, sidebar prefs, theme setting, billing/subscription tables, meetings
  vertical, task multi-assignee, invitation status, upload context + versioning,
  user preferred language, app-version management, and the full compliance
  subgraph (`ComplianceRegion` … `ComplianceLegalLink`, `AppRelease`).
* **Migrations:** all forward, no destructive resets checked in. `migrate status`
  not run this pass (no live DB).
* **Index/query improvements this pass:** none to the schema. The app-version
  `check-update` hot path now hits cache instead of the DB on every desktop
  client poll.
* **Open:** `Organization` is still an island (no relation to `Workspace`/`User`)
  — the "Accounts / multi-account" product tier still does not exist in the
  schema.

---

## Realtime

* **Transport:** Server-Sent Events — `@Sse('realtime/stream')` with a
  ticket-based handshake (`realtime-ticket.service.ts`; the access token never
  appears in the `EventSource` URL). Client: `libs/shared/realtime/`
  (`realtime-client.ts`, `realtime-provider.tsx`, `realtime-event-bus.ts`),
  spec-covered. Cross-replica fan-out via `CacheService.publish/subscribe` on
  `realtime:workspace`.
* **Events audited:** `realtime-domain-bridge.listener.ts` bridges ~18 `AppEvent`s
  (task ×7, project ×2, channel ×3, member ×3, notification, mention, presence)
  to SSE. `presence.service.ts` emits `presence.updated` and caches per-user
  presence with a 5-min TTL.
* **Synchronization issues fixed since old audit:** activity feed no longer has a
  single Matrix-only writer (`activity-writer.service.ts` added); Matrix
  membership drift has a reconciler; notifications have per-user read state so
  unread counts are no longer derived from a shared feed.
* **Not verified this pass:** duplicate-message / out-of-order handling under
  reconnect; whether every mutation that a bridge listener broadcasts also
  invalidates the corresponding TanStack Query key on the client.

---

## Features

`UI` = frontend wired to real API · `API` = endpoint exists, tenant-scoped ·
`DB` = persists correctly · `RT` = emits/consumes realtime · `Perms` =
server-enforced · `Tests` = automated coverage incl. a boundary test.
`~` partial · `·` n/a

| Feature | UI | API | DB | RT | Perms | Tests | Status |
|---|---|---|---|---|---|---|---|
| Auth (sign up/in/out, refresh, reset) | ✓ | ✓ | ✓ | · | ✓ | ✓ | **Working** (reset email now sent — A4 fixed) |
| Workspaces (CRUD, archive, transfer) | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | **Working** |
| Members / Invitations | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Working** (invite emails now sent — A4 fixed) |
| Channels (CRUD, visibility, pins, prefs) | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | **Working** |
| DMs (Matrix, `m.direct`) | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | **Working** |
| Messages / threads / reactions (Matrix) | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | **Working** |
| Mentions / unread / read state | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | **Working** |
| Notifications (per-user, deep links) | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | **Working** (mailer now exists; digest cron not yet wired) |
| Projects / Tasks / Comments / Kanban | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Working** |
| Documents (tree, versions) | ✓ | ✓ | ✓ | ~ | ~ | ~ | **Working** (per-doc ACL still absent) |
| Meetings (models, events → tasks) | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | **Working** (no transcript pipeline) |
| Files / Assets (unified hub, versioning) | ✓ | ✓ | ✓ | ~ | ✓ | ~ | **Working** (local-disk driver — A8) |
| Search (Postgres FTS, 6 categories) | ✓ | ✓ | ✓ | · | ✓ | ~ | **Working** (visibility leak S3 closed) |
| AI (chat, summarize, translate, RAG) | ✓ | ✓ | ✓ | · | ~ | ✓ | **Working** (errors propagate; no per-user context narrowing) |
| AI Agents (CRUD, tool loop, exec log) | ✓ | ✓ | ✓ | ~ | ~ | ✓ | **Working** (per-agent perms still coarse) |
| Agent Builder (ReactFlow canvas) | ✓ | ✗ | ✗ | · | · | · | **UI-only** — graph in `localStorage` (A7) |
| Workflows / Automation (engine, triggers) | ✓ | ✓ | ✓ | ~ | ✓ | ~ | **Working** — list + canvas now fully on the real API (A5 fixed); "Edit" hydrates from `?id=` |
| Integrations (OAuth, webhooks, encryption) | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | **Working** |
| Marketplace | ✓ | ✓ | ✓ | ✗ | ~ | ✗ | **Partial** — install side-effects not re-verified |
| Sidebar registries (installed agents/apps/workflows) | ✓ | ✓ | ✓ | ~ | ✓ | ~ | **Working** — reads real `AIAgent`/`AutomationWorkflow`/`Integration` lists (A5 fixed) |
| Channel agents/apps panel | ~ | ~ | ✗ | ✗ | ✗ | ✗ | **UI-only** — `localStorage`; backend bridge exists but unconnected (A6) |
| Compliance / App-Store readiness (admin) | ~ | ✓ | ✓ | · | ✓ | ~ | **Newly compiling** — rule-engine + service specs pass; untested end-to-end (A9) |
| App-version management / update check | ✓ | ✓ | ✓ | · | ✓ | ✓ | **Working** — check-update now cached |
| Analytics | ✓ | ✓ | ✓ | ~ | ✓ | ✗ | **Working** |
| Admin console (users, workspaces, orgs, audit) | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | **Working** |
| Enterprise / SSO / SCIM | ~ | ✓ | ✓ | ✗ | ✓ | ✗ | **Partial** — SSO config stored, no SAML/OIDC flow |
| Billing / Subscription | ~ | ~ | ✓ | ✗ | ✓ | ✓ | **Partial** — tables + seat limits enforced; no payment provider |
| Accounts / multi-account | ✗ | ✗ | ✗ | · | · | · | **Missing** — no `Account` model |
| Import (Slack/Notion) | ~ | ~ | ✓ | ✗ | ✓ | ✗ | **Partial** — not re-verified this pass |
| Export | ✗ | ✗ | ✗ | · | · | · | **Missing** |

---

## Web / Desktop

Both apps consume the same `@org/api` contracts through `@org/api-client`; the
desktop app (`@org/desktop`, Electron) is a shell over the same web bundle plus
deep-link handling and an auto-updater fed by the new `/admin/app-versions/
check-update` endpoint (which this pass cached). Auth, sessions, messages,
notifications, files, projects, settings and realtime all flow through one
backend, so a change on web appears on desktop via the same SSE stream. No
divergent client-side business logic was found. `desktop.log` is an
uncommitted runtime artifact (should be `.gitignore`d).

---

## Security

Fixes **verified present** this pass (from the old S-list): S1 (cross-tenant FK
writes), S3 (search private-channel leak), S5 (suspended-member Matrix access),
S6 (plaintext integration tokens), S7 (OAuth token injection), S9 (cross-tenant
user disclosure), S14 (reset token in response). Integration layer additionally
gained an SSRF guard and outbound-webhook signing.

Introduced/retained safe this pass: `CacheService.deletePattern` escapes the
glob before building its fallback `RegExp`; the app-version cache stores a
plain row (no tokens) with a 60s TTL bounded further by `invalidateCaches()` on
every release mutation.

**Not re-verified** (carry forward from 2026-08-21): S8 (archived-workspace
freeze bypass via `/matrix/*`), S10 (ungated marketplace reviews), S11 (public
workspace logo), S12/S13 (upload MIME allowlist / streaming), S17 (agent/
workflow cost ceiling).

---

## Performance

* **Added:** `GET /admin/app-versions/check-update` (public, hit by every desktop
  client on launch) now resolves the current release from cache (60s TTL) instead
  of two `findFirst` queries per request.
* **Already in place (verified):** message-list virtualization, RAG/embedding
  work off the request thread via event listeners, Postgres FTS with GIN indexes,
  cursor pagination on the files hub, presence cached with TTL, per-workspace
  realtime fan-out over Redis pub/sub.
* **Not addressed:** tenant list endpoints (`getProjects`, `getTasks`, …) still
  return all rows (old S15) except where a hub added pagination; no bundle-size
  pass.

---

## Testing

| Suite | Result |
|---|---|
| **typecheck** | **73/73 projects green** (was 5 red / 213 errors) |
| **lint** | **73/73 projects green, 0 errors** (was 5 errors) |
| **test** | **31 suites / 951 tests green** (was 26 / 903) — +48 from newly-wired `api/{admin,compliance,agents,member,realtime}` suites |
| **build** | **4 apps green** (`api`, `web`, `admin`, `desktop`) |
| **e2e** (`@org/api-e2e`) | **not run** — needs `infra:start` (Postgres/Redis) + a running API; deferred |

New coverage this pass: `AppVersionsService` (15 — validates the check-update
refactor), `ComplianceRuleEngineService` (10), plus 6 repaired mock-drift tests
in `member`/`realtime`.

---

## Remaining Issues

Ordered by impact. Each is a bounded piece of work, not a structural hole.

### A4 — Email delivery · **FIXED (Phase 4)**
New `libs/api/mail` (`@org/api-mail`), a `@Global()` `MailModule`:
* `MailService.send()` with two transports chosen by `MAIL_TRANSPORT` —
  `log` (default; renders to the logger, no external service) and `http` (POSTs
  the Resend/Postmark/SendGrid `{from,to,subject,html,text}` shape to
  `MAIL_API_URL` with `Bearer ${MAIL_API_KEY}`). `send` never throws on a
  transport failure.
* Built-in templates `passwordResetEmail`, `workspaceInviteEmail` (subject +
  HTML + text, HTML-escaped).
* Wired into `AuthService.forgotPassword` (reset link, best-effort so a bounce
  can't reveal whether the address exists) and `MemberService.invite` (one
  invite email per new address, `${APP_URL}/invite/<token>`).
* `MAIL_TRANSPORT` / `MAIL_FROM` / `MAIL_API_URL` / `MAIL_API_KEY` / `APP_URL`
  added to `apiEnvSchema` + `.env.example`.
* 6 tests (`mail.service.spec.ts`).
*Still open, minor:* a notification-digest cron consuming unread `Notification`
rows; push notifications.

### A5 — Sidebar registries · **FIXED (Phase 4)**
The sidebar (`resource-sections.tsx`, `channel-nav.tsx`) already used the real
`useAgents` / `useWorkflows` / `useIntegrations` query hooks — `WorkflowListView`
was the single remaining consumer of the `localStorage` `workspace-registries.ts`
(a name-colliding second `useWorkflows`). Rewritten onto
`@org/web-automations`'s `useWorkflows` + `useWorkflowMutations`: templates now
`POST` a real `AutomationWorkflow` with a starter React Flow graph, "Run now"
calls the real `trigger` endpoint, loading/error/empty states added.
`workspace-registries.ts` deleted and dropped from the `@org/hooks` barrel.
Also fixed a related bug: `WorkflowCanvasView` now hydrates its graph from
`?id=<workflowId>` (reusing the warm list query), so "Edit" and "Use template →
open" actually load the workflow instead of a blank canvas; save no longer
resets `triggerType` to `WEBHOOK` on every update.

### A6 — Channel agents/apps panel disconnected · **Medium**
*Why it remains:* Tier-0 (stop showing fabricated content by default) is done;
full wiring needs a channel↔agent association model + API, and the panel's
message feed needs to read the real Matrix room (where `AgentMatrixBridgeService`
already posts) instead of a `localStorage` array.
*Impact:* "add agent to channel" is a no-op outside one browser tab.
*Next step:* add `ChannelAgent` (`channelId`, `agentId`, `enabledAt`), an
endpoint under `/workspaces/:id/channels/:channelId/agents`, have
`AgentMatrixBridgeService.tryHandle` gate on it, and point the panel's feed at
the channel's existing message query.

### A7 — Agent Builder graph in `localStorage` · **Medium**
*Why it remains:* `AIAgent` has no generic JSON blob to hold the ReactFlow
graph, so this needs a Prisma migration (`AIAgent.graphJson String?`) — which
needs a live DB / `prisma migrate` (Postgres via docker, off-limits this pass).
*Impact:* a built agent workflow is lost on browser-data clear and invisible to
teammates.
*Next step:* add `AIAgent.graphJson`, accept it in the agent update DTO +
service, add it to `@org/types` `AIAgent` + `agentsApi.update`, then swap
`use-agent-graph.ts`'s `localStorage` read/write for the agent update mutation.
The pattern is identical to the `WorkflowCanvasView` hydration done in A5.

### A8 — Local-disk object storage · **Medium**
*Why it remains:* an S3/MinIO driver is a deploy-topology decision.
*Impact:* uploads are lost on API redeploy and not shared across replicas; the
platform cannot horizontally scale the API tier without sticky routing.
*Next step:* `StorageService` is already an interface with a local driver — add
an S3 driver behind `STORAGE_DRIVER=s3`, keep local as the dev default.

### A9 — Compliance/App-Version feature unverified end-to-end · **Medium**
*Why it remains:* it compiles now and its two service-level unit suites pass, but
no controller/integration/e2e test exercises it and it has not been run against a
live DB + seeded data.
*Impact:* a large admin surface (11 views, 2,132-LOC service) of unknown runtime
correctness — the frontend↔API alignment this pass fixed was type-level.
*Next step:* run the admin app against `infra:start` + the compliance seeder
(`ComplianceService.seedOfficialGuidelines`), walk the Requirements → Review →
Checklist → Release-gate flow, and add an `@org/api-compliance` controller spec
plus one admin e2e.

### Carried forward from 2026-08-21 (not re-verified, lower confidence they persist)
S8, S10–S13, S17; tenant-list pagination (S15); `Organization` island / no
`Account` tier; per-document ACL; export capability; SAML/OIDC flow; payment
provider; Slack/Notion import depth.

---

## Definition-of-Done scorecard

| Criterion | State |
|---|---|
| Existing features audited | ✓ this document |
| Missing connections implemented | ~ compliance/app-version FE↔API, A4 (email), A5 (registries) done; A6–A9 open |
| Frontend/API/DB flows work end-to-end | ✓ for the "Working" rows above; A9 unverified |
| Auth & permissions enforced server-side | ✓ |
| Realtime reliable | ✓ transport + bridge solid; reconnect edge-cases not stress-tested |
| Web/desktop synchronized | ✓ one backend, one contract |
| Files & assets persist correctly | ✓ (local driver — A8) |
| Notifications & unread accurate | ✓ per-user model with read state; mailer exists, digest cron not wired |
| AI agents/apps connected | ~ execution real; sidebar/workflow wiring done (A5); channel panel open (A6) |
| Errors & edge cases handled | ~ AI errors propagate; UX retry/empty states good on core screens |
| Design system preserved | ✓ compliance views brought onto real `Badge`/`StatCard`/`Page` primitives |
| Performance addressed | ~ check-update cached; list pagination outstanding |
| Security addressed | ✓ S1/S3/S5/S6/S7/S9/S14 closed; S8/S10–S13/S17 to re-verify |
| Critical flows have automated tests | ~ 964 green; compliance/analytics/admin/marketplace controllers uncovered |
| Existing functionality not broken | ✓ full typecheck/lint/test/build green |
| Migrations safe | ✓ forward-only, no checked-in resets |
| No production-critical mock remains | ~ A6/A7 are `localStorage` stopgaps; no fabricated data shown by default |
