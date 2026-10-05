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
| G4 | ~~Monitor policy mismatch~~ | **Resolved 2026-10-01.** Any member may own monitors on a shared coworker. Only the monitor's owner, the coworker's creator, or an admin may edit, pause, delete or run it. Guests may do none of these. The rule is `canManageTrackerMonitor` (`@org/types`), shared by the API (`CoworkersService`) and the UI (`useCanManageTrackerMonitor`). Verified live with two test members. |
| G5 | **Ecosystem analytics** | Coworker and workflow success rates and run volume aren't in `@org/web-analytics` yet. The data is in `AIExecution`. |
| G6 | **More coworker templates** | The framework is ready. Add Researcher, Writer, etc. as `COWORKER_TEMPLATES` entries with `seedByDefault: false`, and offer them in `CoworkerCreateDialog`. |
| G7 | **Coworker chat identity** | A newly seeded coworker's Matrix identity 404s until provisioned, so the chat pane shows "Could not open the conversation". This is pre-existing and Matrix-side; the dev homeserver is also flaky. |
| G8 | ~~Duplicate defaults in `dev-space`~~ | **Resolved 2026-10-01.** The two empty duplicates were deleted at the owner's request, keeping one Scheduler and one Tracker. No workspace has duplicate defaults now. |
| G9 | **Handoff with a live model** | Handoff is covered by unit tests. It hasn't been exercised with a real model, because the dev LLM providers fall back to Ollama or error. |
| G10 | Small | The search `category` query parameter is unvalidated. The members page shows "Workspace RAG Active" unconditionally. |

## 4. Roadmap by phase (do in this order)

The phases follow the brief (§35). ✅ done, 🟡 partly done, ⬜ not started. Within a phase, items are listed in the order to do them. The **G** numbers point to §3.

### Phase 1 — Audit and foundation · 🟡
1. ✅ Audit and implementation map (this document).
2. ✅ Event catalog: coworker lifecycle, handoff and monitor events added to `AppEvent`.
3. ✅ Coworker template framework (`COWORKER_TEMPLATES`).
4. ⬜ **Typed app registry (G1).** Move app metadata (id, label, route, category, capabilities, linked tools, required permission) into `@org/types`. Derive `DEFAULT_NAV_ITEMS`, `page-title.ts` and the mobile tabs from it, and remove the copied labels.
5. ⬜ Map each registry app to the tools it exposes (`platform-tools.ts`), so Studio and coworkers read "what this app can do" from one place.
6. ⬜ Small fixes (G10): validate the search `category` parameter, and show the members page "Workspace RAG Active" badge only when it's true.

### Phase 2 — Ecosystem UX · 🟡
1. ✅ AI Activity on the dashboard; upcoming meetings in "What next".
2. ✅ Search covers meetings and workflows; doc snippets are readable.
3. ⬜ **Decide what Home is (G3).** Recommendation: make the dashboard the workspace index, with an "Ask or delegate" prompt at the top that opens the assistant or Studio (`ai/studio/new?prompt=`).
4. ⬜ **AI rows in Pulse (G2).** Add AI kinds to `ActivityKind` (hand-written migration) and write rows from `coworker.completed`, `coworker.failed`, `coworker.monitor.triggered` and `ai.run.finished`.
5. ⬜ App discovery page built from the registry (Phase 1.4) instead of separate hardcoded lists.
6. ⬜ Responsive pass on the new dashboard section and the coworker profile at phone and tablet widths.

### Phase 3 — Coworkers · 🟡
1. ✅ Scheduler and Tracker get their write grants and act for the person asking.
2. ✅ Tracker monitors are checked on schedule and on demand.
3. ✅ Coworker-to-coworker handoff.
4. ✅ **Monitor ownership policy (G4).** Any member owns their monitors; the owner, the coworker's creator or an admin may manage them. REST and the chat tool now agree.
5. ⬜ **Monitor UI.** Create, edit and pause monitors from Tracker's profile. Today they can only be made through chat or the API.
6. ⬜ **Coworker chat identity (G7).** Provision the Matrix identity when a default is seeded, so the chat pane always opens.
7. ⬜ **Live handoff test (G9)** once a working model provider is configured in dev.
8. ⬜ **More templates (G6):** Researcher, Writer, Meeting Assistant, offered in `CoworkerCreateDialog`.

### Phase 4 — Workflows and events · 🟡
1. ✅ Coworker events trigger workflows; the canvas and Studio share one trigger list.
2. ⬜ A "When Tracker finds overdue work" Studio template (`agent-templates.ts`): monitor triggered → notify the assignees' lead → summary doc.
3. ⬜ Show approval requests raised by a coworker's gated tool calls in the same Approvals view as workflow approvals, then check end to end.
4. ⬜ A durable delay node: delays over 15 s are refused today, which needs a scheduler (`AI_AGENT_STUDIO.md`).

### Phase 5 — Agent Studio integration · 🟡
1. ✅ The Studio is in-app at `/w/:slug/ai` (see `AI_AGENT_STUDIO.md`).
2. ⬜ Create a coworker from a Studio template, not only agents and workflows.
3. ⬜ Studio follow-ups: the "Created by agent" chip on tasks; remove the old simulated `agent-studio-ai-mode.service.ts`; decide on deleting the standalone `apps/ai-agent-studio`.

### Phase 6 — Integrations · ⬜
1. ⬜ Check that every connected integration's actions reach coworkers through `IntegrationToolBridgeService`, with read/write permission levels shown in the coworker profile.
2. ⬜ An `integration.failed` event, so workflows and notifications can react to broken connections.
3. ⬜ Let Scheduler use calendar integrations (Google Calendar) for "create a calendar event when authorized".

### Phase 7 — Analytics and admin · ⬜
1. ⬜ **Ecosystem metrics (G5):** coworker runs and success rate, workflow runs and success rate, monitor findings. Built from `AIExecution` with the existing Recharts and date-range components in `@org/analytics-ui`.
2. ⬜ Admin console: list coworkers, agents and workflows per workspace, with switch-off and audit.
3. ⬜ Audit-log entries for coworker permission changes and monitor creation.

### Phase 8 — Final ecosystem audit · ⬜
1. ⬜ Run the brief's §24 flow end to end ("Track our product launch and remind the team about anything overdue"): request → Tracker monitor on the project → overdue found → assignees notified → activity → summary.
2. ⬜ Re-check §36 (definition of done) item by item, including Electron and mobile.

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
