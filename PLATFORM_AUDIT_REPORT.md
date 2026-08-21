# PLATFORM_AUDIT_REPORT.md

**Repository:** `D:\Onetab-AI\onetab-ai` · **Date:** 2026-08-21
**Scope:** Phases 1–12 of the master audit brief — discovery, feature audit,
flow audit, connection matrix, events, duplication, mocks, permissions, UX, AI,
customization, import/export.

**Status of this document:** audit only. **No code was changed.** Findings are
ranked in §26 as a backlog for implementation passes.

---

## Executive summary

OneTab AI is a well-engineered collaboration platform with a genuinely
production-grade foundation and an AI/automation layer that is, on the
production path, almost entirely non-functional. The dividing line is sharp and
maps exactly to the README's own phase markers.

**What is real:** authentication, workspaces, channels, DMs, members,
invitations, uploads, projects/tasks/documents/whiteboards CRUD, the Matrix
bridge, the design system, and — notably — a fail-closed guard stack and a
tenancy rule that services actually follow. `libs/api/auth/src/lib/guards.ts`
and `libs/api/work-tools/src/lib/work-tools.service.ts` are better than most
production code of this kind.

**What is not real:** every AI response (`ai-infrastructure.service.ts` returns
fabricated strings), every embedding (random floats), every vector search
(empty array), every agent tool call (the registry's `executeTool` is dead
code), every workflow action (`CONDITION` always passes, `API_CALL` returns a
fake 200), every import (the "importer" reads the channel list out of the
request body), billing (client-side `useState`), and the workflow canvas's Save
button (a toast).

**The single structural cause of most disconnections:** there is no event bus,
no queue and no scheduler. `@nestjs/event-emitter`, `@nestjs/schedule` and
BullMQ are absent from `package.json`. Nothing can happen after a write, so
nothing does: 21 of the 23 events in the brief are never emitted, activity is
recorded only for Matrix messages, and nothing is ever indexed for search.

**Most serious integrity problem:** several surfaces present fabricated data to
the user as if it were real — a channel feed seeded with invented AI agent
messages, fake GitHub PR embeds and fake tool-execution traces
(`use-channel-agents-apps.ts`); a "Connect Google Workspace" button that
`setTimeout`s for 800 ms and then invents email addresses from the workspace
slug; agent execution logs that record the *available* tool list in the
`toolCalls` column and a hardcoded `tokensUsed: 140`. These are worse than
missing features, because they cannot be distinguished from working ones.

**Counts:** 175 API routes · 44 Prisma models · 63 web route entries · 20 test files ·
0 events emitted · 0 search index writes · 0 export capability.

---

## 1. Existing features

Verified working end-to-end (code read, path traced from UI → API → DB):

| Area | Evidence |
| --- | --- |
| Registration, login, refresh, logout, forgot/reset/change password | `libs/api/auth/src/lib/auth.controller.ts:67–166`; `apps/api-e2e/src/api/auth.spec.ts` |
| JWT-by-default with `@Public()` opt-out | `apps/api/src/app/app.module.ts:66`; `guards.ts:38–52` |
| Workspace CRUD, slug suggestion, logo up/download, archive, restore, transfer ownership | `workspace.controller.ts:42–180` |
| Workspace membership, roles, permission matrix | `member.controller.ts`; `libs/shared/types/src/lib/permissions.ts` (+ its spec) |
| Invitations: create, list, revoke, accept by token | `member.controller.ts:78–126` |
| Channels: CRUD, archive/unarchive, make-private, members, join, pins, per-channel prefs, read markers, files | `channel.controller.ts:37–221` |
| Channel visibility enforcement | `channel.service.ts:49–51, 109, 242–250, 325–331` |
| Matrix bridge: provisioning, session minting, channel↔room linking, appservice transactions, push gateway | `libs/api/matrix/*`; `packages/matrix-client/*` |
| DMs (client-side room creation, `m.direct`) | `matrix-client.ts:549–583`; `use-direct-room.ts` |
| Uploads: size cap, tenancy check, sharded keys, checksum, path-traversal backstop | `upload.service.ts`; `storage.service.ts:47–58` |
| Projects, tasks, task comments, calendar events, documents (tree), whiteboards — full CRUD | `work-tools.service.ts` (644 lines) |
| Kanban ordering with gap-based positions and column respacing | `work-tools.service.ts:40, 284–314` |
| Ticket ids (`WEB-42`) with transaction-safe sequence | `work-tools.service.ts:118–141, 234–271` |
| Workspace search over 6 categories (Postgres ILIKE) | `search.service.ts` |
| Notification preferences, push device registration, activity feed | `notifications.service.ts` |
| Analytics: dashboards, reports, CSV export, error tracking, health | `libs/api/analytics/*` (2,022 lines — the most complete non-core module) |
| Admin console: users, workspaces, organizations, audit logs | `admin.controller.ts`, `admin.service.ts` |
| Marketplace: listings, storefronts, reviews, installations, plugin SDK + manifest validation | `marketplace.service.ts` (634 lines) |
| Electron desktop shell with deep links | `apps/desktop/*` (has its own tests) |

---

## 2. Missing features

Absent entirely — no model, no route, no service:

| Brief item | Status |
| --- | --- |
| **Accounts / multi-account / account switching** | `Organization` exists but has **no relation to `Workspace` or `User`** (`schema.prisma:665–679`; `organizationId` appears only on `Department`, `SSOConfig`, `EnterpriseAuditLog`, `OrganizationSubscription`). There is no `Account` model. The workspace switcher is not account switching. |
| **Meetings** | No `Meeting` model. `MeetingsView.tsx` (653 lines) renders `CalendarEvent` rows plus a hardcoded `MEETING_APP_CATALOG`. No transcript, no summary, no decisions, no meeting→task. |
| **Knowledge** | No model, no service, no route. `search_docs` searching `WorkDocument` is the closest thing. |
| **Export** | Zero occurrences of any export job/service/controller in `libs/api`. `ImportJob` has no `ExportJob` counterpart. |
| **Billing** | No controller, no service, no route. `OrganizationSubscription` is written by nothing. |
| **Custom fields** | No model, no storage column, no API. |
| **Custom statuses** | `TaskStatus` is a fixed Prisma enum (`TODO/IN_PROGRESS/…`). |
| **Custom views** | No saved-view model; view state is component-local. |
| **Templates** | `PromptTemplate` exists (AI prompts only). No project/doc/task templates. |
| **Dashboards (configurable)** | `dashboard-page.tsx` is a fixed layout; no widget model, no per-user layout. |
| **Audit (tenant-level)** | `EnterpriseAuditLog` is organization-scoped and operator-only. No workspace-level audit trail. |
| **Subtasks, task dependencies, recurring tasks** | No `parentTaskId`, no dependency table, no recurrence fields on `Task` (`schema.prisma`, Task model). |
| **Document versions, doc comments, mentions in docs** | No version or comment table for `WorkDocument`. |
| **File versioning, archive/restore, security scan** | `Upload` has none; `upload.service.ts` does size + tenancy only. |
| **Project membership** | `Project` has no members relation. Every workspace member can read and edit every project. |
| **Agent memory** | `AIMemory` model has **zero** runtime references outside the generated client. |
| **Agent schedules/triggers** | `AgentSchedule` model has **zero** runtime references. No scheduler exists to run them. |
| **OAuth for integrations** | `connectProvider` takes `accessToken` straight from the request body (`integrations.service.ts:36–62`). No authorize URL, no callback, no token exchange, no refresh, no scopes, no provider allowlist. |
| **Webhooks (in or out)** | No webhook registration, receipt or dispatch anywhere. |
| **Email delivery** | No mailer. `forgot-password` returns a `devToken` in the response body. |

---

## 3. Partial features

| Feature | What works | What is missing |
| --- | --- | --- |
| **Search** | 6 categories over Postgres ILIKE; honest comment saying Meilisearch is intended | No index, no ranking, no semantic search, unindexed `contains` on `WorkDocument.content` (full scan), **no channel-visibility filter** (see §8-C) |
| **Notifications** | Preferences, mute, push devices, feed | Feed is fed **only** by Matrix messages; no notification for task assignment, mention outside chat, invitation, workflow, agent, or import; no batching, no dedup, no read/unread state, no deep links, no email |
| **Activity** | `RecentActivity` table with `mentionedUserIds` | Exactly **one** writer: `matrix-sync.service.ts:111`. No project/task/doc/file/agent/workflow activity |
| **Agents** | CRUD, workspace scoping, execution log rows, marketplace deploy flag | Tools are listed in the prompt but never passed to the model and never executed; `executeTool` is unreachable; no memory, no knowledge, no schedules, no acting-user, no permission context, `status` hardcoded `SUCCESS`, `tokensUsed` hardcoded `140` |
| **Workflows** | CRUD, execution history rows, workspace scoping (`automations.service.ts` is correct) | Engine ignores `edgesJson` (nodes only, linear); `CONDITION` always returns true; `API_CALL`/`WEBHOOK` return fabricated output; no triggers, no retry, no timeout, no cancellation, no idempotency, no failure status |
| **AI** | Ollama chat is attempted for real | Every other method fabricates; `openai`/`anthropic`/`gemini` providers are accepted and silently routed to the same fabrication |
| **Import** | `ImportJob` rows, channel/document creation | Data comes from the **request body**, not from Slack or Notion; no auth, no discovery, no mapping, no messages, no threads, no files, no users, no preview, no validation, no checkpoint, no resume, no verification; job is marked `COMPLETED` before any work |
| **Marketplace** | Listings, reviews, installations, plugin registration, manifest validation, scope checks | Installing something has **no effect** — no agent is created, no integration connected, no workflow saved |
| **Integrations** | Connection rows, connect/disconnect, token withheld from responses | No OAuth, plaintext token at rest, no provider allowlist, no actions, no triggers, no webhooks |
| **Analytics** | Genuinely substantial: dashboards, 6 report types, CSV, error tracking, telemetry interceptor | Some series derive from tables nothing writes (agent/workflow logs are only written by fake executions) |
| **Enterprise / SSO / SCIM** | Models, routes, token rotation | `scim.service.ts` is 51 lines; SSO config is stored but no SAML/OIDC flow exists |

---

## 4. Broken features

