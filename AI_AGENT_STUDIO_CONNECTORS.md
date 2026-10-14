# AI Agent Studio: connectors as agent building blocks

Status as of 2026-10-08. All of this is **uncommitted** on `main`.

This pass covers the "Agentic AI Platform: AI Agent Studio + App Connectors" brief (66 sections). It builds on the runtime, multi-agent and prompt-to-agent passes (`AI_AGENT_STUDIO_AGENTIC.md`, `AI_AGENT_STUDIO_PROMPT_TO_AGENT.md`). The canonical Studio is still `apps/ai-agent-studio`.

## The finding that shaped this pass

The backend connector framework was already real:
- 12 provider adapters with real `getActions()` / `executeAction()`;
- encrypted OAuth and API-key storage;
- `IntegrationToolBridgeService`, which turns linked apps into agent tools;
- the engine's `PROVIDER.action` tool steps.

What was missing was one manifest that every surface reads. The last commit (`b54b69e add app connectors`) filled that gap in the Studio with **fakes**:
- a 1,050-line static catalog (35 apps, most with no backend);
- localStorage "connections" for invented accounts ("Acme Global Corp", `engineering-lead@company.com`);
- a "Test" that always returned "200 OK";
- canned action outputs;
- hard-coded metrics (1,420 executions, 99.2%, "99.8% health");
- invented audit logs;
- canvas nodes defaulting to `conn-ms-teams-corp`;
- a simulator returning `status: 'SENT'`.

The new Microsoft Teams adapter faked a whole OAuth connection whenever Azure credentials were missing (always, in dev), and then mocked every action.

## Architecture now

```
ProviderAdapter (getCapabilities · getActions · getTriggers · isServerConfigured)
   ↓ buildConnectorManifest (@org/types connectors.ts)
ConnectorManifest: category · capabilities (query | action) · triggers · agentCapabilities · counts
   ↓                         ↓                               ↓
Connectors API         Agent runtime tools              Engine steps / triggers
GET /connectors        connectorToolName → slack_send_… PROVIDER.action (MCP_TOOL)
GET /connectors/:p     selectAgentTools (allowlist)     connector:PROVIDER:trigger → poller
POST /integrations/:id/test
```

A new adapter appears in every surface with no other change:
- the connectors center;
- the node adder;
- canvas cards;
- agent tools;
- workflow steps;
- triggers.

Nothing in the UI is special-cased per app.

## What now works (verified live)

1. **Connector registry API** (`libs/api/integrations/src/lib/connectors/`).
   - Manifests for every registered adapter.
   - The caller's connections only: the workspace's and their own, never another member's personal one.
   - 30-day usage and the last 50 activity rows, from `IntegrationAuditLog`.
   - A real connection test against the app's account endpoint. It records the result and flags "reconnect" on refused credentials.
2. **Honest availability.** `isServerConfigured()` per OAuth adapter. GitHub, Slack, Linear, Notion and Teams show "Not set up on this server" until their OAuth app env vars exist; Google apps and Trello are connectable.
3. **Triggers that really fire**, for any connector with a list/search action.
   - An adapter declares `getTriggers()`; each trigger polls one of its own **read** actions.
   - `ConnectorTriggerPollerService` (cron, every minute):
     - runs as the agent's owner;
     - the first check only records the items already there, and a changed trigger starts over without replaying history;
     - starts one run per new item, with the item as `{{event}}`;
     - backs off on failures (2 → 30 min);
     - caps runs at 10 per check and 30 per hour per agent (the loop guard);
     - records errors on the trigger, which the Copilot's "Runs on its own" line shows.
   - New table `connector_trigger_states` (migration `20261008140000`, applied). Activation now accepts a schedule **or** an app event.
   - Triggers declared: Gmail new email, Calendar new event, Drive file shared, GitHub new issue / PR / review requested, Linear new issue, Notion new page, Slack and Teams new channel message, Trello new card, Custom API new item.
4. **Agent tools fixed.** Writing `slack_send_message` into `agent.tools` used to **strip every built-in tool** and add no Slack tool, because integration tools came only from `CoworkerApp` links. `selectAgentTools` (pure, tested) now handles this:
   - connector names narrow that one app;
   - built-ins are kept, falling back to the default set;
   - canvas agents get exactly what's drawn.

   Canvas agents also used to get nothing from app actions in their Tools slot. The compiler now emits canonical tool names plus `connectors`, and the bridge resolves those apps from the workspace's or the owner's own connections.
