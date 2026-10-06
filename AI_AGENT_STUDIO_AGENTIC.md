# AI Agent Studio: multi-agent and agentic runtime

Status as of 2026-10-06. All of this is **uncommitted** on `main`.

This pass delivers the first slice of the "Multi-Agent + Agentic Operating System" brief (73 sections). The canonical Studio is the standalone app `apps/ai-agent-studio` (the owner's decision, 2026-10-06). The backend is shared with the in-app Studio at `/w/:slug/ai` (see `AI_AGENT_STUDIO.md`).

## The finding that shaped this pass

Nothing drawn on the standalone canvas ever ran. The canvas saves catalog node types (`AGENT`, `SUB_AGENT`, `IF_ELSE`…) and slot wiring into `AIAgent.graphJson`. The API classified that shape as a "legacy" format it would not publish. "Test run" ignored the graph and ran one plain agent turn. The canvas's debugger drawer invented its steps (`executionService.runWorkflowSimulation`). On top of that, a signed-out or unreachable session swapped in a demo user and three fake workspaces, so every page fell back to sample data that looked real.

## What now works

### Canvas agents run, through the existing engine

`compileStudioGraph` (`libs/shared/types/src/lib/studio-graph.ts`) compiles a canvas graph into the workflow engine's graph:
- Prompt, LLM, Embeddings, Tools and Sub-agents plugged into an agent become an `InlineAgentSpec`, and sub-agents become its team.
- Every catalog type maps to an engine step explicitly. A type the engine can't run becomes an `UNSUPPORTED` step that is visibly skipped and reported as a warning, never a silent "success".
- Issues come back as `error` (blocks the run) or `warning`, tied to the node.

`POST /workspaces/:id/agent-graphs/:agentId/run` compiles the graph into one engine workflow per agent and starts it. That workflow is `triggerType: CANVAS_AGENT`, found again by the exact marker `description = canvas-agent:<agentId>`, and hidden from workflow lists and search. Canvas agents therefore get the engine's approvals, pause / resume / cancel / retry / restart, error classification, model failover and the Runs view, with no second engine.

Other routes:
- `validate`: what would run and what's wrong.
- `GET …/:agentId/runs`: recent runs.
- `GET …/runs/:runId`: steps plus team tasks, messages and approvals.

Test runs read real data, write nothing and simulate approvals. Any member may start one. Live runs act with the owner's access, so only the owner or an admin may start them.

### Multi-agent teams (`AIRuntimeService`)

- **Hosting.** A canvas agent runs *as* its host `AIAgent`: the same logs, credits and acting user, with the canvas agent's instructions, tools, knowledge and model. A model whose provider has no key falls back to the host's, and the run says so. A canvas agent with no tools gets none (an agent row with an empty list still gets the default set).
- **Delegation modes** (`config.delegation` on the agent card):
  - **router**: the supervisor's model delegates with `delegate_to_*` tools. Delegations asked for in the same round run concurrently.
  - **sequential**: members work in order, each seeing the previous result.
  - **parallel**: all members work at once, then the supervisor merges their results.
- **Records.** Every delegation is an `AgentTask` row (a tree under the run, with dependencies, tokens and status). The request and the result or error are `AgentMessage` rows. Live broadcasts: `agent.task.updated`, `agent.message.created`.
- **Budget, shared across the whole team in a run.** The defaults are below. Refusals go back to the model as plain-language tool errors.

| Limit | Default |
| --- | --- |
| Depth | 3 levels below the lead |
| Delegations | 12 |
| Tool rounds | per-agent `maxSteps`, at most 10 |
| Time | run deadline |
| Tokens | optional token budget |

### Engine (`WorkflowEngineService`)

- **Concurrency.** Steps that are ready together run at the same time, at most 4. A MERGE waits for every *started* branch upstream, not just its direct inputs (a bug the batching exposed, covered by the existing test), and outputs what each branch produced. Approval steps run alone, after other ready work; branches still pending are carried in the approval and resumed with it.
- **LOOP.** A LOOP's `each` branch really runs once per item (`{{item}}`, `{{index}}`, at most 50 items) and yields `loopResults`. Approvals inside a loop are refused, with a reason.
- **Run limits.** The defaults are below and graphs can lower them (`settings.limits`). A run that hits one stops with a clear message.

| Limit | Default |
| --- | --- |
| Steps | 100 |
| Time | 10 min |
| Delegations | 12 |
| Tokens | optional |

- **Default inputs.** `{{__last}}` holds the previous step's text, and canvas steps use it as their default input.
- **Token accounting.** Agent steps now report tokens, so run totals are correct.

### Studio UI (standalone app)

- **Run console** (`run-console-drawer.tsx`) replaces the fake debugger:
  - validates first and lists issues by step;
  - runs in Test or Live;
  - polls the open run every 1.5 s until it settles;
  - lights the canvas nodes;
  - shows steps, "What the team did" as an indented tree, each task's agent-to-agent conversation, the result, tokens and cost;
  - approve or reject inline, plus pause / resume / cancel / retry.
- **Loop card.** It has "Each item" and "When done" outputs. Edges saved without a handle keep binding to "When done".
- **Real data only on Approvals, Executions and Overview.** Fake approvals had appeared whenever the real list was empty, and the sidebar badge counted them. The pages now show error states when the API fails.
- **Overview numbers.** It no longer invents run durations or a 100% success rate, and cost uses the ledger's rate.
- **Session guard.** Signed out shows the sign-in screen, and unreachable shows a retry. There is no demo user or demo workspaces.
- **Saving.** A canvas save that fails now says so instead of "saving" to localStorage.
- **Deleted:** `test-debugger-drawer.jsx`, the unused `test-console-drawer.tsx`, `executionService.js` and `approvalService.js`.

### Data

The migration `20261006120000_agent_tasks_messages` adds `agent_tasks` and `agent_messages`. It was applied locally **on its own** with `db execute` + `migrate resolve`, because three other committed migrations are still unapplied on the dev DB (`20261001120000_resend_email_infrastructure`, `20261005120000_slack_migration_system`, `20261005140000_oauth_user_identities`) and are not this work's to apply.

## Verified

- **Unit tests.**
  - Compiler: 9 tests.
  - Runtime teams: 9 tests (router concurrency, sequential order + dependencies, budget refusal, depth cap, model fallback, host-type guard).
  - Engine: 9 new tests (concurrency, `__last`, loops, non-list and approval-in-loop refusal, step limit, unsupported skip, approval + pending branch, inline agent node).
  - All suites in the touched projects are green, except the pre-existing `@org/api-ai` `ai-apps.service.spec.ts` › "refuses to run an app rather than fabricating a result" (from `ccf48aa`).
- **Live, against the local API with the NVIDIA model.**
  - A supervisor with a parallel team of two: both members started in the same millisecond, the tasks, messages and tokens were recorded, and the totals add up.
  - The same agent in router mode: the model delegated to both members in one round, concurrently.
  - Then in the Studio UI: the run, the team tree, the conversation and the node status rings.
  - Fixture agents were inserted for the test user (members can't create agents under the workspace policy) and deleted afterwards.

```bash
npm exec nx -- run-many -t lint,typecheck,test -p @org/types @org/validation @org/api-client @org/api-agents @org/api-automations @org/api-ai @org/api-search
```

The studio app's `typecheck` target was already red: untyped `.jsx` imports and `noImplicitAny`. It went from 81 errors to 62, and the touched files are clean.

Gotcha: the Studio's Vite server serves `@org/*` libs through `node_modules`, which its watcher ignores. After adding an export to a lib, touch `apps/ai-agent-studio/vite.config.mts` so the server restarts in place.

## Brief coverage map

✅ done · 🟡 partial / exists elsewhere · ⬜ not started.

| Phase (brief §67) | Status | Notes |
| --- | --- | --- |
| 1 Foundation: agent model, builder, library, versions, runtime abstraction | 🟡 | Model, builder, versions and runtime exist. Versions are a JSON array in `AIAgent.configuration` (no `AgentVersion` table yet). Library pages still read mock fallbacks. |
| 2 Tool platform: universal tools, connectors, permissions, platform tools, custom API | 🟡 | Real: `MCPToolRegistryService`, `platform-tools.ts`, `IntegrationToolBridgeService`, MCP servers, per-tool approval policy, scoped permissions. Missing: one typed App → Capability → Tool registry (ECOSYSTEM_AUDIT G1), per-workspace tool policy (Allowed / Approval / Disabled), and a custom REST/GraphQL connector builder. The Tools and MCP pages still use `integrationService` mocks. |
| 3 Workflow engine: graph, nodes, conditions, parallel, loops, router, approval, validation | ✅ | This pass: parallel, loops, merge, limits, compile + validation. A router is a CLASSIFIER, or a team in router mode. Switch-case is reported as unsupported (the canvas card only has true/false). |
| 4 Multi-agent: teams, supervisor, delegation, communication, parallel, reviewer, swarm | 🟡 | This pass: teams, supervisor, router / sequential / parallel, tasks + messages. Missing: reviewer/critic loop patterns, debate/judge, swarm, async/fire-and-forget delegation, and teams as a saved, reusable entity (they live inside a canvas). |
| 5 Agentic runtime: plan, observe, replan, retry, recovery, limits, guardrails | 🟡 | The tool loop, retries, backoff, error classes and limits exist. Missing: an explicit plan → evaluate → replan loop with completion criteria ("Agentic Mode"). |
| 6 Memory + knowledge | 🟡 | `AIMemory` (workspace scope) and knowledge bases with retrieval exist. Missing: memory types and scopes (private / shared / episodic), a memory manager UI with real data (the memory tab is mock), and knowledge attached to teams or workflows. |
| 7 Events + automation | 🟡 | Engine triggers (events, cron, webhook) exist. Missing: canvas trigger nodes wired to them. A canvas agent's backing workflow is `CANVAS_AGENT`, so nothing triggers it yet; map `TRIGGER_SCHEDULE` / `TRIGGER_APP_EVENT` to the engine trigger types. |
| 8 Coworkers | 🟡 | Scheduler and Tracker are `AIAgent` coworkers with grants, handoff and monitors (`ECOSYSTEM_AUDIT.md`). Missing: a coworker as a Studio template and in the standalone UI. |
| 9 Observability | 🟡 | Runs, steps, tokens, cost and live updates exist. The run console is real. The Executions page is now real. Missing: Agent Operations metrics with Recharts, agent health, and cost limits per agent / workspace. |
| 10 Admin + security | 🟡 | Workspace isolation, RBAC, owner/admin management and the live-run gate exist. Missing: Builder / Operator roles, audit-log entries for agent events, and admin tool policy. |
| 11 Polish | ⬜ | Mobile, a11y pass, command palette, keyboard shortcuts, and replacing the remaining mock pages. |

### Standalone app: what still reads mock or local data

`agentService` (agents list, overview, templates, user chat, workflows; it falls back to localStorage on API errors), `analyticsService`, `deploymentService` (widget builder), `integrationService` (Tools, MCP), `knowledgeService`, `naturalLanguageService` (NL panel), `variableService`, `workflowService` (node inspector), `mockData` (settings) and `storage`. Each needs the same treatment as Approvals and Executions: real API only, with error and empty states.

## Next passes, most valuable first

1. **Strip the remaining mock fallbacks**, starting with `agentService` (library and list), Tools / MCP (`integrationService` → `integrationsApi` / `mcpApi`) and Knowledge.
2. **Canvas triggers**: compile schedule and app-event trigger nodes into engine triggers, so canvas agents run unattended.
3. **Agentic Mode**: a plan → act → evaluate → replan loop with completion criteria, on top of the team budget.
4. **Reviewer / critic and debate patterns** as delegation modes: a member's output is checked, and a retry is fed back.
5. **Agent Operations** dashboard with Recharts from `AIExecution` + `AgentTask`, plus per-agent and per-workspace cost limits.
6. **Typed App → Capability → Tool registry** and workspace tool policy (ECOSYSTEM_AUDIT G1).
7. **Teams as reusable entities**, a coworker template in the Studio, and an `AgentVersion` table.