| # | Finding | Evidence |
| --- | --- | --- |
| B1 | **"Save Graph" on the workflow canvas persists nothing.** The button sets local `isSaved` state and shows `toast.success('Workflow saved')`. `initialNodes`/`initialEdges` are empty arrays; no mutation is called. | `libs/web/automations/src/lib/WorkflowCanvasView.tsx:171–284` |
| B2 | **Billing is a client-side simulation.** Plan is `useState`, prices are literals, "upgrade" calls `setCurrentPlan` and toasts *"Successfully upgraded … to the Pro plan with N seats!"*. No API call, no `OrganizationSubscription` write, no payment provider. | `libs/web/workspace/src/lib/components/workspace-billing-settings.tsx:48–86` (749 lines, zero API imports) |
| B3 | **"Connect Google Workspace" is fabricated.** `await new Promise(r => setTimeout(r, 800))`, then builds `team@<slug>.com`, `engineering@<slug>.com`, … and reports *"Connected to Google Workspace and synced N team directory emails."* | `libs/web/workspace/src/lib/pages/create-workspace-page.tsx:211–235` |
| B4 | **DM deduplication can hijack a private channel room.** `getOrCreateDirectMessage` returns the first room with exactly 2 joined members containing the peer — a 2-person private channel matches. It also ignores the `m.direct` map when searching and ignores invited-but-not-joined members, so a pending DM invite produces a duplicate room. | `packages/matrix-client/src/lib/matrix-client.ts:549–563` |
| B5 | **Agent execution logs are falsified.** `toolCalls: JSON.stringify(availableTools)` records the tools that *could* have been called as if they were; `tokensUsed: 140` is a literal; `status: 'SUCCESS'` is unconditional. | `libs/api/agents/src/lib/agents.service.ts:127–136` |
| B6 | **Workflow executions are always `SUCCESS`.** The status is a literal, written after a loop whose steps cannot fail. A failing `AI_ACTION` throws out of `executeWorkflow` and no `WorkflowExecution` row is written at all. | `workflow-engine.service.ts:36–45` |
| B7 | **RAG always returns nothing.** `ingestDocumentForRAG` is never called from anywhere; `searchVector` returns `[]`; `generateEmbedding` returns random floats. `POST /ai/rag-search` therefore always returns an empty array. | `ai-infrastructure.service.ts:130–163`; grep for callers finds only `ai-platform.controller.ts:82` |
| B8 | **Matrix membership drift is permanent.** `syncChannelMembership` swallows failures with the comment *"reconciled later"*. No reconciler exists (no scheduler, no queue). | `matrix-auth.service.ts:220–232` |
| B9 | **`create_doc` agent tool authors documents as an arbitrary user.** It picks `workspaceMember.findFirst({ where: { workspaceId } })` — whoever the database returns first — as the author. | `mcp-tool-registry.service.ts:49–67` |
| B10 | **`send_channel_message` agent tool sends nothing.** Returns `{ success: true, channelSlug, text }` without touching Matrix or the database. | `mcp-tool-registry.service.ts:154–171` |

---

## 5. Disconnected features

Each arrow below exists in the product brief and does **not** exist in the code.

```
task.created ──✗──▶ notification        no notification service call anywhere
task.created ──✗──▶ activity            RecentActivity has one writer (Matrix)
task.created ──✗──▶ search index        no index exists
task.assigned ─✗──▶ notification        assigneeId is written with no side effect
document.saved ─✗─▶ RAG ingest          ingestDocumentForRAG has zero callers
document.saved ─✗─▶ search index        search reads live tables instead
file.uploaded ──✗─▶ virus scan          no scanner
file.uploaded ──✗─▶ task / doc          Upload links only to Channel
channel.created ─✗▶ Matrix room         room is created lazily on first chat open, not on create
meeting.ended ──✗─▶ transcript/summary  no transcript pipeline
agent.execute ──✗─▶ tool call           executeTool is unreachable
agent.execute ──✗─▶ permission check    tools use raw Prisma with no acting user
workflow.trigger ✗▶ event/schedule      only manual POST .../trigger exists
workflow.action ─✗▶ platform API        actions return fabricated output
marketplace.install ✗▶ agent/integration/workflow   install writes a row and stops
import.completed ─✗▶ verification       job marked COMPLETED before any work
integration.connect ✗▶ OAuth            token comes from the request body
sidebar registries ─✗▶ database         localStorage, though the tables exist
```

**Notably present and correct:** `channel.message → RecentActivity → Inbox`,
`channel.message → Matrix push → PushRegistration`, and
`channel.membership → Matrix room membership` (best-effort).

---

## 6. Duplicate systems

| # | Duplication | Recommendation |
| --- | --- | --- |
| D1 | `libs/web/settings` and `libs/web/profile` are Nx libraries whose entire content is a re-export of `WorkspaceSettingsPage` from `libs/web/workspace`. `libs/web/settings/src/lib/settings-layout.tsx` is a one-line re-export of the real 320-line `settings-layout.tsx` in `libs/web/workspace`. **`@org/web-settings` is imported by nothing at all** — it is fully dead. `@org/web-profile` is imported once, by `app.tsx:56`. | Delete `libs/web/settings`; collapse `libs/web/profile` into `@org/web-workspace` |
| D2 | `WorkspaceSettingsPage` (2,589 lines) is the element for **8 different routes** — `/settings`, `/settings/*`, `/import-export`, `/integrations/import`, `/billing`, `/plans`, `/analytics`, `/analytics/*`. | Split into route-owned pages behind a shared settings layout |
| D3 | `useWorkspaceId` in `libs/web/integrations/src/lib/use-workspace-id.ts` duplicates `useCurrentWorkspace` from `@org/web-workspace` | Consolidate |
| D4 | Tenancy `assert*` helpers are re-implemented per service (`assertProject`, `assertTask`, `assertAgent`, `assertWorkflow`, …) with identical shape | Extract one generic `assertOwned(model, workspaceId, id)` in `libs/api/common` |
| D5 | Task/document/channel writes exist twice: once in `WorkToolsService`/`ChannelService` (validated) and once in `MCPToolRegistryService` (raw Prisma, unvalidated) | Agent tools must call the services, not Prisma |
| D6 | Two "activity" concepts: `RecentActivity` (chat) and `AnalyticsEvent` (telemetry), overlapping but unrelated | Decide which is the activity log; keep the other for metrics |

