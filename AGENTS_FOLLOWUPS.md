# AI Agents / Agentic AI — status & follow-ups

Milestone 1 of the "AI Agents + Agentic AI" brief: close the ~10 concrete,
well-defined gaps a 6-way codebase audit found between already-working
subsystems (real Agent/Coworker runtime, tool-calling loop, Matrix chat
bridge, React Flow workflow engine, 10 integration providers, marketplace
install flow). This file records what shipped, the architecture decisions
behind it, and what's explicitly deferred. All work below is uncommitted.

## What shipped

1. **Tool registry gets the 73 real integration actions.** New
   `IntegrationToolBridgeService` (`libs/api/agents/src/lib/integration-tool-bridge.service.ts`)
   turns an entity's connected apps (`CoworkerApp` rows — shared by Agents and
   Coworkers despite the model name) into namespaced OpenAI tool schemas
   (`github_create_issue`, …) alongside `MCPToolRegistryService`'s 7 built-ins.
   Execution routes through the existing `IntegrationsService.executeAction`,
   so permission checks (`assertIntegrationAccess`) and audit logging are
   unchanged, not duplicated. This also closes the "no NL routing to apps"
   gap noted in `app-matrix-bridge.service.ts`'s own docstring — an agent's
   tool-calling loop now gives natural-language → action routing for free.
2. **Approval checkpoints in the direct agent runtime.** `AIRuntimeService`'s
   tool loop now raises a real `ApprovalRequest`
   (`ApprovalsService.createForEntityAction`, `@org/api-ai`) before running a
   `destructive`/`requiresConfirmation` integration action, and tells the
   model the action is pending rather than executing it. A new
   `AgentApprovalDecidedEvent` (`AppEvent`, `@org/api-common`) — emitted by
   `ApprovalsService.decide()` — is consumed by a new `AgentApprovalListener`
   (`@org/api-agents`) that runs the approved action for real via
   `IntegrationsService.executeAction` and posts the outcome back into the
   room. Event-based rather than a direct call because `api-ai` must not
   depend on `api-agents`, which already depends on it. **Simplification**:
   the run itself does not literally pause and resume the same LLM
   conversation — it completes normally with the action queued, and the
   approved/rejected outcome is delivered as a separate follow-up message.
   This is simpler and more robust than serializing mid-loop chat state, and
   is honestly more functional than the workflow engine's own
   `HUMAN_APPROVAL` node today (see deferred item 1 below).
3. **Agent Memory wired.** The previously dead `AIMemory` table now has real
   read/write paths: `save_memory`/`list_memory` tools
   (`MCPToolRegistryService`), injected into every turn's system prompt
   (`AIRuntimeService.buildMemoryContext`), plus a `GET/DELETE
   /workspaces/:id/ai/memory` surface (`AIMemoryController`/`AIMemoryService`,
   `@org/api-ai`) and a "Workspace Memory" panel in `AgentProfileRightPanel`
   for inspection/deletion. Scope note: `AIMemory` has no per-agent column, so
   this is workspace-shared memory only (see deferred item 2).
4. **Agents now respect their own configured tool list.** `entity.tools`
   (an existing `AIAgent` JSON field, previously read but never enforced) is
   now the actual allow-list `executeAgentTurn` passes to
   `MCPToolRegistryService.getToolSchemasFor` — an Agent no longer sees every
   built-in tool regardless of configuration.
5. **Knowledge retrieval reconnected to real vector search.**
   `KnowledgeService.ingestDocument` now embeds and upserts chunks into the
   KB's own Qdrant collection (`kb.vectorCollection`, previously unused); an
   embedding-provider failure degrades to keyword-only for that document
   rather than failing the ingest. `retrieve()` tries vector search first,
   falling back to the existing Postgres `contains` search only when vector
   search is unavailable or returns nothing (e.g. pre-existing un-embedded
   documents). Bridges two already-correct systems that simply never called
   each other.
