# AI Work Ecosystem — Audit and Implementation Map

Status as of 2026-10-01. Everything in "Done in this pass" is **uncommitted** on `main`. Typecheck, lint and tests are green on all touched projects.

The brief asks for one connected system: apps, coworkers, workflows, events, search and notifications. The audit found that most of that architecture **already exists and is real**. The gaps were in the connections, not in the foundations. So this pass connects and completes what exists rather than adding parallel systems.

## 1. What already exists (reused, not rebuilt)

| Brief § | Concept | Where it lives | State |
| --- | --- | --- | --- |
| 5 | Workspace boundary | `WorkspaceRoleGuard`. Every service takes `workspaceId` first. | Solid |
| 6 | App registry | `libs/web/layout/src/lib/navigation/navigation.config.ts` (`DEFAULT_NAV_ITEMS`/`GROUPS`) drives the sidebar, customizer, command palette and page titles | Exists. See gap G1 |
| 7 | AI Home | `DashboardPage` (`/w/:slug/dashboard`): attention, catch-up, "continue", "what next". Backed by `IntelligenceController` (`attention`, `catch-up`) | Extended this pass |
| 8 | Coworker model | `AIAgent` with `type: 'coworker'`, linked to channels, projects, agents and apps. Runtime is `AIRuntimeService` | Extended this pass |
| 9 | Tool registry | `MCPToolRegistryService` + `platform-tools.ts`. Tools call domain services (`WorkToolsService`), not raw writes | Solid |
| 11 | Event bus | `libs/api/common/src/lib/events.ts` (`AppEvent`, typed payloads). Listeners feed notifications, realtime, Matrix timeline, automations and RAG | Solid. Coworker events added |
| 12–13 | Automation + workflow builder | One engine (`WorkflowEngineService`) for canvas workflows and Studio agents. Node types include `AI_COWORKER`, `AGENT`, `HUMAN_APPROVAL`, `CONDITION`, MCP and HTTP | Solid |
| 14 | Agent Studio | In-app at `/w/:slug/ai` (see `AI_AGENT_STUDIO.md`) | Solid |
| 15 | Knowledge / memory | `KnowledgeBase`/`KnowledgeChunk`, `AIMemory`. The runtime keeps knowledge, memory and conversation separate | Exists |
| 16 | Search | `SearchService` (Postgres FTS + ILIKE) and `FederatedSearchService`. Command palette and `/search` | Extended this pass |
| 17 | Notifications | `NotificationCenterService`, one pipeline (bell, desktop, sound) | Solid |
| 19 | Permissions | Workspace RBAC, `canManageOwnedAIResource`, coworker `permissions.allowActions`, approvals | Solid |
| 20 | Integrations | `ExternalIntegration` and `IntegrationToolBridgeService`, which exposes app actions as tools | Exists |
| 28–29 | Observability / approvals | `AIExecution` + steps, run statuses (Running / Waiting / Paused / Completed / Failed / Cancelled), `ApprovalRequest` with approve / reject / edit | Solid |

## 2. Done in this pass

### Coworkers: Scheduler and Tracker now actually work
- **Write grants were missing.** A coworker turn only offers writes listed in `permissions.allowActions`. The seeded Scheduler and Tracker listed their writes in `tools` but had no `allowActions`, so Scheduler could not create reminders and Tracker could not create monitors. Defaults are now seeded with grants. Older rows missing the key are backfilled, and a key the workspace set (even an empty one) is left alone.
- **Default coworkers had no one to act for.** Built-in tools act as the entity's creator, and lazily seeded defaults have none, so every write failed with "no owner on record". A creator-less coworker now acts as **the person asking** (`AIEntityTurnContext.requesterId`), resolved from the chat sender, the API caller, or the workflow's owner. It never acts with more access than that person.
- **Coworker framework.** Added `COWORKER_TEMPLATES` in `@org/types` (`coworker-templates.ts`): identity, instructions, tools, grants, capabilities and collaborators. Scheduler and Tracker are data now, not hardcoded seed blocks. Future coworkers (Researcher, Writer…) are new template entries. The web UI detects a coworker's kind by `configuration.coworkerType` instead of by name substring.
- **Seeding race.** Concurrent first loads seeded each default twice (seen in `dev-space`). Seeding now runs under a per-workspace Postgres advisory lock. The no-op case is one read with no transaction. A renamed default is not re-created.