**Not duplicated (good):** the Matrix client (3 `createClient` calls, all inside
`packages/matrix-client`), the HTTP client, the guard stack, the query-key
factory.

---

## 7. Mock implementations on production paths

Ranked by how convincingly they impersonate a working feature.

| # | Location | What it fakes |
| --- | --- | --- |
| M1 | `libs/web/channels/src/lib/use-channel-agents-apps.ts` (+ `types/channel-agents-apps.ts`) | Seeds every channel with invented AI-agent messages, a fake GitHub PR embed (`#248 … CI Tests Passing (14/14)`, `+420 lines · -18 lines`), fake `toolsExecuted` entries (`db.query("SELECT agent_id…")`, `rag.searchChannelMemory(…)`), fake reasoning traces with durations, and fake reaction counts — rendered as real channel content |
| M2 | `libs/api/ai/src/lib/ai-infrastructure.service.ts:94–133` | `chat` fallback returns `[OneTab AI — OPENAI (gpt-4o)] Generated response for prompt: "…"`; `summarizeThread` returns a **fixed** two-bullet summary regardless of input; `translateText` returns `[Translated to X]: <original>`; `analyzeVision` returns a fixed sentence; `generateImage` returns a hardcoded Unsplash URL; `generateEmbedding` returns `Math.random()` floats |
| M3 | `libs/api/integrations/src/lib/slack-importer.service.ts` | Reads the channel list from the HTTP request body, creates channels, writes an `ImportJob` with `status: 'COMPLETED'` and `processedItems = totalItems` up front. No Slack API call exists |
| M4 | `libs/api/integrations/src/lib/notion-importer.service.ts` | Same pattern for documents |
| M5 | `libs/api/automations/src/lib/workflow-engine.service.ts:60–76` | `CONDITION → { conditionPassed: true }`, `API_CALL → { statusCode: 200, response: 'OK' }`, `WEBHOOK → { webhookDispatched: true }` |
| M6 | `libs/web/workspace/src/lib/components/workspace-billing-settings.tsx` | Entire billing surface |
| M7 | `libs/web/workspace/src/lib/pages/create-workspace-page.tsx:211–235` | Google Workspace directory sync |
| M8 | `libs/web/automations/src/lib/WorkflowCanvasView.tsx:275–284` | Save |
| M9 | `libs/shared/hooks/src/lib/workspace-registries.ts` | Installed agents / connected apps / saved workflows in `localStorage` |
| M10 | `libs/web/agents/src/lib/agent-graph/use-agent-graph.ts` | Agent Builder graph in `localStorage` |
| M11 | `libs/web/integrations/src/lib/AppChatView.tsx:161` | `DEFAULT_WORKSPACE_APPS` static catalogue |
| M12 | `libs/web/work-tools/src/lib/MeetingsView.tsx:78` | `MEETING_APP_CATALOG` static catalogue |

Mocks in `*.spec.ts*` and `test-setup.ts` are legitimate and excluded.

---

## 8. Security issues