5. **Canvas.**
   - `APP_CONNECTOR_ACTION` compiles to a real `PROVIDER.action` step. `APP_CONNECTOR_TRIGGER` compiles to a connector event. Legacy `TEAMS_*` cards keep working.
   - The node library and the "+" adder list every connector capability from the live manifests, with app icons.
   - The inspector panel is built from the manifest: app, capability, schema-driven inputs (any field takes a `{{variable}}`), connection status, a real "Run once now" (confirms writes), and a picker for the variables the engine actually resolves.
   - Cards show the live connection state.
6. **Studio UI, rewritten on the real API.**
   - Connectors page: real stats, search and filters, star (browser-local), connect, use in an agent.
   - Detail page tabs:
     - Overview, with usage and security;
     - Actions, with a real runner that confirms writes;
     - Triggers;
     - Connections, with test, reconnect and disconnect;
     - Activity.
   - Connect dialog: OAuth popup with completion via `postMessage`, or credentials checked by the server.
   - Add-to-agent dialog: links the connection and narrows the agent to the picked actions.
   - The agent's Connectors tab is rebuilt the same way.
7. **New capabilities on existing adapters.**
   - Gmail had no read actions: added `search_messages` and `get_thread`.
   - Custom API had no actions: added `get` (read) and `send` (write, confirmed), plus the `new_item` trigger, so any REST API is a tool and an event source.
   - Teams: real `list_channel_messages`.

### Live end-to-end checks (local API, NVIDIA model), all fixtures deleted afterwards

| Flow | Result |
| --- | --- |
| Connect app → test → run action | Custom API connected and checked by the server; test "Connected as…"; `GET /todos/1` → 200 with real data |
| Connector node → agent → run → tool executes → output | Test run COMPLETED: the connector step fetched the todos; the agent itself chose `custom_api_get` for `/users/1`; the output combined both ("Leanne Graham has 0 completed todos.") |
| Event → trigger → agent → completion | The agent was switched on with the `new_item` trigger. The cron poller primed, then fired exactly one **live** run for the new item (`startedBy: event`, `{{event}}` = the item). Activation shows the last check and last run. |
| Usage / history | Usage 5 calls, 100%, 167 ms, "Get data". Activity lists each call and the connection test. |
| Studio UI | Connectors page and detail page render real data; the UI runner returned `GET /users/2 → 200 OK` |

`nx affected -t typecheck,lint,test,build` is green: 79 projects. That includes `@org/ai-agent-studio` typecheck, which was red after `b54b69e`.

## Bugs found and fixed on the way

- **Security.** Custom API connections stored the raw config (API key, bearer token, password) in plain text in `configJson`, and `formatSafeIntegration` returned it to every client. Fixes:
  - it now stores a secret-free copy and is never returned;
  - custom header values are encrypted too;
  - data migration `20261008150000` scrubs rows already stored.
- **Fake Teams OAuth and actions** (simulated tokens, a fabricated account, mock results). It now refuses with "isn’t set up on this server".
- **Teams `search_messages`** searched the Outlook mailbox (`/me/messages`). It now uses Microsoft Search over `chatMessage`.
- **Teams triggers** were declaration-only and could never fire. They are replaced by a polled trigger.
- **Canvas.** `AppConnectorNode` rendered `<Shield>` without importing it, so a card with an approval flag crashed. The inspector's "Run Test Action" called a nonexistent `connectorService.executeAction`.
- **The node inspector's "Node Execution Sandbox"** (`simulateTestNode`) returned canned success for every node type. It was removed; real tests are the run console and "Run once now".
- Pre-existing typecheck and lint reds in the Teams adapter.

## Brief coverage

✅ done · 🟡 partial / exists elsewhere · ⬜ not started.

