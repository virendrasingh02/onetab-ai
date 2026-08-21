# PLATFORM_FEATURE_MATRIX.md

**Repository:** `D:\Onetab-AI\onetab-ai` · **Assessed:** 2026-08-21
**Companion documents:** `PLATFORM_ARCHITECTURE.md`, `PLATFORM_AUDIT_REPORT.md`

---

## Grading scale

The levels are cumulative — a capability cannot be `CONNECTED` unless it is
`IMPLEMENTED`, and so on.

| Level | Means |
| --- | --- |
| `NOT_STARTED` | No model, no route, no service. A UI shell alone does not count. |
| `PARTIAL` | Some of it exists; a required part of the core loop is missing, stubbed or fabricated. |
| `IMPLEMENTED` | The feature works on its own: create/read/update/delete persist correctly and are tenant-scoped. |
| `CONNECTED` | It also participates in the platform — events, notifications, activity, search, permissions across modules. |
| `TESTED` | Automated tests cover the behaviour, including the permission boundary. |
| `PRODUCTION_READY` | All of the above **and** verified end-to-end against the real journey. |

**Nothing is graded `PRODUCTION_READY` in this pass.** The bar requires an
end-to-end verification run, and the build/test suite could not be executed from
this session (Windows-native `nx` binary, Linux shell — see audit report §23).
Two areas are within one verification run of it, and are marked `TESTED`.

**Grading is evidence-based, not aspirational.** Where a screen renders
convincingly over a stub, the grade reflects the stub.

---

## Summary

| Level | Count | Areas |
| --- | --- | --- |
| `NOT_STARTED` | 9 | Accounts, Multi-account, Meetings, Knowledge, Export, Billing, Custom Fields, Custom Views, Dashboards (configurable) |
| `PARTIAL` | 14 | Roles/Permissions (cross-module), Docs, Files, Search, AI, AI Agents, Agent Builder, Apps, Integrations, Workflows, Notifications, Inbox, Import, Customization, Audit, Automation |
| `IMPLEMENTED` | 7 | Projects, Tasks, Templates (prompt-only), Marketplace, Analytics, Security (core), Admin |
| `CONNECTED` | 5 | Users, Channels, DMs, Members/Invitations, Uploads-in-channels |
| `TESTED` | 2 | Authentication, Workspaces |
| `PRODUCTION_READY` | 0 | — |

---

## 1–36 · Product areas

### Foundation

| # | Area | Level | Evidence / what is missing |
| --- | --- | --- | --- |
| 1 | **Accounts** | `NOT_STARTED` | No `Account` model. `Organization` exists but has no relation to `Workspace` or `User` (`schema.prisma:665–679`). |
| 2 | **Multi-account** | `NOT_STARTED` | No account membership, no account switcher. The workspace switcher is a different concept. |
| 3 | **Workspaces** | `TESTED` | Full CRUD, slug suggestion, logo, archive/restore/transfer, per-request membership re-check, archived write-freeze. `workspace.spec.ts` + `workspace-isolation.spec.ts`. Missing for `PRODUCTION_READY`: end-to-end journey verification; no account tier above it. |
| 4 | **Users** | `CONNECTED` | Profile, status, presence, workspace-scoped search. **`GET /users/:userId` has no shared-workspace check** (audit S9). No tests. |
| 5 | **Roles** | `IMPLEMENTED` | `SystemRole` + `WorkspaceRole` with a permission matrix and the only real unit test of business logic (`permissions.spec.ts`). |
| 6 | **Permissions** | `PARTIAL` | Excellent at the workspace boundary; absent below it — no project, document or file-level permissions; AI and agents bypass it entirely (audit S4). |
| 7 | **Security** | `PARTIAL` | Fail-closed guards, 404-not-403 discipline, throttling, helmet, path-traversal backstop, tokens withheld from responses. Offset by 17 open findings, 7 of them High (audit §8). |
| 8 | **Audit** | `PARTIAL` | `EnterpriseAuditLog` is organization-scoped and operator-only. No workspace-level audit trail; no `WorkspaceAuditLog`. |

### Communication

| # | Area | Level | Evidence / what is missing |
| --- | --- | --- | --- |
| 9 | **Channels** | `CONNECTED` | 18 routes, visibility enforced, members, pins, prefs, read markers, files, Matrix room linking with a correct membership check. Connected to activity, notifications and search. **Not** connected to projects, tasks, agents or workflows. No tests. |
| 10 | **DMs** | `CONNECTED` | Client-side room creation with `m.direct`; peer identity requires a shared workspace. **Dedup bug:** matches any 2-person room, including a private channel's (audit B4). |
| 11 | **Members** | `CONNECTED` | List, role change, remove, leave; suspended-member handling in the guard. |
| 12 | **Invitations** | `CONNECTED` | Create, list, revoke, accept-by-token. No email delivery. |
| 13 | **Meetings** | `NOT_STARTED` | No `Meeting` model. `MeetingsView.tsx` (653 lines) renders `CalendarEvent` rows plus a hardcoded app catalogue. No transcript, summary, decisions or meeting→task. |