Severity: **C**ritical / **H**igh / **M**edium / **L**ow.

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| S1 | **H** | **Cross-tenant write via unvalidated foreign keys.** `createTask`/`updateTask` validate `projectId` but **not** `sprintId`, `milestoneId` or `assigneeId`. A member of workspace A can attach a task to workspace B's sprint or milestone, and can assign a task to any user id on the platform. | `work-tools.service.ts:227–350` — only `assertProject` is called |
| S2 | **H** | **Private-channel activity leaks to every workspace member.** The Inbox feed returns all `RecentActivity` for the workspace filtered only by the caller's *muted* channels; there is no channel-membership check. Private-channel names, participants and message cadence are exposed. | `notifications.service.ts:188–232` |
| S3 | **H** | **Search returns private channels to non-members.** The `channels` branch filters on `workspaceId` and `isArchived` only — no `visibility` / membership predicate, unlike `channel.service.ts:49–51` which does it correctly. | `search.service.ts:104–122` |
| S4 | **H** | **Agent tools bypass every permission check.** `MCPToolRegistryService` handlers hit Prisma directly with only `workspaceId`. `list_channels` returns private channels; `create_task`/`create_doc` write without an acting user or role check. If `executeTool` is ever wired up (§13-A1), this becomes immediately exploitable. | `mcp-tool-registry.service.ts:20–172` |
| S5 | **H** | **Suspended members retain Matrix access.** `WorkspaceRoleGuard` rejects `MembershipStatus.SUSPENDED`, but `/matrix/*` routes carry no guard and their own checks use `members: { some: { userId } }` with **no status filter**. A suspended member can still link/obtain channel room ids and resolve peer Matrix identities. | `matrix.controller.ts:25` (no guard); `matrix-auth.service.ts:128–144, 191–198` |
| S6 | **H** | **Third-party OAuth tokens stored in plaintext.** `ExternalIntegration.accessToken` is written as-is with no encryption or KMS. Correctly withheld from responses, but at rest it is readable by anything with DB access. | `integrations.service.ts:45–61` |
| S7 | **H** | **No OAuth flow — token injection.** `POST /integrations/:provider/connect` accepts an arbitrary `provider` string and an arbitrary `accessToken` from the request body. Any workspace member can register a credential for any provider name. | `integrations.controller.ts:41`; `integrations.service.ts:36` |
| S8 | **M** | **Archived-workspace freeze is bypassable via Matrix routes.** The `ARCHIVED` write-freeze lives in `WorkspaceRoleGuard`; `POST /matrix/channels/:channelId/room` does not run it and creates a Matrix room. | `guards.ts:141–152` vs `matrix.controller.ts:79` |
| S9 | **M** | **Cross-tenant user disclosure.** `GET /users/:userId` has no workspace guard and no shared-workspace check, so any authenticated account can read any user's public profile by id. Compare `resolvePeerIdentity`, which does check. | `user.controller.ts:49–53` |
| S10 | **M** | **Marketplace reviews are ungated and workspace-spoofable.** `POST /marketplace/listings/:slug/reviews` carries no guard — any authenticated account can review any listing, with no installation check and no rate limit beyond the global throttler. Worse, `workspaceId` is read **from the request body** and passed through unvalidated, so a review can be attributed to a workspace the caller does not belong to. (`authorName` *is* correctly taken from the session — that part is right.) | `marketplace.controller.ts:109–127` |
| S11 | **M** | **Workspace logo is public.** `GET /workspaces/:workspaceId/logo` is `@Public()`, allowing enumeration of workspace ids and disclosure of branding. Probably intentional for `<img>` tags; if so it should be a signed or opaque URL. | `workspace.controller.ts:93–94` |
| S12 | **M** | **No upload MIME allowlist and no malware scan.** `upload.service.ts` checks emptiness, size and tenancy only; `mimeType` is taken from the browser. Downloads are served back with that browser-supplied MIME type. | `upload.service.ts:52–86` |
| S13 | **M** | **Uploads and downloads are fully buffered in memory.** `storage.put` takes a `Buffer`; `read` returns the whole file. 25 MB × concurrency is an availability risk. | `storage.service.ts:70–86` |
| S14 | **M** | **Password reset token returned in the HTTP response** (`devToken`). Acceptable in development, dangerous if the flag survives to production. | `auth.controller.ts:136–140`; `endpoints.ts:137` |
| S15 | **L** | **No pagination on tenant lists.** `getProjects`, `getTasks`, `getDocuments`, `getWhiteboards`, `getCalendarEvents`, `channel.files`, `upload.list` all return every row. DoS and memory risk on a large workspace. | `work-tools.service.ts` throughout |
| S16 | **L** | **Five models declare no `@@index`:** `AIMemory`, `Organization`, `User`, `ChatSettings`, `PluginRegistration`. `User.email` and `Organization.domain` are `@unique`, which Postgres backs with an index, so those lookups are fine — the real gaps are `AIMemory` (no `workspaceId`/`agentId` index, though nothing queries it yet), `ChatSettings` and `PluginRegistration(slug)`. | `schema.prisma` |
| S17 | **L** | **Agent/workflow execution has no rate limit or cost ceiling** beyond the global 120 req/min throttler. No per-workspace token budget despite an `AIUsageStats` analytics surface. | `agents.controller.ts:104` |

**Verified as correctly handled** (do not re-report): global fail-closed JWT;
`SystemRoleGuard` fail-closed; 404-not-403 disclosure discipline throughout;
membership re-checked per request rather than carried in the JWT; workspace
resolved from the route only, never from body or header; `linkChannelToRoom`
re-implementing the membership check the guard would have done; `m.direct`
peer resolution requiring a shared workspace; storage path-traversal backstop;
server-generated storage keys; `accessToken` excluded from integration
responses; `pushKey` excluded from device responses; constant-time-ish
`hs_token` comparison on appservice routes; `mutedChannelIds` validated against
the workspace before being stored.

---

## 9. UX issues

Measured across 60 top-level views/pages by presence of loading, empty and
retry affordances.

**Views with none of the three:**
`AgentStoreView`, `CommunityTemplatesView`, `ComponentMarketplaceView`,
`IntegrationStoreView`, `WorkflowTemplatesView`, `ThemeStoreView` (all
`libs/admin/marketplace`), `WorkflowCanvasView`, `IntegrationHubView`,
`SlackNotionImportView`, `create-channel-page`, `invitations-page`,
`profile-page`, `settings-page`, `ProjectDashboardView`, `ProjectTimelineView`.

**Views with loading but no retry on error:**
`dashboard-page` (13 loading affordances, 0 retry), `workspace-settings-page`
(9 / 0), `ProjectListView` (5 / 0), `ThreadsView` (5 / 0), `members-page`,
`browse-channels-page`, `WorkflowListView`, all four auth pages.

**Exemplary** (loading + empty + retry): `AgentChatView`, `AppChatView`,
`DirectMessagesView`, `AgentMarketplaceView`, `InboxView`, `channel-page`.

**Other UX gaps:**

- No bulk actions on any list (tasks, files, members, channels, documents).
- No pagination UI anywhere except the admin console.
- No confirmation dialog on destructive project/document deletes despite
  cascading deletes with no undo (§10-DB2).
- Keyboard shortcuts and a command palette appear in the brief; only
  `use-prompt-dialog` and basic Radix focus management exist.
- Success toasts fire for operations that did not persist (§4-B1, B2, B3) —
  the most damaging UX issue in the repository.

---

## 10. Database changes required

