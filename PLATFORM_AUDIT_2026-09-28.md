# Platform audit, AI unification & security pass — 2026-09-28

**Scope:** the "Complete Platform Audit, Refactoring, UX Optimization & Security
Implementation" brief. This pass built on the 2026-08-21 audit
(`PLATFORM_AUDIT_REPORT.md`, left unchanged) and concentrated where that audit
found the most fake or duplicated behaviour: the AI layer (agents, coworkers,
workflows, MCP, approvals) and the security of everything it can reach.

**State:** all changes are uncommitted on `main`. Two new migrations were
applied to the dev database and must be committed with the code. Nothing was
deleted from the database.

**Verification at the end of the pass:**
- typecheck — 80 projects, 0 errors
- lint — every project, 0 errors
- unit tests — 47 projects, all passing
- builds — `@org/web` and `@org/api` build
- browser — the main AI flows were checked by hand against the local stack, at 1440px and 375px (§7)

---

## 1. Platform audit report — what was found

Findings, most severe first. Each one was **fixed** in this pass unless §9 says otherwise.

| # | Area | Finding | Severity |
|---|------|---------|----------|
| 1 | SSRF | Three separate URL guards (automations `url-guard.ts`, integrations `ssrf-guard.service.ts`, link previews). None pinned DNS, so a hostname could pass the check and then resolve to a private address when fetched (DNS rebinding). The custom-API provider followed redirects into private ranges. | Critical |
| 2 | Authorization | Any workspace member could edit, delete or run any agent, coworker or workflow. The only check was membership. | High |
| 3 | Confused deputy | Workflow steps used *any* integration in the workspace, including another user's personal one. Anyone could decide any approval. | High |
| 4 | Tool permissions | An agent's model could call any registered tool, not just those enabled on the agent. The autonomy setting was stored but never enforced. Approved actions never ran — an approval was a dead end. | High |
| 5 | Fake features | MCP "connections" returned canned tools and reported `CONNECTED` without ever connecting. AI Apps `execute` returned fabricated output. Execution "retry" inserted a `RUNNING` row that never ran. | High |
| 6 | Secrets | Firecrawl used the *encrypted* key as its API key, so every call failed. | High |
| 7 | Admin surface | AI provider credentials, model settings and MCP management needed only membership. | High |
| 8 | CORS | `localhost` origins were allowed in production. | Medium |
| 9 | Workflow engine | Behaviour that silently did the wrong thing: <br>• Config saved as `data.config` was ignored. <br>• `CONDITION` always passed. <br>• `MERGE` ran once per incoming branch. <br>• `CRON` workflows never fired. <br>• Approval steps never resumed. <br>• `DELAY` was silently shortened. <br>• `CLASSIFIER`/`EXTRACT` were stubs. <br>• `OUTPUT` crashed on circular context. | High |
| 10 | Agent builder | The visual graph was saved but never applied to the runtime. Model, tools, knowledge and schedule nodes changed nothing. | High |
| 11 | Duplication | Six entry points for one job: AI Studio, the standalone Agent Studio app, the Agent Builder, the Agent Monitor, AI Coworkers, and Automations with its separate logs. Each had its own list, run history and builder. | High (UX) |
| 12 | Validation | AI endpoints took untyped bodies. No throttling on execute/trigger/test routes. | Medium |
| 13 | Dependencies | Runtime CVEs in `@nestjs/*`, `multer`, `fast-uri`, `nanoid`, `sharp`, `react-router-dom`. | Medium |
| 14 | Data drift | The Pricing & Plans models (d086f60) were in `schema.prisma` with no migration. `GET /workspaces/:id/billing` returned 500 on every page load. | High (found during browser verification) |

---

## 2. End-to-end user flow map