| § | Topic | Status |
| --- | --- | --- |
| 2–3 | Audit, Connector → Capability → Tool → Trigger architecture | ✅ (this doc) |
| 4–7 | Connector capability manifest, connectors center, cards, add from Studio | ✅ "Connect" from the inspector opens the connector page (no in-canvas OAuth dialog yet) |
| 8–13 | Agent types, prompt-to-agent, runtime, multi-agent | 🟡 From earlier passes. The prompt-to-agent planner doesn't yet emit `APP_CONNECTOR_*` cards (it uses `MCP_TOOL` + `PROVIDER.action`, which run the same way). |
| 14–17 | Node registry, connector node design, config panel, variables | 🟡 Connector nodes are done. A full typed variable picker with output schemas (§17) is still open, because adapters don't declare `outputSchema`. |
| 18, 39, 40 | Tool permissions, guardrails, security | 🟡 Owner-scoped execution, per-agent narrowing, confirmation on writes and existing `agentToolGate`. There is no workspace-level admin tool policy yet. |
| 19 | Human-in-the-loop | 🟡 Existing approvals; no connector-specific change |
| 20–22 | Memory, knowledge, LLM profiles | 🟡 Existing; untouched |
| 23 | One canonical tool registry | 🟡 Connector tools are canonical (`@org/types` connectors). Built-in MCP tools stay in `MCPToolRegistryService`; both meet in `selectAgentTools`. |
| 24–25 | Triggers / event-driven agents | ✅ Connector events (polled) and schedules. Webhook push from apps is still open (adapters' `handleWebhook` isn't routed to workspaces). |
| 26–29 | Long-running runs, reliability, observability, debug | 🟡 Engine features from earlier passes. Connector calls now show up in connector history. |
| 30–31, 52–53 | Versioning, templates, import/export, sharing | 🟡 Earlier passes; untouched |
| 32–33 | Chat → agent, agent discovery | ⬜ Not in this pass |
| 42–43 | Admin control, usage limits | 🟡 Per-connector usage; no admin connector allow-list yet |
| 44 | Error UX | ✅ Connectors: failures name the app and action, with reconnect / retry paths |
| 45–46 | Accessibility, responsive | 🟡 New UI uses labelled controls, `aria-pressed`, `role=status/alert`, and stacks on small screens; no audit |
| 51 | Custom connectors | ✅ Custom REST API: actions + trigger |
| 58 | Tests | ✅ Unit: types (+20), integrations registry/custom API/Teams, runtime tool selection, bridge, poller, compiler, Studio services. Live E2E above. No Playwright E2E. |
| 63 | No fake functionality | ✅ For connectors. Other Studio pages still use mocks; see below. |

## Agent page clean-up (same day)

- **Canvas layout.** Slot attachments (Prompt, LLM, Embeddings, Tools, Sub-agents) used to be laid out as flow steps, so a tall Prompt card landed in the End node's column and covered it.
  - Auto layout now hangs them in a row under their agent, nested for sub-agents, and the agent reserves that room.
  - The flow lines up on the agent's header dots (`AGENT_HANDLE_TOP`), so edges run straight.
  - New attachments from a slot's "+" go into the same row.
- **Live problem badges.** The page compiles the canvas with `compileStudioGraph` on every change. Each card shows a red (blocks the run) or amber badge listing the compiler's messages.
- **Knowledge step without a base.** It used to "succeed" with nothing found. Now the compiler flags it as an error, and the engine fails the step, including when retrieval throws.
- **Tabs.** Multi-Agent (scripted fake logs) and Widget (localStorage only) were removed; the real multi-agent feature is the canvas Sub-agents slot. Variables became **Secrets** (the real workspace vault), and Evaluation runs real test runs with no invented scores. Both were lifted from the unmerged worktree. Labels show from `xl` up.
- **No fake saves.** The page's mock fallbacks were removed: get, versions, rename, publish and unpublish no longer "succeed" through localStorage. `agentService.updateAgent` is server-only and merges partial configuration.
- **Agent card.** The Prompt row shows the prompt's first real line, not "Prompt". The minimap uses calmer colours.

## Still open (most valuable first)

1. **Finish merging the mock-strip worktree** (`.claude/worktrees/blissful-chatelet-7885b8`). The agent page, Evaluation, Secrets and `updateAgent` are now merged. Still in main: the agents list and templates `agentService` fallbacks, `integrationService` / `knowledgeService` / `mockData`, and the Developer page.
2. Push triggers: route provider webhooks (Slack Events, GitHub, Graph subscriptions) to workspaces, as a faster alternative to polling.
3. `outputSchema` on adapter actions, and a typed variable picker (§17).
4. Prompt-to-agent emitting `APP_CONNECTOR_*` cards and suggesting triggers from the manifest.
5. Workspace admin policy: allowed connectors and per-tool Allowed / Approval / Disabled.
6. Chat invoking agents (§32), and agents and connectors in global search (§54).
7. Encryption key: `IntegrationEncryptionService` falls back to a hard-coded default when neither `ENCRYPTION_KEY` nor `JWT_ACCESS_SECRET` is set. Production must set one.