### Tracker monitors are checked
Monitors used to be stored and never read. `TrackerMonitorSweepService` (`@org/api-agents`) now runs every 5 minutes:
- `classifyMonitor` reads each condition as one deterministic check: overdue, due soon (24 h), completed, changed, or project progress. It reports **unsupported** rather than guessing.
- Scope is the whole workspace or one named project. An unknown project produces a plain error, not a silent workspace-wide watch.
- The first check reports everything that already matches. Later checks report only what's new.
- Findings go to the owner, to **each assignee about their own tasks**, and/or to a `#channel` (posted as the coworker, with the owner's right to post).
- Each check is written to the coworker's activity log and raised as `coworker.monitor.triggered`.
- A monitor whose owner left the workspace stops reporting.
- "Check now": `POST …/coworkers/:id/monitors/:monitorId/check`.
- Monitor create and update bodies are now Zod-validated. Previously `@Body() body: any` let a caller set `createdBy` (whose authority a monitor uses) or fake `lastCheckedAt`.
- The `create_monitor` tool used to report success when no Tracker existed. It now fails honestly, and refuses conditions it can't check.

### Coworker collaboration
Coworkers can hand work to the coworkers they collaborate with: template collaborators (Scheduler ↔ Tracker) or explicit `configuration.collaborators`. The tool is `handoff_to_coworker_<id>`. The receiving coworker runs a full turn with its own tools, for the same person. Handoffs share the delegation depth cap, so chains can't loop. A coworker can't hand work to anyone it wasn't offered.

### Events
New `AppEvent`s: `coworker.started`, `coworker.completed`, `coworker.failed`, `coworker.handoff`, `coworker.monitor.triggered`. They're emitted from `AIRuntimeService` and the monitor sweep.
- `coworker.completed`, `coworker.failed` and `coworker.monitor.triggered` are **workflow triggers**. They're in `AGENT_EVENTS`, the Studio validation, and `AutomationTriggerListener`, which already guards against loops and test runs.
- The canvas builder's separate trigger list (`WORKFLOW_EVENTS`) duplicated a subset of `AGENT_EVENTS`. It is now derived from it.

### AI Home
`DashboardPage` gained an **AI Activity** section (`ai-activity-section.tsx`):
- Last-24-hour run counts (running / waiting / failed / done), excluding test runs.
- Pending approvals.
- What each coworker did recently, with links.

"What next" now leads with upcoming meetings. Both use the existing query keys, so the Runs and Approvals screens share the cache.

### Search
- Added **meetings** and **workflows & Studio agents** categories.
- Fixed agent results linking to a legacy redirect that dropped the id.
- `SearchCategory` and `SearchResultItem` are defined once (`@org/types`); the API copy is gone. The palette and `/search` page share one category map (`search-categories.ts`).
- Doc snippets showed the editor's raw JSON envelope. `docContentToText` moved to `@org/utils` and is shared by search and agents.

### Smaller fixes
- Agent-created reminders had a broken deep link (`/w/<id>/schedule`). Their notification text no longer says "about this message".
- The coworker profile showed every successful run with a red dot: logs are written `SUCCESS`, but the UI checked for `COMPLETED`.
- Coworker delete uses the shared `confirm()` instead of `window.confirm`.
- "Check now" is hidden from people the server would refuse.

### Verified live
Signed in as a seeded test user on the local stack and confirmed:
- Defaults are seeded with grants.
- A monitor was checked by the running API's 13:00 sweep. It found the real overdue task (RCS-4, 2 days late), notified with a deep link, logged under Tracker, and showed on the dashboard and on Tracker's profile.
- Search returns meetings and workflows, with readable doc snippets.
- REST correctly refuses monitor changes from a non-admin member.

The test monitor was removed afterwards.

## 3. Open gaps (next passes), most valuable first

| # | Gap | Notes |
| --- | --- | --- |
| G1 | **Typed app registry** | `DEFAULT_NAV_ITEMS` is the de facto registry, but labels are repeated in `page-title.ts` and `mobile-bottom-nav.tsx`, and nothing records capabilities or tools per app. Next step: move app metadata (id, route, category, capabilities, linked tools) into `@org/types` and derive nav, titles and the Studio tool catalog from it. |
| G2 | **AI rows in the activity feed (Pulse)** | `RecentActivity.kind` (`ActivityKind`) has no AI kinds, so coworker and workflow outcomes show on the dashboard but not in Pulse. Needs an enum migration (hand-written; `migrate dev` is broken here) plus a listener on the new coworker events. |
| G3 | **Which page is Home** | `/w/:slug` renders `AIChatView`; the AI Home content is `/dashboard`. Making the dashboard the index (with the assistant prompt on top) is a product decision. |
| G4 | **Monitor policy mismatch** | Through chat, any member can ask Tracker to create a monitor they own. Through REST, only the coworker's creator or an admin can. Decide whether members may own monitors on shared coworkers. |
| G5 | **Ecosystem analytics** | Coworker and workflow success rates and run volume aren't in `@org/web-analytics` yet. The data is in `AIExecution`. |
| G6 | **More coworker templates** | The framework is ready. Add Researcher, Writer, etc. as `COWORKER_TEMPLATES` entries with `seedByDefault: false`, and offer them in `CoworkerCreateDialog`. |
| G7 | **Coworker chat identity** | A newly seeded coworker's Matrix identity 404s until provisioned, so the chat pane shows "Could not open the conversation". This is pre-existing and Matrix-side; the dev homeserver is also flaky. |
| G8 | **Duplicate defaults in `dev-space`** | Two Scheduler and two Tracker rows were created before the race fix. Both are empty (no logs or links). They were left in place: deleting them is the owner's call. |
| G9 | **Handoff with a live model** | Handoff is covered by unit tests. It hasn't been exercised with a real model, because the dev LLM providers fall back to Ollama or error. |
| G10 | Small | The search `category` query parameter is unvalidated. The members page shows "Workspace RAG Active" unconditionally. |

## Where the code is

| Area | Files |
| --- | --- |
| Coworker templates | `libs/shared/types/src/lib/coworker-templates.ts` |
| Seeding + grants | `libs/api/agents/src/lib/ai-entities.service.ts` (`initializeDefaultCoworkers`) |
| Requester, handoff, lifecycle events | `libs/api/agents/src/lib/ai-runtime.service.ts` |
| Monitors | `libs/api/agents/src/lib/tracker-monitors.ts`, `tracker-monitor-sweep.service.ts`; `libs/api/coworkers/src/lib/coworkers.service.ts` |
| Events | `libs/api/common/src/lib/events.ts`; `libs/api/automations/src/lib/automation-trigger.listener.ts`; `libs/shared/types/src/lib/agent-blueprint.ts` |
| AI Home | `libs/web/dashboard/src/lib/ai-activity-section.tsx` |
| Search | `libs/api/search/src/lib/search.service.ts`, `libs/web/search/src/lib/search-categories.ts`, `libs/shared/utils/src/lib/doc-text.ts` |

```bash
npm exec nx -- run-many -t typecheck,lint,test -p @org/types,@org/utils,@org/validation,@org/api-common,@org/api-agents,@org/api-coworkers,@org/api-automations,@org/api-notifications,@org/api-search,@org/api-client,@org/web-dashboard,@org/web-coworkers,@org/web-search,@org/web-members,@org/web-automations
```