```
Sign up / sign in ── password · magic link · passkey · enforced 2FA step
        │
        ▼
Workspace ── create or accept invite → /w/:slug (last route per workspace restored)
        │
        ├─ Home · Inbox · Threads · Channels & DMs (Matrix) · Huddles
        ├─ Tasks & Projects · Docs · Whiteboards · Meetings · Schedule · Files
        │
        ├─ AI Assistant  /ai-chat ─────────── ask about the workspace, with citations
        │
        ├─ AI Workspace  /ai ──────────────── ONE place to build, run and review AI
        │     Overview · Agents (agents + coworkers) · Workflows · Runs
        │     Approvals · Knowledge · Tools (built-in, MCP, secrets) · Prompts
        │     /ai/agents/:id    → agent canvas editor or coworker profile
        │     /ai/workflows/:id → workflow canvas editor
        │     conversations stay in chat: /agents/:id/chat, /coworkers/:id
        │
        ├─ Operations: Integration Hub · Marketplace (install apps & agents)
        │
        └─ Settings /w/:slug/settings/:section
              Permissions & Policies (who may create agents/coworkers…)
              AI Providers & Keys · Plans & Billing · …
```

The building flow is now one path:

**New → Agent** → canvas → **Test** → **Publish** → runs appear in **Runs** → held actions appear in **Approvals** → an approved action runs and the run completes.

Workflows follow the same path from **New → Workflow** or **Start from a template**.

---

## 3. Refactoring summary

**Removed duplicates.** All are replaced by the AI Workspace, and every old URL redirects:
- `AIStudioView` — the ten-tab AI Studio
- `AgentBuilderView` and `AgentMonitoringView`
- `WorkflowExecutionLogsView`
- `CoworkerDirectoryView`
- `libs/api/automations/src/lib/url-guard.ts` — replaced by the shared SSRF guard

**Single sources of truth:**
- `AIExecution` is the one run record. Agent turns now write it, as workflow runs already did.
- `libs/api/common/src/lib/ssrf.ts` is the one outbound-URL guard.
- `libs/api/common/src/lib/cron.ts` is the one cron matcher, shared by agent schedules and workflow CRON triggers.
- `libs/shared/validation/src/lib/ai-workspace.schema.ts` holds every AI request schema.
- `canManageOwnedAIResource` (types) holds the ownership rule, used by the API guard, the approvals service and the UI hook.
- `AgentBuilderOptionsProvider` / `BuilderOptionSelect` supply real providers, models, tools, knowledge bases, channels and MCP tools to both builders. These were hard-coded lists before.

**Navigation:**
- The AI group went from six entries (AI Studio, Agent Studio, AI Assistant, Prompt Library, AI Coworkers, Automations) to two: **AI Assistant** and **AI Workspace**.
- The Marketplace moved to Operations, next to the Integration Hub.

**Links repointed** to canonical routes, and route matching and page titles updated to match:
- sidebar rows and section headers
- the "+" create menu
- dashboard shortcuts
- workspace settings
- the marketplace
- agent chat and coworker chat

---

## 4. Unified AI Workspace report

**One route, one entry point:** `/w/:slug/ai`, inside the app shell.

**Sections:** Overview · Agents · Workflows · Runs · Approvals · Knowledge · Tools · Prompts.

**Coworkers are an agent type.**
- They share the directory (with an All / Agents / Coworkers filter), the editor route `/ai/agents/:id`, the run history and the approval rules.
- A coworker opens its profile editor (persona, model, tools, delegate agents) rather than the canvas; see §9.

**Agent editor:** Build (canvas) · Runs · Versions · Settings, plus a Test panel.
- Test runs go through the real runtime.
- Only nodes wired to the core node count. `deriveAgentFromGraph` turns the graph into `configuration.runtime`, which the runtime enforces:
  - tool allow-list
  - autonomy gating
  - knowledge context
  - sampling settings
  - PII guardrail
- Schedule nodes become agent schedules (`source: 'builder'`), and output nodes deliver to a channel, with a permission check.

**Workflow editor:**
- Spec-driven inspector, run dialog with live step outlines, versions (save / publish / restore) and pause/resume.
- Five ready-to-run templates.
- Read-only mode for people who don't own the workflow.

**Existing data is preserved.**
- Existing agents, coworkers, workflows and runs appear unchanged.
- Graphs written by the standalone Agent Studio are converted when opened, and any step that doesn't map is listed.

