# AI Agent Studio: prompt-to-agent and the Agent Copilot

Status as of 2026-10-06. All of this is **uncommitted** on `main`.

This pass delivers the "Prompt-to-Agent + Agentic Workflow Builder" brief (44 sections) on the standalone Studio, `apps/ai-agent-studio`. It builds on the multi-agent runtime pass described in `AI_AGENT_STUDIO_AGENTIC.md`.

## What it does

The core experience is a sentence: **describe the agent, and the Studio builds it.** Once the agent exists, it is changed with sentences too.

1. **`/create`, "Create with one prompt".** It offers a large prompt box, rotating examples, recent prompts, 14 domain templates (a template only pre-fills the prompt), "Start from template" and "Import existing workflow".
2. **Understanding.** `POST /workspaces/:id/agent-architect/understand` combines two things:
   - the existing planner (`AgentPlannerService`): a real model plans against the workspace's real tools and connected apps, and falls back to a template when it can't;
   - `detectAgentRequirements`, a deterministic pass over the person's words: domain, the apps they name and whether each is an input or an output, data sources needed without naming an app, trigger, knowledge, memory, approval, retry and multi-agent.

   The two are merged into an **`AgentArchitectSpec`** (brief §33). The spec is checked against `agentArchitectSpecSchema` before anyone sees it.