| # | Change |
| --- | --- |
| DB1 | Add `Account` (or give `Workspace.organizationId`) and `AccountMember` to make the User→Account→Workspace hierarchy real |
| DB2 | Add `deletedAt` + partial indexes to `Project`, `Task`, `WorkDocument`, `Whiteboard`, `CalendarEvent`, `Upload`; stop relying on cascade for user-initiated deletes |
| DB3 | Add `ProjectMember` (role per project) |
| DB4 | `Task`: `parentTaskId`, `completedAt`, `createdById`, `TaskDependency` join table, recurrence columns |
| DB5 | `CustomFieldDefinition` + `CustomFieldValue` (polymorphic on resource) |
| DB6 | `TaskStatusDefinition` per project to replace the fixed `TaskStatus` enum (keep the enum as seed data) |
| DB7 | `SavedView` (owner, resource type, filters, sort, layout, visibility) |
| DB8 | `DocumentVersion`, `DocumentComment`, `DocumentPermission` |
| DB9 | `UploadVersion`; `Upload.taskId` / `Upload.documentId`; `scanStatus` |
| DB10 | `Meeting`, `MeetingParticipant`, `MeetingTranscript`, `MeetingSummary`, `MeetingDecision` |
| DB11 | `ExportJob` mirroring `ImportJob`; add `checkpointJson`, `errorJson`, `mappingJson`, `verifiedAt` to `ImportJob` |
| DB12 | `Notification` (recipient, kind, resource, readAt, deepLink) — the feed currently has no per-user read state |
| DB13 | `WorkspaceAuditLog` (tenant-level, distinct from `EnterpriseAuditLog`) |
| DB14 | `DashboardLayout` / `DashboardWidget` |
| DB15 | `Subscription`/`Plan`/`Seat` tied to `Workspace` (or `Account`), replacing the unused `OrganizationSubscription` |
| DB16 | Encrypt `ExternalIntegration.accessToken` + add `refreshToken`, `expiresAt`, `scopes` |
| DB17 | Indexes on `AIMemory(workspaceId, agentId)`, `ChatSettings(userId)`, `PluginRegistration(slug)` (`User.email` and `Organization.domain` are already covered by `@unique`) |
| DB18 | Postgres `tsvector` + GIN indexes on `WorkDocument.content`, `Task.title/description`, `Channel.name/topic` if search stays in Postgres |

---

## 11. API changes required

New route families: `accounts`, `workspaces/:id/projects/:projectId/members`,
`workspaces/:id/meetings`, `workspaces/:id/exports`, `workspaces/:id/imports`
(replacing `integrations/import/*`), `workspaces/:id/custom-fields`,
`workspaces/:id/views`, `workspaces/:id/dashboards`, `workspaces/:id/audit`,
`workspaces/:id/billing`, `workspaces/:id/knowledge`,
`integrations/:provider/oauth/authorize` + `/callback`, `webhooks/:integrationId`.

Changes to existing routes: pagination params on every list; `PATCH
/work-tools/tasks/bulk`; `POST .../restore` for soft-deleted resources;
`WorkspaceRoleGuard` (or an equivalent in-service check) on `/matrix/*`;
shared-workspace check on `GET /users/:userId`; guard on marketplace reviews.

---

## 12. Matrix changes required

- Add a reconciliation pass for `syncChannelMembership` failures (requires a
  scheduler — §14).
- Fix DM lookup to consult `m.direct` first and exclude rooms that back a
  channel (`Channel.matrixRoomId`), and to consider invited members (§4-B4).
- Create the Matrix room at channel-creation time, or make lazy creation
  explicit in the UI.
- Give agents a Matrix identity so `send_channel_message` can actually post.
- Add a status filter (`MembershipStatus.ACTIVE`) to the membership predicates
  in `matrix-auth.service.ts` (§8-S5).

---

## 13. Event changes required

**Current state: no event system exists.** `@nestjs/event-emitter` is not a
dependency; there are zero `emit`/`@OnEvent` occurrences in the repository.

Of the 23 events named in the brief, **2** have any equivalent
(`message.created` → `RecentActivity` via Matrix sync; a partial
`import.completed` via the fake importer). The other 21 are unimplemented:
`user.created`, `account.created`, `workspace.created`, `channel.created`,
`message.updated`, `project.created`, `task.created`, `task.updated`,
`task.completed`, `document.created`, `document.updated`, `file.uploaded`,
`meeting.completed`, `agent.started`, `agent.completed`, `workflow.started`,
`workflow.completed`, `workflow.failed`, `import.started`, `export.completed`.

Recommended: adopt `@nestjs/event-emitter` for in-process fan-out plus a
durable outbox table for anything that must survive a restart. Subscribers:
notifications, activity, search index, workflow triggers, analytics, audit.

---

## 14. Infrastructure changes required

| Missing | Consequence today |
| --- | --- |
| Job queue (BullMQ/pg-boss) | Import, export, agent runs, workflow runs and indexing all execute inline in the HTTP request |
| Scheduler (`@nestjs/schedule`) | `AgentSchedule` is dead; `CRON` workflow triggers cannot exist; no Matrix reconciliation; no cleanup of expired tokens |
| Search engine or Postgres FTS | Unindexed `ILIKE '%q%'` over `WorkDocument.content` |
| Vector store client (Qdrant) | RAG returns `[]` |
| Real AI provider clients | All non-Ollama providers fabricate |
| Object storage (S3/MinIO) | Uploads live on the API pod's local disk — lost on redeploy, not shared across replicas |
| Mailer | No invitations, resets or notifications by email |
| Secret encryption | Integration tokens in plaintext |

---

## 15. AI gaps

- No permission layer between the AI and the platform. The brief's
  `AI Request → Intent → Permission Check → Context → …` chain has only the
  outer `WorkspaceRoleGuard`; nothing narrows to what *this user* may see.
- No context assembly: `POST /ai/chat` forwards messages verbatim; no workspace
  context, no retrieved documents, no conversation history (`AIChatSession`
  exists but is written by nothing — only read by analytics).
- No tool calling: `ChatCompletionOptions.tools` is declared and never passed
  to any provider.