### Work management

| # | Area | Level | Evidence / what is missing |
| --- | --- | --- | --- |
| 14 | **Projects** | `IMPLEMENTED` | CRUD, milestones, sprints, ticket prefixes, column order. **No members, no permissions, no events, no activity, no soft delete** — a project delete cascades irreversibly to its tasks and comments. |
| 15 | **Tasks** | `IMPLEMENTED` | CRUD, comments, kanban ordering with respacing, transaction-safe ticket numbers. **No subtasks, dependencies, recurrence, custom fields, attachments, bulk actions, notifications, activity or events.** `assigneeId`/`sprintId`/`milestoneId` are unvalidated (audit S1). |
| 16 | **Docs** | `PARTIAL` | CRUD + a self-referencing tree with correct cross-tenant parent checks. **No versions, no comments, no mentions, no per-doc permissions, no autosave endpoint, no RAG ingestion, no export.** |
| 17 | **Files** | `PARTIAL` | Size cap, tenancy check, sharded server-generated keys, checksum, traversal backstop. **No MIME allowlist, no scan, no versions, no archive/restore, no link to tasks or docs, fully buffered in memory** (audit S12, S13). |
| 18 | **Templates** | `PARTIAL` | `PromptTemplate` (AI prompts) is fully implemented. No project, document or task templates. |
| 19 | **Custom Fields** | `NOT_STARTED` | No model, no storage, no API. |
| 20 | **Custom Views** | `NOT_STARTED` | No saved-view model; view state is component-local. |
| 21 | **Customization** | `PARTIAL` | Themes ✓ and notification preferences ✓ are real. Navigation favourites are `localStorage` only. No custom statuses (fixed enum), no layouts, no AI preferences, no shortcuts, no inheritance model. |
| 22 | **Dashboards** | `PARTIAL` | `dashboard-page.tsx` is a well-built **fixed** dashboard reading real analytics. No widget model, no layout persistence, no configurability. |

### Intelligence

| # | Area | Level | Evidence / what is missing |
| --- | --- | --- | --- |
| 23 | **AI** | `PARTIAL` | Only the Ollama path attempts a real call. `summarize`, `translate`, `vision`, `generateImage` and `generateEmbedding` return fabricated values; `openai`/`anthropic`/`gemini` are accepted and silently fabricate. RAG returns `[]` always. No streaming, no tool calling, no context assembly, no usage accounting (audit M2, B7). |
| 24 | **AI Agents** | `PARTIAL` | CRUD and execution-log rows are real and correctly scoped. Execution **does not call tools** — the registry's `executeTool` has zero call sites; `toolCalls` and `tokensUsed` are falsified (audit B5). No memory, no knowledge, no schedules, no permissions. |
| 25 | **Agent Builder** | `PARTIAL` | A capable ReactFlow canvas (747 lines) whose graph persists to `localStorage`, not to the database. |
| 26 | **Knowledge** | `NOT_STARTED` | No model, no service, no route. |
| 27 | **Automation** | `PARTIAL` | See Workflows. |
| 28 | **Workflows** | `PARTIAL` | CRUD and execution history are correctly workspace-scoped (`automations.service.ts` is well written). The **engine is a stub**: edges ignored, conditions always true, API/webhook actions fabricated, status always `SUCCESS`, no triggers, retry, timeout, cancellation or idempotency (audit M5, B6). The canvas's Save button persists nothing (audit B1). |

### Platform

| # | Area | Level | Evidence / what is missing |
| --- | --- | --- | --- |
| 29 | **Search** | `PARTIAL` | Six categories over Postgres `ILIKE`, with an honest comment about the trade-off. **Leaks private channels to non-members** (audit S3). No index, no ranking, no semantic search, unindexed content scan. |
| 30 | **Notifications** | `PARTIAL` | Preferences, mute, quiet hours, push registration are real and well built. The feed is fed **only** by Matrix messages, has no per-user read state, no deep links, no batching, no email. Leaks private-channel activity (audit S2). |
| 31 | **Inbox** | `PARTIAL` | `InboxView` is one of the better-built screens (loading + empty + retry) over a feed with the gaps above. |
| 32 | **Apps** | `PARTIAL` | `AppChatView` renders a static `DEFAULT_WORKSPACE_APPS` catalogue. Connected apps live in `localStorage`. No app contract, no actions, no triggers. |
| 33 | **Integrations** | `PARTIAL` | Connection rows, connect/disconnect, tokens withheld from responses. **No OAuth** — the access token arrives in the request body and is stored in plaintext (audit S6, S7). No webhooks, actions or triggers. |
| 34 | **Marketplace** | `IMPLEMENTED` | Substantial and real: listings, storefronts, categories, reviews, installations, plugin registration, key rotation, manifest validation, scope checks (`marketplace.service.ts` 634 lines + `plugin-sdk.service.ts` 333). **Installing has no effect** — no agent, integration or workflow is created. Several routes ungated (audit S10). |
| 35 | **Analytics** | `IMPLEMENTED` | The most complete non-core module (2,022 lines): dashboards, six report types, CSV export, error tracking, health, a telemetry interceptor. Some series read tables that only fabricated executions write. |
| 36 | **Import / Export** | `PARTIAL` / `NOT_STARTED` | Import: `ImportJob` rows plus channel/document creation from **request-body data** — no Slack or Notion API call exists, and the job is marked `COMPLETED` before any work (audit M3, M4). Export: nothing at all. |