**Old URLs redirect** and keep the id they pointed at:
- `studio/*`, `ai-studio/*`, `agent-studio`
- `agents`, `agents/builder?agentId=`, `agents/logs`
- `coworkers`
- `automations?workflow=`, `automations/builder?id=`, `automations/logs`
- `marketplace/apps/:slug`

**Policy-aware.** When Settings → Permissions & Policies limits agent or coworker creation to admins:
- the New menu disables those items and says why
- `/ai/agents/new` explains instead of opening a canvas that could never be saved
- the API enforces the same rule

---

## 5. Design system audit

**Conforms:** Lucide icons throughout, shared `@org/ui` primitives (`Page`, `PageSection`, `Card`, `Badge`, `Field`, `Dialog`, `SegmentedControl`, `ResponsiveTabsList`, `EntityContextMenu`, `confirm()`), and theme tokens rather than raw colours.

**New shared pieces:** `AIRunStatusBadge` and `toTimelineSteps` in `@org/ui`, so run status looks the same in every list and trace.

**Defects found in the browser and fixed:**
- React Flow's built-in `output` node stylesheet boxed the agent Output node in a white, 150px, dark-bordered card.
- Tailwind reads `_` inside an arbitrary variant as a space. `[&_.react-flow__edge-path]` has therefore never matched, so the intended edge stroke never applied. Both selectors are now escaped.
- Dialog bodies had no horizontal padding (Test run, Versions, Knowledge, Tools). Fields sat flush against the dialog edge.
- On phones, the floating "Add step" button covered the step inspector's header.
- On phones, the workspace-switcher trigger couldn't shrink (`min-w-0` missing), so it ran under the sidebar toggle. The plan badge now yields its space below `sm`; the plan is still shown in the menu.
- The editors used `h-full` inside the app shell's scrolling flex outlet, where it doesn't resolve. They now use `flex-1 min-h-0`.

**Still open:** the "every view on `<Page>`" sweep noted in earlier passes (§9).

---

## 6. Security report

| Control | Before | Now |
|---|---|---|
| Outbound URLs (SSRF) | 3 guards, no DNS pinning, redirects followed | One guard: private/reserved IP check → DNS lookup pinned to the validated address → each redirect re-validated. Used by workflow HTTP steps, the integrations custom API, link previews, Firecrawl, the MCP client and custom AI provider base URLs. Local LLM endpoints need explicit `AI_ALLOW_PRIVATE_NETWORK=true`. |
| Ownership (IDOR within workspace) | Membership only | `CanManageAIEntity` / `CanManageWorkflow` guards: the creator, or someone with `MANAGE_SETTINGS`. Running an entity needs `CREATE`. Deleting a workflow needs `UPDATE` plus ownership. The UI mirrors this with read-only editors. |
| Approvals | Anyone could decide; approved actions never ran | `canDecide` = the resource's owner or an admin. Approved built-in and MCP tool calls execute. Workflow runs resume from the approval step; a rejected run closes as failed. |
| Agent tool use | Model could call any tool; autonomy ignored | Per-agent built-in allow-list. **Supervised**: every tool waits for approval. **Semi**: only read-only tools run freely. **Autonomous**: tools run without approval. The coworker `knowledgeAccess` toggle gates `search_docs`. |
| MCP | Fake client, false `CONNECTED` status | Real Streamable-HTTP JSON-RPC client (initialize → tools/list → tools/call), SSRF-guarded. Tool annotations (destructive / read-only) drive approval gating. Agents opt in per connection. Managing connections needs `MANAGE_SETTINGS`. Status now defaults to `DISCONNECTED`, and rows that falsely claimed `CONNECTED` were reset. |
| Integration scope in workflows | Any integration in the workspace | Workspace integrations, or the workflow creator's own personal one — never another user's. |
| AI admin routes | Membership | Credentials, model settings and provider tests need `MANAGE_SETTINGS`. |
| Secrets | Firecrawl sent ciphertext | Keys are decrypted through `AISecretsService` at use and never returned. Failures are reported honestly. |
| Prompt injection / PII | None | Tool gating (above) bounds what injected instructions can do. The PII guardrail redacts or blocks emails, phone numbers and card numbers per agent. |
| Input validation | Untyped bodies | zod schemas (`zodBody`) on every agent, coworker, entity and workflow route, and on the execution filter. |
| Rate limits | None on AI actions | Throttles on execute, trigger and test routes. |
| CORS | `localhost` allowed in production | Only outside production. |
| Fake results | AI Apps, retry | AI Apps `execute` returns 501 instead of made-up output. Retry is a real re-run. Cancel applies only to runs waiting for approval, and also cancels their pending approvals. |
| Dependencies | Runtime CVEs | `@nestjs/*` 11.2.6, `multer` 2.4.0, `fast-uri` 3.1.8, `nanoid` 3.3.19, `sharp` ^0.35.5 (and a stale nested `sharp` removed), `react-router-dom` ^6.30.6. |