3. **The plan, shown for confirmation (§3).** It shows the agent's name and domain, the numbered steps with their badges (reads, writes, after your approval, needs Slack…), the one-line workflow, when it runs (schedule chips, including the request's own schedule), what it uses, and assumptions and checks. The person can rename the agent, remove a step, change the trigger, add a requirement (which re-plans) or regenerate the plan.
4. **Only what's missing (§11).** Progressive cards cover connections (a link to Integrations, then "I've connected them — check again", which re-checks without re-planning), data sources, a knowledge base (pick one or upload), a schedule, and channels and params. Recommendations (§34) are checkboxes, with "Use recommended setup" and "None".
5. **Build (§4).** A live checklist in which every line is a real call: design, a local compile check, `agentsApi.create` (which applies the workspace's creation policy), version 1, server validation, the knowledge base, and app connections. Waiting items say what to do next. It ends with **Run a test** or **Open in Studio**.
6. **The canvas graph (§5–6).** `specToStudioGraph` emits nodes the runtime really executes:
   - a trigger card (the schedule carries cron and time zone);
   - `MCP_TOOL` cards for reads and actions, running a built-in tool or an app action;
   - `AGENT` cards for analysing and writing, grounded in earlier steps' results with the platform's grounding rules;
   - `KB_SEARCH`, `IF_ELSE` with a "Nothing to do" branch, `USER_APPROVAL`, and an `AGENT_COORDINATOR` with `SUB_AGENT` members for teams.

   An app that isn't connected becomes a card that fails compile with "needs Slack: connect it…". It never becomes a step that silently succeeds.

### Agent Copilot (§8–10, §19–20, §25–26)

The Copilot is the right-hand panel on the agent canvas. It replaces the simulated "AI Copilot" panel.

- **Edits in plain words.** `POST …/agent-architect/edit` turns a sentence into **`GraphEditOp`s**:
  - `insert_approval_before`, `add_step`, `set_trigger`, `set_model`, `set_retries`, `attach_knowledge`, `convert_to_team`, `merge_steps`, `update_step` and `remove_step`.
  - Common requests are handled by rules (`interpretEditCommand`), which are instant and predictable. Anything else goes to a model, whose ops are filtered by `sanitizeEditOps`: they must be well-formed, point at real steps, use allowed node types, and name models that are really configured.
- **Proposals, not silent changes.** Every change shows its **computed** diff (`diffStudioGraphs`: "1 change · Added 'Notify me'"), plus "No other steps change." and the workflow afterwards.
  - **Apply** saves only the graph and creates a version named after the request.
  - **Undo** restores the previous graph, as another version.
  - A change that turned out to change nothing says "That's already how it works" instead of claiming it was done.
- **Explain, test, permissions, missing.** These are answered from the graph itself.
- **Debug.** `POST …/:agentId/diagnose` reads the agent's last failed run, step by step. It classifies each failure with the engine's own `classifyStepError` and says whether retrying is safe. It offers retries only for temporary failures, and a reconnect link when an app is the cause.
- **Optimize.** `POST …/:agentId/optimize` returns `analyzeStudioGraph` (back-to-back AI steps that can be one call, duplicate reads, unreachable steps, reads without retries) plus the last runs' failure rate, latency and tokens. Each suggestion previews as a proposal.
- **Runs on its own.** A switch drives `GET|POST …/agent-graphs/:agentId/activation`, explained in the next section.

### Scheduled canvas agents (closes "Next pass 2" in `AI_AGENT_STUDIO_AGENTIC.md`)

- `compileStudioGraph` now carries a schedule card's cron and time zone on the compiled trigger.
- The canvas agent's engine workflow is created **switched off**. Only `setActive` (owner or admin) switches it on, and switching on needs a graph without errors that starts with a schedule.
- `WorkflowScheduleListener` asks `CanvasAgentRunService.dueScheduledRuns` every minute. That method compiles each switched-on agent's **current saved graph**, so an edited schedule or edited steps are what run, and syncs the engine workflow before it fires with the graph's run limits.

### Runtime fixes found on the way

- **Canvas MCP cards in test runs.** An `MCP_TOOL` card naming a built-in tool or app action was gated as "MCP write", so a test run skipped even its reads. It is now gated by what the tool does (`scopeForNode`, plus the engine's `MCP_TOOL` branch). Reads run in a test and writes are simulated.
- **Retries.** `retries` on any card now reaches the engine (it was dropped for LLM and knowledge steps).
- **Planner token budget.** It rose from 3.5k to 6k. Reasoning models ran out of room mid-JSON on multi-part requests.
- **The Studio dev server rendered a blank page.** `hoist-non-react-statics`, reached through `@lobehub/icons` → `@emotion/react` from `2bbc194`, was served as raw CommonJS. It is now pre-bundled in `apps/ai-agent-studio/vite.config.mts`.

### Fakes removed

- The standalone Studio's AI-mode builder (`ai-mode-agent-builder.tsx`), whose backend simulated connections, "testsPassed: 4" and a canned 3-node graph.
- The simulated NL panel and its service (`natural-language-panel.jsx`, `naturalLanguageService.js`), which returned keyword-matched canned graphs.
- The "generate from prompt" actions on Overview, Agents and Workflows, which created an agent whose system prompt was the sentence itself. They now go to `/create`.

## Where the code is

| Area | Files |
| --- | --- |
| Requirements, spec, spec → graph, edit ops, diff, explain, optimize (pure, shared) | `libs/shared/types/src/lib/agent-architect.ts` (+ spec, 29 tests) |
| Schemas | `libs/shared/validation/src/lib/agent-architect.schema.ts` |
| API | `libs/api/automations/src/lib/studio/agent-architect.{service,controller}.ts` (+ spec), `canvas-agent-run.{service,controller}.ts` (activation, due runs, + spec), `workflow-schedule.listener.ts` |
| Client | `agentArchitectApi`, `agentGraphsApi.activation/setActivation` in `libs/shared/api-client/src/lib/endpoints.ts` |
| Studio UI | `pages/create-agent-page.tsx`, `components/agent-architect/{agent-copilot-panel,architect-ui,home-prompt}.tsx`, `data/prompt-templates.ts`; wiring in `agent-detail-page.tsx`, `overview-page.tsx`, `agents-list-page.tsx`, `workflows-page.jsx`, `app.tsx` |

## Verified

- **Unit tests.**
  - `@org/types`: 195 tests, including 29 for the architect module (brief §43 cases 1–4 and 6, plan cleanup, honest no-ops).
  - `@org/api-automations`: 101 tests, including architect service, scheduled canvas agents and the MCP-card test-mode gate.
  - Lint and typecheck are green on types, validation, api-client and api-automations. The Studio app's new files are clean; that app's `typecheck` target was already red on untyped `.jsx` files and the `AIModelBadge` export.
- **Live, against the local API with the workspace's NVIDIA model.**

| # | Case | Result |
| --- | --- | --- |
| 1 | Gmail every morning → summarise → Slack | Gmail as input, Slack as delivery, daily 8:00, one approval, "Connect Gmail / Connect Slack" asked for (10–13 s). |
| 2 | HR resumes → rank → shortlist | Domain HR, ranking, approval, and a shortlist saved as a doc. |
| 3 | Support agent using our docs | Domain support. Knowledge and human escalation recommended. |
| 4 | Ecommerce system: orders, refunds, support, inventory | A coordinator with 4 specialists. The model ran out of tokens, which led to the planner budget raise. |
| 5 | Edits | Monday 9 AM + retries applied and saved as version 1. Notify added then undone. "Approval before sending" answered honestly when one already existed. The Claude request answered "no Claude model is set up". The tone change was made by the model. |
| 6 | Test run of the built agent | Reads ran for real, the approval was simulated, the post was skipped, and the report was grounded: "No tasks were completed…". |
| 7 | Debug / Optimize / Permissions / Auto-run switch | All work. Activation is stored on the engine workflow with `0 9 * * 1` in America/New_York. |

  The seeded member can't create agents (workspace policy). The build step reports that plainly. The success path was exercised with a fixture agent holding a real planned graph, deleted afterwards along with its runs.

## Brief coverage

✅ done · 🟡 partial · ⬜ not started.

| § | Topic | Status |
| --- | --- | --- |
| 1–3, 6, 11, 33–37 | Prompt-first entry, understanding, confirmation, node selection, missing configuration, spec + validation, recommendations, progressive disclosure, response style | ✅ |
| 4 | Live build plan | ✅ as real calls. Planning itself is one request with an honest timer, not streamed. |
| 5, 15 | Workflow and multi-agent generation | ✅ through the existing canvas runtime |
| 7 | Agent generation | 🟡 Identity, instructions, the workspace default model and retries. A fallback model, context window, token limits and concurrency aren't generated. |
| 8–10, 19–20, 25–26 | NL editing, Copilot, suggestions, debugging, optimization, versions, NL diff | ✅ |
| 12–14 | Connection Center, Knowledge Base builder, schema-driven tool configuration UI | ⬜ The plan links to the existing Integrations hub and Knowledge page. No new unified center was built. |
| 16 | Explicit plan → evaluate → replan loop | 🟡 The tool loop exists. Agentic Mode is still open (see `AI_AGENT_STUDIO_AGENTIC.md`). |
| 17–18 | Live execution view, Test mode | ✅ The existing run console, now reached from Create and the Copilot. |
| 21, 30 | Templates, Agent Home | ✅ Prompt templates by domain. The Home prompt, with suggestions from connected apps. |
| 22, 39–40 | Layout, performance, accessibility | 🟡 Canvas + Copilot panel, which becomes an overlay on small screens. Labels, `aria-live`, focus on the plan and keyboard submit are in place, but there was no screen-reader audit and no streaming. |
| 24, 29 | Micro features, publish | 🟡 Prompt history, regenerate and undo are in place. Lifecycle is draft + "runs on its own". Node comments and disable are not. Publish is unchanged. |
| 27 | Memory configuration | ⬜ Only flagged in the spec. |
| 31 | Command bar | ⬜ |

## Found, not fixed (outside this brief)

- **The canvas Save is refused on Starter plans for every agent.** `AIEntitiesService.updateEntity` rejects any update carrying `model`, `provider` or `configuration`, and the canvas Save always sends all three. The Copilot's Apply sends the graph only, so it isn't affected.
- **`OllamaAdapter.chat` answers with a fake reply** ("[Ollama (llama3) Local Fallback] Received: …") whenever Ollama is unreachable, so a run looks successful when it isn't. `AIAgent` rows default to `provider: ollama` in the schema. Agents made through `createEntity` get the workspace default instead, but raw rows hit the fake.
- **`@org/web-agents` `AIModeAgentBuilderModal` (in-app) still uses the simulated `agent-studio-ai-mode.service.ts`.**

## Next passes

1. A Connection Center and a schema-driven tool configuration UI (§12, §14). One place to connect, test and scope apps, LLMs and embeddings, reused by the plan's missing cards.
2. A Knowledge Base builder in the flow (§13): upload from the missing-knowledge card, with progress, and a retrieval test.
3. A command bar (§31) and a memory configuration UI (§27).
4. Stream planning progress, and generate a fallback model and limits (§4, §7).