## Gotchas

- The Studio's Vite server serves `@org/*` from node_modules unwatched. After adding a lib export, `touch apps/ai-agent-studio/vite.config.mts`.
- Prisma `DateTime` columns are UTC `timestamp without time zone`, and the dev DB session is IST. In raw SQL use `now() at time zone 'utc'`, or the poller sees a future `lastPolledAt` and never polls. This cost one test cycle.
- Seeded members can't create agents. E2E uses a fixture `ai_agents` row with `provider: nvidia`; the script is in the session scratchpad.

## Multi-connector pass (2026-10-14, uncommitted, green)

The audit found the platform above already real (manifests, encrypted credentials, tools, polled triggers, engine approvals). This pass adds what was missing for one agent to coordinate several apps.

**New connectors** (manual credentials, stored encrypted, SSRF-guarded, adapter declares its own connect form via `credentialFields`):
- Shopify Admin REST: orders, products, customers; add note; cancel and refund (destructive, confirmed). Shop address is restricted to `*.myshopify.com`. Refund is capped at what is left to refund.
- WhatsApp Business Cloud: template and text sends, templates list, number status. Every send needs `customerOptedIn`; Meta policy errors (24-hour window, template mismatch, quality limits) are explained in plain words.
- WordPress REST (application password, HTTPS only): drafts, update, publish (confirmed), moderate and reply to comments, trash (never a hard delete).

**Framework**
- `connector-http.ts`: one client with timeout, 429 `Retry-After` handling, retries only where safe (never a POST that may have landed), errors that never echo headers.
- `action-input.ts`: input is checked against the adapter's JSON Schema before any adapter runs (required, types, enums; string forms of numbers, booleans and lists are converted).
- Idempotency: `ConnectorActionExecution` ledger. The engine passes `runId:stepId:loopIndex` for every non-read connector action, so a retried or resumed step never repeats a refund or a message.
- Push events: `POST /webhooks/connectors/:integrationId` (public). Signature is verified per connection against the encrypted secret over the raw body, deliveries are recorded once, then `ConnectorEventReceived` starts matching switched-on agents (same hourly cap as the poller). `GET` answers WhatsApp's `hub.challenge`. Triggers can now declare `delivery: 'webhook'`. The connection card shows the webhook address.
- Human approval: a connector card with `requireApproval` compiles to a `HUMAN_APPROVAL` step in front of it (existing engine approvals), and the approver sees a read-only "What will happen" preview with the resolved input. The inspector defaults it on for confirmed and destructive actions.
- Engine fills `{{variables}}` inside lists and nested objects of tool input (template parameters).

**Groups**: `ConnectorGroup` (migration `20261014120000`, applied). CRUD at `/workspaces/:id/connector-groups`; creator or admin edits; templates are visible to the workspace and copied (without connections) to reuse. Studio: `/connectors/groups` page, and on an agent's Apps tab "Use a group" and "Save as group". Applying a group links each connection, keeps built-in tools, narrows each app to its actions and writes "ask first" as `runtime.rules.policies[tool] = 'ask_user'`.

**Template**: "Shopify Order Alerts: Slack + WhatsApp" (order → Slack → consent and phone check → approval → WhatsApp template).

### Needs external setup (not testable here)
- Shopify: a custom app's Admin API token (plus its API secret for push events, and a Shopify webhook pointing at the connection's webhook address).
- WhatsApp: a Meta app with a permanent system-user token, phone number id, an approved template; for incoming messages the app secret, a verify token and the webhook registered in Meta.
- WordPress: an application password on an HTTPS site.
- Verified live: webhook rejects unsigned and forged pushes, accepts a signed one, drops a redelivery (fixture connection, since removed). Provider API calls are covered by mocked-HTTP tests only.

### Still open
- Studio pages were typechecked, linted and built but not clicked through (no signed-in session available).
- One connection per app per workspace (connection id is `workspace_PROVIDER`), so two Shopify stores in one workspace need a second workspace.
- No per-tool admin allow-list; WhatsApp inbound messages are push-only (no polling fallback).