**Residual `npm audit`: 32 findings (24 high, 8 moderate).**
- All but one are build/test tooling: the Nx toolchain, Vitest, the Prisma CLI's `@prisma/config` chain, `svgo`, `js-yaml`, `webpack-dev-server`. They clear with the Nx 23 upgrade, or with a Prisma CLI change that npm lists as a major downgrade.
- The one runtime item is the react-router backslash open-redirect advisory. Its fix is v7, a major version (§9).

---

## 7. Testing report

| Check | Result |
|---|---|
| `nx run-many -t typecheck` | 80 projects, 0 errors |
| `nx run-many -t lint` | 0 errors in every project (existing warnings only) |
| `nx run-many -t test` | 47 projects, all passing |
| `nx run-many -t build -p @org/web @org/api` | Both build |
| `prisma migrate status` | Up to date (62 migrations) |

**New unit tests (9 spec files):**

| Spec | Covers |
|---|---|
| `ssrf.spec.ts` | Private/reserved ranges, IPv6 and mapped forms, DNS pinning, redirect re-validation |
| `cron.spec.ts` | Due and valid expressions (table-driven) |
| `agent-config.spec.ts` | Graph → runtime mapping; only wired nodes count |
| `ai-entity-access.guard.spec.ts` | Creator, admin, guest and cross-workspace cases |
| `agent-guardrails.spec.ts` | PII redaction and blocking |
| `approvals.service.spec.ts` | Who may decide; workflow approval event |
| `mcp-client.spec.ts` | Handshake, tools/list, tools/call, errors, SSRF refusal |
| `workflow-graph.spec.ts` | Config normalisation, safe condition parser, branch selection |
| `workflow-engine.service.spec.ts` | LLM step, condition branch, merge once, approval pause/resume/reject (settled in place), honest delay, HTTP SSRF |

Existing specs were extended: `ai-runtime.service.spec.ts` (allow-list, autonomy, approvals), the navigation resolver, page titles and `ai-apps.service.spec.ts`.

**Browser verification.** Run on the local stack with a seeded **member** account, at 1440px and 375px:
- The Overview shows live counts.
- The Agents directory lists real agents and coworkers.
- A non-creator sees the agent canvas read-only.
- `/ai/agents/new` explains the admin-only policy.
- Workflows list → **Use template** → the editor opens paused.
- **Test run** made a real LLM call (462 tokens), and the trace showed trigger → draft → approval waiting.
- The **Approvals** entry was decided → the run resumed → `create_doc` wrote a real document → the run shows **Completed**.
- Tab titles resolve names on deep links.
- No horizontal scroll at 375px, and the step inspector is usable on a phone.
- The billing 500 was traced to missing tables and fixed.

**Not verified in the browser. These need an admin account or external services:**
- creating and publishing an agent as an admin
- an agent test run that calls tools
- connecting a real MCP server
- knowledge upload and search
- creating a coworker
- a CRON workflow firing on schedule
- integration-backed and Firecrawl workflow steps

The MCP client, cron and engine paths are covered by the unit tests above, with mocked transports.

---

## 8. Implementation summary