6. **Workflow engine's AGENT/AI_COWORKER/TOOL/MCP nodes are real.**
   `WorkflowEngineService.executeNodeStep` now calls
   `AIRuntimeService.executeTurn` for AGENT/AI_COWORKER nodes (reading the
   canvas's actual `agentId`/`goal` and `coworkerId`/`task` config fields, not
   the `entityId` the old stub assumed) and resolves TOOL/MCP nodes against
   the built-in registry first, then a provider's connected integration
   actions via the canvas's `provider.actionId` convention (e.g.
   `slack.postMessage`) — failing openly with a clear error when neither
   resolves, rather than fabricating a result. The LLM node's hardcoded
   `tokensUsed: 120` now reports the real usage figure. This turns the
   already-real, already-visual React Flow engine into the legitimate
   multi-step "plan → tools → evaluate → complete" execution mode the brief
   describes, without building a second planner.
7. **Real-time Agent Run UI.** `AIRuntimeService` now broadcasts
   `agent.run_progress` (`RealtimeEventType.AgentRunProgress`, `@org/realtime`)
   on every tool start/finish for both Agent and Coworker turns (previously
   only Coworkers had any realtime status broadcast, and even then only
   `status_changed`/`execution_*`, not live tool steps). `AgentMonitoringView`
   subscribes via a new `useAgentRunProgress` hook and renders live runs with
   the **already-built** `AIExecutionTimeline` component (`@org/ui`) — no new
   UI primitive, just wiring an existing one to a new event.
8. **Credits/billing wired.** `AIRuntimeService` now calls the existing
   `CreditService.deductCredits(workspaceId, amount, 'AGENT', …)` after every
   run (amount from the real `tokensUsed`, same `$0.000002`/token estimate
   `WorkflowEngineService` already uses for `AIExecution.totalCost`, kept
   consistent), and blocks a run before it starts if the shared balance is
   already depleted (mirroring `WorkflowEngineService`'s existing pre-flight
   check). Deduction is best-effort (logged, not thrown) so a ledger hiccup
   never discards an already-produced result.
