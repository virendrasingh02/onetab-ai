# AI Agent Studio

Status as of 2026-10-01. All of this is **uncommitted** on `main`.

The Studio lives inside the main app at `/w/:slug/ai`. It is not a separate product. You describe what you want in plain words, the Studio plans it from the tools the workspace really has, and you review and edit the plan before anything is saved. You can then test it, run it, or switch it on. Runs, approvals, results, failures and versions all show up in the same app shell.

## How it works

An **agent is an `AutomationWorkflow` with an `agentProfile`**: an `AgentBlueprint` (objective, trigger, steps, output, permissions, notifications, params). It is compiled deterministically into the engine's graph (TRIGGER → TOOL / LLM / CONDITION / HUMAN_APPROVAL / OUTPUT). Agents therefore schedule, run, version and appear in Runs exactly like canvas workflows.

- When the agent is saved, a **graph signature** of the compiled nodes is stored. If someone later edits the graph on the workflow canvas, the signature no longer matches. Saving a plan over those edits then returns `409 CANVAS_EDITED` instead of silently overwriting them.
- **Planning**: `AgentPlannerService.plan` asks the default model, failing over to other providers that have keys. Each provider gets a 55 s budget, enforced by a timer race, so an adapter that ignores the abort can't hang it. The model's output is sanitized against the real tool catalog. If no model can plan, the planner falls back to the closest of 13 templates and says why. `finalize` then sets the schedule and time zone, the minimum permission scopes, default approvals on outward actions, params, and the questions it couldn't answer itself.
- **Scheduling**: the request's own words win over a template's default. A schedule the model already read from the request is kept. Words with no time of day ("daily") keep the plan's hour.
- **Permissions**: the engine refuses any tool outside the agent's granted scopes, and never retries such a refusal. Owner-private tools are excluded from coworkers and defaults. Agents act as their owner and see only what the owner can see.
- **Execution**: background runs push live updates over `ai.run.updated`. Runs support pause, resume, cancel, retry and restart-from-step. Failures are classified (missing connection, expired connection, rate limit, timeout, invalid input, missing permission…) with backoff, error branches and plain-language messages. Model calls fail over between providers.
- **Test mode**: data is read for real, but writes and approvals are simulated. Test runs are badged and excluded from the Home stats.
- **Approvals**: a run pauses at `HUMAN_APPROVAL`. The reviewer can approve, reject, or edit the draft first, and the edit is what gets published (verified end to end).
- **Docs written by agents**: `create_doc` converts the model's Markdown into the Docs editor's block envelope, including headings, bold-only section titles, lists, checklists, tables and code. It files the doc as a page under a root **"AI agent docs"** folder (or a folder the step names), because the Docs screen treats root documents as folders. `read_doc` and `search_docs` turn editor content back into text for agents.

## Where the code is

| Area | Files |
| --- | --- |
| Blueprint, compiler, scopes, templates | `libs/shared/types/src/lib/agent-blueprint.ts`, `agent-templates.ts`, `agent-studio-api.ts` |
| Cron and schedule text (time-zone aware) | `libs/shared/utils/src/lib/cron.ts` |
| Validation | `libs/shared/validation/src/lib/agent-blueprint.schema.ts` |
| Planner, Studio service, controller | `libs/api/automations/src/lib/studio/` |
| Engine, failover, run support, triggers | `libs/api/automations/src/lib/workflow-engine.service.ts`, `model-failover.ts`, `run-support.ts`, `automation-trigger.listener.ts`, `workflow-schedule.listener.ts`, `ai-runs.controller.ts` |
| Platform tools (tasks, meetings, activity, projects, docs, email, notify) | `libs/api/agents/src/lib/platform-tools.ts`, `doc-markdown.ts`, `mcp-tool-registry.service.ts` |
| Web: Home, Library, Create (AI Mode), Agent page, plan editor | `libs/web/automations/src/lib/studio/` |
| Web: Runs, approvals, live run timeline | `libs/web/ai/src/lib/workspace/runs/`, `AIRunsSection.tsx`, `AIApprovalsSection.tsx` |
| Migration | `prisma/migrations/20260930120000_agent_studio/` (applied locally) |

**Routes:** `ai` (Home), `ai/agents` (Library), `ai/studio/new` (with `?prompt=` or `?template=`), and `ai/studio/:workflowId?tab=overview|chat|plan|runs|versions|settings`.

**API, under `/workspaces/:id/agent-studio`:** `home`, `catalog`, `plan`, and `agents` (list, create, get, put, `state`, `duplicate`, `run`, `versions/:n`). `ai-executions/:id` adds `pause`, `resume` and `restart`.

## Acceptance tests

| # | Scenario | Status |
| --- | --- | --- |
| 1 | Daily to-do agent | Planned by the model (35 s) and from the template in the UI. Not run end to end in the last pass. |
| 2 | Evening daily report with approval → doc → history | **Verified in the UI**: Save & test (simulated), then a live run paused for approval, the report was edited and approved, and the doc opened as a page with headings. The edit is in the doc. |
| 3 | Task from an important project message | `channel.message` is emitted from Matrix sync, and the `message-to-task` template exists. **Not verified live**: the dev Matrix homeserver (192.168.11.114:8008) is unreachable. |
| 4 | Project blockers with references | `project-health` template. The tools return links that the run shows as "Sources it read". |
| 5 | Tool failure → retry → fallback → user told | Unit tests (`workflow-engine.service.spec.ts`, `model-failover.spec.ts`). Seen live: NVIDIA "temporarily overloaded" → retried ("2 tries") → succeeded. |
| 6 | Approval-required action pauses and continues | Unit tests, plus test 2 live. |

## Verifying

```bash
npm exec nx -- run-many -t typecheck,lint,test -p @org/types,@org/utils,@org/api-agents,@org/api-automations,@org/web-ai,@org/web-automations
```

Typecheck is green on all 21 touched projects, and `nx build @org/web` succeeds. Lint has no errors (warnings only). Tests pass except `@org/api-ai` `ai-apps.service.spec.ts` › "refuses to run an app rather than fabricating a result", a failure that arrived with commit `ccf48aa` and is outside this work.

Dev gotchas:
- The Nx API watcher sometimes builds successfully but never relaunches the server after several back-to-back rebuilds (port 3000 stays closed). Restart the API process when that happens.
- A refresh request that lands during an API restart can trip refresh-token reuse detection, which signs every session out.
- `?prompt=` auto-planning runs from a mount effect. Under StrictMode, React Query's `MutationObserver` loses the in-flight mutation, so the create page tracks the plan through the `mutateAsync` promise instead of `isPending`.

## Open follow-ups

- **"Created by agent" chip** on the task details dialog. Tasks already carry `customFields.createdByAgent` (`name`, `workflowId`, `runId`), but nothing renders it yet.
- **Global search** doesn't list agents from the Studio yet.
- **Old AI-mode service** (`libs/api/agents/src/lib/agent-studio-ai-mode.service.ts`, from `ccf48aa`) still simulates connections (`'simulated-conn'`) and canned plans. The Studio no longer uses it, so it should be removed or rewired. Its lint errors were fixed in passing.
- **`NotionBlockEditor` `handleAiAction`** in `@org/web-work-tools` produces canned "AI" text. It should call a real model or be removed.
- **Standalone `apps/ai-agent-studio`**: superseded by the in-app Studio. Deleting it needs a decision from the owner.
- **Versions saved before 2026-10-01** may carry an over-reported change summary, because JSONB key order differed. New saves compare in a stable key order.
- **Delays over 15 s** are refused rather than shortened. A durable delay needs a scheduler.