- No streaming despite `stream?: boolean` in the options type.
- No usage accounting: `tokensUsed` is a literal, so the AI-usage analytics
  screen reports fiction.
- AI cannot reach channels, DMs, meetings, files or knowledge — only the four
  tables the dead tool registry touches.

## 16. Automation gaps

No triggers of any kind (only manual `POST .../trigger`); no conditions (always
true); no real actions; no edges/branching; no retry, timeout, cancellation or
idempotency key; no failure path; no concurrency control; no per-workspace
execution quota.

## 17. Integration gaps

No OAuth, no webhooks in or out, no provider registry or capability manifest,
no action/trigger contracts, no connection health checks, no token refresh.
Importers are hardcoded per provider rather than built on the generic connector
architecture the brief asks for.

## 18. Import gaps

Against the brief's 26-step import flow, the implementation covers steps
"create rows" and "mark complete". Missing: authentication, source discovery,
resource detection, user/workspace/channel/message/thread/file/project/task/
document/relationship/permission mapping, preview, validation, queueing,
workers, checkpointing, retry, resume, Matrix room creation, search indexing,
verification and the migration report. `ImportJob.status` is set to
`COMPLETED` before any rows are written.

## 19. Export gaps

Nothing exists. No `ExportJob`, no packaging, no verification, no secure
download. The only export of any kind is analytics CSV
(`analytics.controller.ts:152`).

## 20. Customization gaps

| Configurable per the brief | Reality |
| --- | --- |
| Navigation ordering/visibility | Partial — sidebar favourites in `localStorage` only |
| Dashboards, widgets, layout | Fixed layout |
| Custom fields | None |
| Custom statuses | Fixed enum |
| Custom views / filters | Component-local state only |
| Templates (project/doc/task) | None (`PromptTemplate` is AI-only) |
| Notification preferences | **Implemented** (per workspace, with mute + quiet hours) |
| AI preferences | None |
| Workflow triggers/conditions/actions | Stored as JSON, not honoured by the engine |
| Shortcuts | None |
| Themes | **Implemented** (`theme-provider.tsx`, light/dark/system) |
| Inheritance & overrides (account → workspace → resource) | No mechanism; there is no account tier to inherit from |

---

## 21. Connection matrix (generated from the code)

`✓` connected · `~` partial · `✗` missing but required by the brief ·
`·` not applicable

| From ↓ / To → | Acct | Wksp | Matrix | Proj | Task | Docs | Files | Search | Notif | Activity | AI | Agent | Wflow | Apps | Import | Export |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Account** | · | ✗ | · | · | · | · | · | · | · | · | · | · | · | ✗ | · | · |
| **Workspace** | ✗ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✗ |
| **Channel** | · | ✓ | ✓ | ✗ | ✗ | · | ✓ | ~ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ |
| **DM** | · | ✓ | ✓ | · | · | · | ✓ | ✗ | ✓ | ✗ | ✗ | · | · | · | ✗ | ✗ |
| **Project** | · | ✓ | ✗ | · | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ |
| **Task** | · | ✓ | ✗ | ✓ | · | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ |
| **Docs** | · | ✓ | ✗ | ✗ | ✗ | · | ✗ | ✓ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ~ | ✗ |
| **Files** | · | ✓ | ✓ | ✗ | ✗ | ✗ | · | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Meetings** | · | ~ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | · | ✗ |
| **AI** | · | ✓ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | · | ✓ | ✗ | ✗ | · | · |
| **Agent** | · | ✓ | ✗ | ~ | ~ | ~ | ✗ | ✗ | ✗ | ✗ | ✓ | · | ✗ | ✗ | · | · |
| **Workflow** | · | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | · | ✗ | · | · |
| **Apps** | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | ~ | ✗ |

Reading the matrix: the **Workspace row is dense** — tenancy is wired
everywhere. Every other row is sparse. Project, Task, Docs and Files connect
*downward* to the database and *sideways* to search, and to nothing else.

---

## 22. Tests added

**None.** This pass was audit-only, as agreed.

## 23. Tests passed

**Baseline not captured.** `nx` cannot run from this session: the connected
folder's `node_modules` holds the Windows-native Nx binary and the shell into
that folder is Linux, producing `TypeError: WorkspaceContext is not a
constructor`. Run `npm run validate` on the Windows host to record a real
baseline before remediation.

Existing coverage: 20 spec files. 5 API e2e (auth, health, infrastructure,
workspace, workspace-isolation), 2 Electron, 13 unit — mostly `libs/shared/ui`
primitives. `workspace-isolation.spec.ts` is the only cross-tenant security
test in the repository.

## 24. Remaining technical debt

- `workspace-settings-page.tsx` — 2,589 lines serving 8 routes.
- `use-channel-agents-apps.ts` — 19.6 KB of fabricated content shipped in the
  production bundle.
- `libs/web/settings` and `libs/web/profile` — vestigial libraries.
- `dist/` directories are committed inside `libs/api/*` and `libs/web/*`.
- `apps/api-e2e/out-tsc/` build output is committed.
- `any` casts in `agents.service.ts:119`, `mcp-tool-registry.service.ts:8,178`.
- `'m.direct' as never` casts throughout `matrix-client.ts` (SDK typing
  workaround — acceptable, but worth pinning behind a typed helper).
- `nodesJson`/`edgesJson`/`tools` stored as JSON **strings** rather than Prisma
  `Json` columns, so they are unqueryable and unvalidated.
- 270 TODO/FIXME/placeholder markers across `libs/` and `apps/`.

---

## 25. What NOT to change

Called out so a remediation pass does not "fix" working code:

1. `libs/api/auth/src/lib/guards.ts` — the guard stack is correct and its
   fail-closed choices are deliberate. Extend it; do not replace it.
2. The 404-instead-of-403 discipline. It is consistent and intentional.
3. `packages/matrix-client` as the single Matrix door.
4. `libs/shared/api-client/endpoints.ts` — a clean 1:1 map onto the API.
5. `WorkToolsService`'s "every query filters on workspaceId" rule — this is the
   pattern the new modules should copy.
6. The Postgres-backed search *as an interim*: its own comment explains the
   trade-off honestly and the shape is engine-agnostic.
7. `StorageService`'s server-generated keys and path-traversal backstop.

---

## 26. Ranked implementation backlog

Ordered by (risk × user-visible dishonesty) ÷ effort.

### Tier 0 — stop shipping false signals (days)

| # | Work |
| --- | --- |
| T0.1 | Remove or clearly label the fabricated channel agent/app feed (`use-channel-agents-apps.ts`) |
| T0.2 | Disable or label as "coming soon": billing upgrade, workflow canvas Save, Google Workspace connect, Slack/Notion import |
| T0.3 | Make `ai-infrastructure.service.ts` **fail loudly** when a provider is unconfigured instead of returning a fabricated string |
| T0.4 | Stop writing `toolCalls`/`tokensUsed`/`status` as literals in agent and workflow execution logs |

### Tier 1 — security (1–2 weeks)

| # | Work | Ref |
| --- | --- | --- |
| T1.1 | Validate `assigneeId`, `sprintId`, `milestoneId` against the workspace | S1 |
| T1.2 | Channel-membership filter on the activity feed | S2 |
| T1.3 | Channel-visibility filter in search | S3 |
| T1.4 | Route agent tools through the platform services with an acting user | S4, D5 |
| T1.5 | `MembershipStatus.ACTIVE` filter on `/matrix/*` membership checks | S5, S8 |
| T1.6 | Encrypt integration tokens; add a provider allowlist; build a real OAuth flow | S6, S7 |
| T1.7 | Shared-workspace check on `GET /users/:userId`; guard marketplace reviews | S9, S10 |
| T1.8 | MIME allowlist + scan hook on upload; stream instead of buffering | S12, S13 |
| T1.9 | Extend `workspace-isolation.spec.ts` into a full cross-tenant matrix (A→B for every resource) | §23 |

### Tier 2 — the connective tissue (3–5 weeks)

| # | Work | Ref |
| --- | --- | --- |
| T2.1 | Adopt `@nestjs/event-emitter` + an outbox table; emit the 21 missing events | §13 |
| T2.2 | Add a queue (BullMQ/pg-boss) and a worker process | §14 |
| T2.3 | Add `@nestjs/schedule`; activate `AgentSchedule`; add the Matrix reconciler | §14, B8 |
| T2.4 | Build a real `Notification` model + service; subscribe it to the event bus | DB12, §3 |
| T2.5 | Write `RecentActivity` for non-chat events | §5 |
| T2.6 | Search indexing subscriber (Postgres FTS first, Meilisearch later) | DB18 |
| T2.7 | Soft delete + restore across tenant resources | DB2 |
| T2.8 | Pagination on every list endpoint and its UI | S15, §9 |

### Tier 3 — make the AI/automation layer real (5–8 weeks)

| # | Work |
| --- | --- |
| T3.1 | Real provider clients (OpenAI/Anthropic/Gemini) with streaming, tool calling and usage accounting |
| T3.2 | Qdrant client; call `ingestDocumentForRAG` from document and message writes; real embeddings |
| T3.3 | Permission-aware context assembly for AI requests (retrieve only what the caller may see) |
| T3.4 | Agent runtime: real tool loop, memory (`AIMemory`), knowledge, per-agent permissions, schedules |
| T3.5 | Workflow engine: edges, real conditions, real actions via platform APIs, triggers from the event bus, retry/timeout/idempotency/cancellation |
| T3.6 | Persist sidebar registries and the agent-builder graph to the database |

### Tier 4 — the missing product surface (8+ weeks)

Accounts/multi-account · project membership · custom fields, statuses, views ·
document versions and comments · meetings with transcripts and AI summaries ·
generic connector architecture with OAuth and webhooks · real import with
mapping/checkpoint/resume/verification · export · billing · configurable
dashboards · workspace audit log.

---

## Appendix — how to reproduce the headline findings

```bash
# No event system
grep -rn "EventEmitter2\|@OnEvent\|eventEmitter.emit" --include='*.ts' libs apps   # → 0 results

# One activity writer
grep -rn "recentActivity.create" --include='*.ts' libs apps | grep -v generated
# → libs/api/matrix/src/lib/matrix-sync.service.ts:111

# Agent tools are dead code
grep -rn "executeTool" --include='*.ts' libs apps
# → only the definition and the export; no call site

# RAG is never fed
grep -rn "ingestDocumentForRAG" --include='*.ts' libs apps
# → only the definition

# No export capability
grep -rniE "exportJob|exportWorkspace|createExport" --include='*.ts' libs/api      # → 0 results

# No queue or scheduler
node -e "const p=require('./package.json');console.log(Object.keys({...p.dependencies}).filter(d=>/bull|schedule|event-emitter|agenda/.test(d)))"
# → []

# Organization is an island
grep -n "organizationId" prisma/schema.prisma
# → only Department, SSOConfig, EnterpriseAuditLog, OrganizationSubscription

# No soft deletion
grep -c "deletedAt" prisma/schema.prisma                                          # → 0
```