9. **Delegation depth limit.** A `delegationDepth` counter threads through
   `AIRuntimeService.invokeAIEntity`, capped at 3, preventing an uncontrolled
   Coworker→Agent→Coworker… chain (the only prior limit was the 4-round
   per-turn tool cap, which doesn't bound cross-entity recursion).
10. **Dead code removed.** `CoworkerMatrixBridgeService` — an empty class
    explicitly marked in its own comment as superseded — deleted along with
    its DI registration; stale doc comments elsewhere pointing at it updated
    to reference the real `AgentMatrixBridgeService`.
11. **Scheduled agents.** `AgentSchedule` (a real model with zero prior
    consumers or even a create endpoint) now has `POST/PATCH/DELETE
    /workspaces/:id/ai/entities/:id/schedules` and a `AgentScheduleSweepService`
    (`@Cron(EVERY_MINUTE)`, matching the `ChannelAutoArchiveService` pattern —
    no new queue infra) that fires a real `AIRuntimeService.executeTurn` when
    a schedule's cron expression matches the current minute. A small
    dependency-free 5-field cron matcher was added rather than pulling in a
    new package (see deferred item 6 for what it doesn't cover).

## Verification

- `npm exec nx -- run-many -t typecheck,lint,test` green across every touched
  project (`api-agents`, `api-ai`, `api-coworkers`, `api-automations`,
  `api-common`, `api-workspace`, `realtime`, `api-client`, `web-agents`,
  `types`) — see individual runs for exact counts (typecheck: 7+4 projects
  clean; unit tests: 73+20+22+3 passing across `api-ai`/`api-agents`/
  `api-workspace`/`api-coworkers`, including new coverage for tool scoping,
  approval-gating, delegation-depth, credit deduction, and the memory tools).
- `nx affected -t typecheck --uncommitted` — **71/71 projects clean**,
  including the full `@org/web` and `@org/admin` app builds.
- `nx affected -t test --uncommitted` — **36/36 test-having projects green**.
- The full NestJS API booted cleanly end-to-end (`nx run @org/api:serve`) with
  every new module wired (`AgentsModule` → `IntegrationsModule`/
  `WorkspaceModule`, `AutomationsModule` → `AgentsModule`/`IntegrationsModule`)
  and zero circular-dependency/DI errors; every new route registered
  (`/ai/memory`, `/ai/entities/:id/schedules`, …). The web app booted and
  correctly redirected to sign-in with no console errors.
- **Not verified**: end-to-end manual click-through of the new flows (a real
  agent calling a connected GitHub action, watching an approval get
  resolved, a scheduled run firing, the live run panel updating) — this
  needs a logged-in session against seeded workspace data, and no dev
  credentials were available in this session. The plan called for this pass;
  it's the one piece not completed. Static/unit verification above is
  thorough, but a logged-in walkthrough is worth doing before this ships.
- `nx affected -t lint --uncommitted` surfaced **two pre-existing lint
  errors unrelated to this work**, in files this milestone never touched:
  `libs/shared/types/src/lib/system-event.ts:250` (duplicate case label) and
  `libs/web/workspace/src/lib/components/pricing/pricing-page.tsx:74,86`
  (empty arrow functions). They only surfaced because those projects sit
  downstream of `@org/types`/`@org/api-common` in the dependency graph, which
  this milestone did touch. Left as-is — out of scope for this feature.

## Explicitly deferred

1. **Workflow engine's `HUMAN_APPROVAL` node doesn't actually resume.**
   Confirmed during this pass: `ApprovalsService.decide()` marks the
   `AIExecution` row `COMPLETED`/`FAILED` but nothing re-invokes
   `WorkflowEngineService.executeWorkflow` to continue from the paused node —
   the remaining graph never runs after approval. This predates this
   milestone and wasn't in its scope (item 2's approval checkpoint is for the
   *direct* agent runtime, a separate code path). Fixing it needs the engine
   to persist and resume mid-traversal state (which node, which edges left,
   accumulated `executionContext`), a meaningfully larger change than
   anything else here.
2. **Agent memory has no per-agent tier.** `AIMemory` is workspace-scoped
   only (`workspaceId`, `key`, `value`) — there's no `agentId` column, so
   "information specific to one agent" (the brief's second memory tier)
   isn't representable without a migration. Implemented what the existing
   schema actually supports; didn't add a new column/table speculatively.
3. **No `AgentVersion`/normalized `AgentTool`/`AgentPermission` tables.**
   Versioning (draft/publish/archive/rollback) and per-tool/per-permission
   audit rows don't exist — `AIAgent.tools`/`.permissions` remain JSON blobs
   (already permission-checked at execution time, just not normalized or
   independently auditable). A real feature, not a connective fix, so out of
   this milestone.
4. **Workflow CRON trigger is still UI-only.** Unlike `AgentSchedule`,
   `AutomationWorkflow` has no `cronExpression` column and the canvas's CRON
   templates (`WorkflowListView.tsx`) carry no schedule configuration
   anywhere — making this real needs a schema field *and* UI to set it, not
   just a sweep service. The inbound webhook trigger
   (`webhooks.controller.ts`) is similarly still disconnected from the
   workflow engine.
5. **Agent analytics dashboard, import/export config, ownership transfer,
   marketplace duplicate/favorite/pin beyond what exists today.** Explicitly
   scoped out when this milestone was agreed — new feature surface, not a
   gap between two existing systems.
6. **Cron matcher covers `*`, lists, ranges and steps, not full POSIX cron**
   (no `@monthly`-style macros, no `L`/`W`/`#` extensions). Covers every
   expression the schedule picker can realistically produce; a fuller parser
   is a drop-in swap later if needed.
7. **`@org/api-automations` has no test target** (no vitest infra configured
   for that project, confirmed pre-existing) — the workflow-engine changes in
   item 6 above are typecheck/lint-verified and manually reasoned through,
   but have no automated test coverage. Setting up vitest for that project
   from scratch was judged out of scope for this pass.
8. **Full a11y pass, mobile-specific polish, broader test-suite additions**
   beyond what was needed to verify this milestone's own changes — not
   attempted.
