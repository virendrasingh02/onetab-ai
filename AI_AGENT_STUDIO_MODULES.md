# AI Agent Studio — Agent capability modules (Prompt · LLM · Knowledge · Tools · Sub-agents)

Status of the "advanced node configuration + right drawer" pass, 2026-10-08. Uncommitted.

## Architecture (one system, no parallel copy)

- **Where settings live — unchanged.** Old agents load as-is. Prompt text: plugged-in Prompt card `prompt`, else agent `instructions`. LLM: plugged-in LLM card, else the agent. Knowledge: knowledge cards in the `embedding` slot (shown as "Knowledge"). Tools: agent `tools` (built-in names + `PROVIDER.action` refs) + tool cards. Sub-agents: `agents` slot + `delegation`.
- **New keys** (all optional): agent `promptSettings`, `toolPolicies`, `promptTests`, `fallbackModel`; knowledge card `mode`, `minScore`, `enabled`; graph `settings.limits` (was compiled but silently dropped on every save — now persisted).
- **Shared, pure layer** `libs/shared/types/src/lib/agent-modules.ts`: `composeAgentPrompt`, `lintAgentPrompt`, `resolvePromptVariables`, `readKnowledgeBinding`, `readCanvasToolPolicies`. The drawer preview and the run compiler use the same functions, so what you preview is what runs.
- **Studio model** `workflow-canvas/agent-config/agent-module-model.ts`: module schema (sections + search keywords), `readAgentModules` (graph → view), `validateModule`, `summarizeModule`, drafts (`patchDraft`/`applyDraft`/`draftChanges`), export/import. Card, inspector overview, drawer and save all derive from the graph through it.
- **Drawer** = the existing `NodeInspector` (no second drawer). Agents get a Configuration overview (5 rows + "How a run flows"); a row or a card row opens `ModuleDrawer` in the same panel. Editors are lazy-loaded.

## What is real at run time

| Setting | Where it takes effect |
|---|---|
| Objective, persona, goals, constraints, success criteria, reasoning switches, guardrail switches, escalation, tone, examples | Composed into the instructions by `compileStudioGraph` |
| Output format (text/markdown/json) + JSON Schema | Prompt section **and** runtime `responseFormat` |
| Variables + defaults | Engine fills `{{…}}` in canvas-agent instructions from the run, then defaults (`withResolvedInstructions`) |
| Always / Ask before / Never rules | Existing runtime rules (only ever added to the owner's) |
| Fallback model | `withInlineAgent`: canvas model → fallback → host model, with a run notice |
| Tool rounds (`maxSteps`) | Existing |
| Knowledge mode SEMANTIC/KEYWORD/HYBRID, min score, enable/disable | `KnowledgeService.retrieve` now honours `mode` and `scoreThreshold` (were ignored) |
| Per-tool Ask first / Blocked | `rules.policies` via `mergeStricterPolicies` — a canvas can tighten, never loosen |
| Team limits (delegations, steps, time, tokens) | `settings.limits` → `readRunLimits` |

## Testing in the drawer (all real calls)

Prompt: resolved preview, run on the agent's model, compare with a second model, saved regression cases. LLM: provider check, test call with tokens/latency/estimated cost. Knowledge: retrieval debugger (query → per-source hits + scores → exact context the agent gets). Tools: dry-run preview, then a real call (confirmation for anything that writes). Sub-agents: run console. Versions: per-version prompt diff + restore into draft (from agent versions' `graphJson`).

## Also fixed

- Agent detail page: 7 type errors; `iss.severity` (always undefined) → `iss.level`; Save sent `model`/`configuration` every time so **every save failed on the Starter plan** — now only when changed; graph `settings` dropped on save/Copilot/validate.
- Canvas files: 29 more type errors, a conditional-hooks crash in `EdgeDataInspector`, a lost Reads/Writes label on app cards, palette ignoring catalog icons.
- Inspector: hard-coded fake knowledge-base ids and a fixed 10-tool list → live lists.

## Not done (honest gaps)

- LLM: top-p/top-k, penalties, stop sequences, seed, reasoning effort, per-call timeout/retry, complexity/task routing — the AI gateway adapters only accept temperature + max tokens, so these are not shown.
- Knowledge: upload/crawl/OCR/chunking/embedding model stay on the Knowledge page (linked); reranking, query rewriting/decomposition, multi-query, graph retrieval and per-document permissions don't exist in the backend.
- Tools: OpenAPI import, webhooks, custom functions, tool versioning/mocking, per-tool timeout/rate limits — not in the drawer.
- Sub-agents: debate / human-in-the-loop as distinct modes, shared vs isolated memory, dynamic agent creation.
- Prompt: Markdown textarea, not a rich editor; prompt history follows agent versions (no separate prompt versions).
- Found, not fixed: a test call to `gpt-4o` came back "Incorrect API key provided: nvapi-…" — OpenAI credential resolution appears to hand over the NVIDIA key on this dev setup.

## Verification

`@org/types` 250 tests · api-agents 112 · api-ai 89 · api-automations 117 · studio 46 (9 new module-model tests, 16 new shared tests, 6 new backend). Studio typecheck 0 source errors, lint 0 errors. Live in the Studio with a temporary fixture agent (deleted after): card → drawer → jump-to-issue → edit → Save → card summary → DB; limits saved into `settings`; phone full-screen sheet; unsaved-changes guard.

## Canvas card redesign (same day)

- Every card: bordered icon tile, title + 2-line description, hollow handles, and a **View Results** footer (tokens · time) that expands to that step's output from the latest test run. Results come from the run console (`onNodeResults`) and live only in page state — never saved.
- Agent card: model pill → LLM drawer; Instructions preview → Prompt; **Knowledge Bases** chips or "Add Knowledge Bases" → Knowledge; **Tools** logos + chips + "+" → Tools; **Sub-agents** chips + delegation → Sub-agents. Warnings jump to the problem; quick-add "+" (plug a card) shows on hover/selection.
- Trigger card shows the run's message; **Output** card shows the final answer with Text / Formatted (light, injection-free Markdown), copy, download, clear.
- Wires: neutral and thin, no arrowheads; flow animates only while its step runs (the `dash` keyframe it used was never defined — added, with reduced-motion off-switch); completed path tinted.