---

## Cross-cutting capability grid

For each area, whether the eight cross-cutting concerns from the brief are wired.

Legend: `✓` present · `~` partial · `✗` absent · `·` n/a

| Area | CRUD | Persist | Perms | Events | Notify | Activity | Search | AI | Tests |
|---|---|---|---|---|---|---|---|---|---|
| Auth | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | · | · | ✓ |
| Workspaces | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | · | ✗ | ✓ |
| Users | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Members | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Invitations | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Channels | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ~ | ✗ | ✗ |
| DMs | ✓ | ✓ | ✓ | ~ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Projects | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✓ | ~ | ✗ |
| Tasks | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✓ | ~ | ✗ |
| Docs | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✓ | ~ | ✗ |
| Files | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Meetings | ~ | ~ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Search | · | · | ~ | ✗ | · | · | · | ✗ | ✗ |
| Notifications | ✓ | ✓ | ~ | ✗ | · | ✓ | ✗ | ✗ | ✗ |
| AI | · | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | · | ✗ |
| Agents | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Workflows | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ |
| Apps | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Integrations | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Marketplace | ✓ | ✓ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Analytics | ✓ | ✓ | ✓ | ~ | ✗ | ~ | ✗ | ✗ | ✗ |
| Import | ~ | ~ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Export | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Billing | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | · | ✗ |
| Admin | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Enterprise | ~ | ✓ | ✓ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ |

The `Events` column is empty across the entire platform because no event system
exists. That single column is the highest-leverage fix in the repository:
`Notify`, `Activity` and `Search` all become tractable once it is filled.

---

## End-to-end journey status

The six journeys from the brief, graded on whether they complete today.

| # | Journey | Status | Breaks at |
| --- | --- | --- | --- |
| 1 | User → Account → Workspace → Channel → Matrix → Message → Task → Project → Agent → Workflow → Notification | **Broken** | *Account* (does not exist); then again at *Message → Task* (no link), *Agent* (no tool execution), *Workflow* (stub engine), *Notification* (not emitted) |
| 2 | User → Project → Task → Doc → File → AI → Agent → Workflow | **Broken** | *Doc → File* (no attachment link); *File → AI* (no ingestion); *AI → Agent* works; *Agent → Workflow* has no link |
| 3 | External Platform → Import → Mapping → Matrix → Platform DB → Search → AI → Verification | **Broken** | *External Platform* — no API call is made; data comes from the request body. Nothing downstream runs |
| 4 | Meeting → Transcript → AI Summary → Decisions → Tasks → Project → Notification | **Broken** | *Meeting* — no model, no transcript pipeline |
| 5 | AI → Search → Knowledge → Permission → Agent → Tool → Platform API → Event → Result | **Broken** | *Search* (AI cannot call search); *Knowledge* (absent); *Tool* (`executeTool` unreachable); *Event* (no bus) |
| 6 | Workflow → Trigger → Condition → Agent → App → Task → Notification → Activity | **Broken** | *Trigger* (only manual POST); *Condition* (always true); every step after it |

**Journeys that do complete today** (not in the brief, but worth recording as
the platform's real capability):

- User → Login → Workspace → Channel → Matrix room → Message → Thread →
  Reaction → Push notification → Inbox activity ✓
- User → Workspace → Project → Task → Kanban move → Comment ✓
- User → Workspace → Upload → Channel file list → Download ✓
- User → Workspace → Invite → Accept → Membership → Role change → Removal ✓
- Operator → Admin console → Users / Workspaces / Organizations / Audit logs ✓

---

## Re-grading criteria

For the next pass, a capability moves up a level when:

- → `IMPLEMENTED`: every write persists, every read is tenant-filtered, and no
  value in the response is a literal or a fabrication.
- → `CONNECTED`: it emits its events, appears in activity, is indexed for
  search, respects permissions when reached through AI or an agent, and its
  notifications reach the right people.
- → `TESTED`: it has unit tests for its rules and at least one API e2e test that
  asserts the cross-tenant boundary (workspace A cannot reach workspace B's
  instance of the resource).
- → `PRODUCTION_READY`: the relevant journey in the table above completes
  end-to-end against a running stack, verified — not inferred from the code.