**Backend**
- **`@org/api-common`:** `ssrf.ts` and `cron.ts` (with specs); a `WorkflowApprovalDecided` event; a test target.
- **`@org/api-agents`:**
  - `ai-entity-access.guard.ts`
  - `agent-guardrails.ts`
  - `agent-output-delivery.service.ts`
  - `ai-runtime.service.ts` refactor: turn plan, unified executions, allow-list, autonomy, knowledge, PII
  - approval listener that executes approved tools
  - schedule sweep using the shared cron
  - builder-aware validation and test runs
  - honest Firecrawl
- **`@org/api-ai`:** real `mcp-client.ts`; MCP service rewrite; approvals `canDecide`/`decide`; provider base-URL guard; permission tightening; honest AI Apps, cancel and retry.
- **`@org/api-automations`:**
  - `workflow-graph.ts` (normalisation and a safe expression parser)
  - engine rewrite: branches, merge, resume, classifier/extract, delay cap, scoped integrations, MCP steps
  - `workflow-schedule.listener.ts` (CRON sweep and approval resume)
  - `ai-runs.controller.ts` (real retry)
  - versions, publish and restore endpoints
- **`apps/api/src/main.ts`:** CORS tightened.

**Shared**
- `ai-workspace.schema.ts` (validation)
- `agent-config.ts` and `canManageOwnedAIResource` (types)
- typed agents, automations and executions endpoints and query keys (api-client)
- `AIRunStatusBadge` (ui)

**Frontend**
- `@org/web-ai`: the `workspace/` sections and layout.
- `@org/web-agents`: the `editor/` (workbench, test panel, runs list, editor view) and builder options.
- `@org/web-coworkers`: `ai-workspace/` (directory and entity editor route).
- `@org/web-automations`: the catalog, templates, and rewrites of the canvas and list.
- `@org/web-layout`: navigation, route matching, create menu, sidebar links, switcher fix.
- `apps/web`: routes, legacy redirects, page titles.

**Database**
- `20260928120000_ai_workspace_runtime`:
  - adds `lastError` and `lastSyncedAt` to MCP connections
  - changes the status default to `DISCONNECTED` and resets rows that were never really connected
  - adds `agent_schedules.source`
- `20260928140000_billing_pricing_catchup`: additive only. Trial and promotion columns on `workspace_subscriptions`, plus `promotions`, `promotion_redemptions`, `credit_accounts` and `credit_transactions`. The remaining schema-vs-database differences were left alone on purpose: `updatedAt` defaults, and the `searchVector` defaults that full-text search depends on.

---

## 9. Remaining work

**Needs your approval.** These are significant removals, per the brief's rules:
1. **Delete `apps/ai-agent-studio`.** It's the standalone Agent Studio app. Nothing links to it any more, `/agent-studio` redirects into the AI Workspace, and it still typechecks. Its graphs convert when opened in the new editor.
2. **Retire AI Apps (API + data).** The UI is unreachable and `execute` returns 501. The models and endpoints remain.
3. **Marketplace "My agents" tab.** It duplicates AI Workspace → Agents. Point it there, or drop the tab.

**Backlog:**
4. A durable scheduler (queue or DB-backed) for workflow delays over 15s. Today they fail with a clear message instead of running shortened.
5. `send_channel_message` from workflows. Workflows have no posting identity yet.
6. Decide whether guests may use `/ai/chat` (they can today).
7. Backfill legacy `AgentExecutionLog` rows into `AIExecution` so runs from before this change appear in Runs.
8. Clean up stale `RUNNING` `WorkflowExecution` rows (four exist in dev). They count as concurrent executions in billing.
9. Upgrade the Nx 23 toolchain to clear the dev-dependency advisories. Plan react-router v7 for the open-redirect advisory; until then, only navigate to same-origin relative paths from any `next=`-style parameter.
10. A canvas editor for coworkers. They share the route, runs and rules, but are edited as a profile.
11. The `<Page>` primitive sweep across the remaining views.
12. Commit all of this, including both migrations. `prisma migrate dev` is still unusable here because of old compliance/`searchVector` drift. Keep hand-writing migrations and applying them with `migrate deploy`.
