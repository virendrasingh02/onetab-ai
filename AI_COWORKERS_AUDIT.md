# AI Coworkers: audit and reorganisation (2026-10-21)

Status: all changes are **uncommitted** on `main`. Typecheck, lint and tests pass on the touched projects. The two exceptions are listed under "Tests and checks".

The reference screenshots were not attached to the request and none were on disk. The UI follows the written brief and the existing Studio design system.

## 1. What already existed (reused, not rebuilt)

| Need | Existing piece reused |
| --- | --- |
| Coworker identity, prompt, model, grants | `AIAgent` (`type: 'coworker'`) + `COWORKER_TEMPLATES` + race-safe seeding in `AIEntitiesService.initializeDefaultCoworkers` |
| Orchestrator | The coworker's own runtime turn (`AIRuntimeService`). It already plans, uses tools, delegates to linked agents and hands off to collaborator coworkers. There is no extra `AIAgent` row for it, so nothing is duplicated and nothing counts against the plan's micro-agent limit. |
| Specialist reasoning agents | `CoworkerAgent` delegation links ("consult this specialist" tools) |
| Connector agents | `CoworkerApp` → `ExternalIntegration`. One canonical connection per workspace and app (`<workspaceId>_<PROVIDER>`), attachable to any number of coworkers. |
| Credential scopes | `ConnectorRegistryService.list` only returns workspace connections and the caller's own personal ones. `linkApp` re-checks access server-side. |
| Approval for sensitive actions | Every connector action that isn't a read has `requiresConfirmation`. The runtime queues it as an approval (`queueApproval`) and never runs it directly. |
| Execution, logging, retries | `AIExecution` run records (status, tokens, latency, waiting-approval). `connectorRequest` retries 429s and idempotent requests and never resends a POST. `IntegrationAuditLog` records each call. |
| Permissions | `WorkspaceRoleGuard`, `RequireWorkspacePermissions(UPDATE)`, `CanManageAIEntity`. The UI mirrors them with `useCanManageAIResource` and `useWorkspacePermission`. |
| Model selector | `ProviderModelFields` from the coworker dialog, now exported. |
| Connector icons | Studio `AppConnectorIcon` |

## 2. Default coworkers

| Coworker | Template | Connectors it orchestrates | Adopts an existing coworker from |
| --- | --- | --- | --- |
| **Ledger**: Finance & Billing | `ledger` (new) | QuickBooks, Xero, Stripe | `finance` |
| **Tracker**: Projects & Work | `tracker` (kept; collaborators now also include Shipper and Relay) | Trello, Jira, Linear, Asana, GitHub | n/a (already a default) |
| **Shipper**: Engineering & DevOps | `shipper` (new) | GitHub, GitLab, Bitbucket, CircleCI, Vercel | `developer` |
| **Ada**: People & HR Ops | `ada` (new) | Zoho People, BambooHR, RazorpayX Payroll, DocuSign | `hr` |
| **Relay**: Email & Notifications | `relay` (new) | SendGrid | n/a |

Seeding rules:
- A default is "present" if any coworker has its template key or its name, so renamed defaults are never re-created.
- If a default is missing and the workspace has a coworker from the template it adopts (e.g. Finance), the oldest such coworker is **adopted**. Its name, prompt, grants, links and run history stay as they are. Only `configuration.coworkerType` changes, and `configuration.adoptedFrom` records the old template. No duplicate is created.
- Seeding still runs under the per-workspace advisory lock.
- Newly seeded coworkers now get the same default model a hand-made coworker gets (`AI_DEFAULT_PROVIDER` / `AI_DEFAULT_MODEL`) instead of the column default `ollama/llama3`. Existing rows are not changed.

Live check against the dev DB: 3 workspaces were seeded with Ledger, Shipper, Ada and Relay by the running API. A second load created nothing. A custom coworker ("Test") was left alone. No workspace had a Finance, Developer or HR coworker, so adoption is covered by unit tests only.

## 3. Connectors added

| App | Auth | Reads | Writes (all approval-gated) | Triggers |
| --- | --- | --- | --- | --- |
| QuickBooks | OAuth 2.0 (Intuit); `realmId` from the callback | company, invoices, customers, payments, read-only `SELECT` over whitelisted entities | create invoice, email invoice | new invoice, new payment |
| Xero | OAuth 2.0; tenant from `/connections`; `XERO_SCOPES` override | organisation, invoices, contacts, payments | draft invoice (DRAFT only) | new invoice, new payment |
| DocuSign | OAuth 2.0 auth-code; account + base URI from `/oauth/userinfo`, host pinned to `*.docusign.net/com` | envelopes, recipients, templates | send from template; void (destructive) | envelope completed |
| GitLab | PAT; gitlab.com or https self-managed origin | projects, MRs, pipelines, jobs, job logs, issues | create issue, retry pipeline, cancel pipeline (destructive) | pipeline failed, new MR |
| Bitbucket | Atlassian API token / app password, per workspace | repos, PRs, pipelines | run pipeline | new PR, pipeline failed |
| CircleCI | Personal token | pipelines, workflows, failed workflows, jobs | rerun, trigger, cancel (destructive) | workflow failed |
| SendGrid | API key (must have `mail.send`); sender fixed by the connection | stats, bounces | send email | n/a |
| BambooHR | API key + company subdomain | directory, employee, who's out, time-off requests | request time off | new time-off request |
| Zoho People | Self-client refresh token (non-rotating), data centre | employees, find employee, leave records | read-only by design | new leave record |

Shared infrastructure:
- New `OAuthRestConnector` base for OAuth-only apps. It handles the consent URL, code exchange (never retried), refresh, account discovery and action execution.
- `isServerConfigured()` keeps "Not set up on this server" honest.
- QuickBooks, Xero and DocuSign were added to `OAUTH_APP_DEFINITIONS`, so a workspace admin can bring their own OAuth app.

## 4. Bugs found and fixed

1. **Rotated refresh tokens were dropped.** The proactive refresh in `IntegrationManagerService.resolveCredential` saved the new access token but discarded a new refresh token. Apps that rotate on every refresh (Xero, Microsoft, QuickBooks) would stop working after the first refresh. It now persists the rotated token.
2. **OAuth callbacks lost extra query parameters.** QuickBooks sends the company (`realmId`) only in the callback URL. The callback now passes it through (`handleCallback(..., { params })`).
3. **Seeded coworkers used the `ollama/llama3` column default** instead of the configured default model. Fixed for new seeds; see section 2.

## 5. The Coworkers page (Studio → Build & Orchestrate → AI Coworkers)

- Route: `/w/:slug/ai/coworkers`.
  - The legacy `/w/:slug/coworkers` and the AI Studio "coworkers" tab now redirect here.
- New API: `GET /workspaces/:id/coworkers/roster` (`CoworkerRosterService`).
  - One read, using grouped queries (about 200 ms on the dev DB).
  - Every number comes from the database.
- Expandable cards:
  - **Header:** status, an "adopted from" badge, connector icon strip (attached in colour, the rest dimmed), specialist, connector and workflow counts, approvals waiting, and runs over 30 days.
  - **Orchestrator:** tool and granted-write counts, collaborators, channels, and the model selector (save and cancel). Launch and Pause change `isActive`; Pause asks for confirmation. It also links to Chat and Configure.
  - **Specialist agents:** the linked agents.
  - **Connector agents:** each connector shows one of six real states:
    - attached
    - ready to attach (prefers the workspace-wide connection)
    - reconnect
    - not connected
    - needs OAuth app
    - not available

    Attach, Attach all, Detach (with confirmation) and Connect/Set up act per connector. Each one also shows its read/write/trigger counts and which other coworkers share the connection.
  - **Workflows:** workflows that call the coworker through an `AI_COWORKER` node, parsed the same way the engine parses them. A "shared" marker appears when other coworkers are called too.
  - **Usage & execution:** runs in 30 days and this month, failures, awaiting approval, open and completed tasks, tokens, average run time, deployments (active/total) and last run. Links go to the filtered execution history and to Approvals.
- Plan strip: AI runs this month against the plan's monthly requests, running now against plan concurrency, and the plan's shared vCPU/RAM and per-step time limit (`PLANS_CONFIG.machineLimits`).
  - These are workspace-level. No per-coworker machine allocation exists in the platform, so none is shown.
- States: loading, error with retry, empty, and success/error toasts. Expand-all and collapse-all are available. Each card's header button has `aria-expanded` and `aria-controls`, and the icon strip has screen-reader labels.

## 6. Tests and checks run

| Check | Result |
| --- | --- |
| Typecheck: `@org/types`, `@org/api`, `@org/api-integrations`, `@org/api-agents`, `@org/api-coworkers`, `@org/api-client`, `@org/web-coworkers`, `@org/ai-agent-studio`, `@org/web` | pass |
| Lint: same libraries | 0 errors (existing warnings only) |
| Tests: `@org/types` 283, `@org/api-agents` 153, `@org/api-coworkers` + `@org/web-coworkers` 16, `@org/api-integrations` 217 | all pass |
| New tests | `coworker-connectors.spec.ts` (21: every new adapter's approval flags and triggers, OAuth not-configured honesty, QuickBooks realm/query guard, Xero tenant + rotated refresh token, DocuSign host pinning, GitLab/SendGrid/Zoho request shapes, input validation); `coworker-roster.spec.ts` (connector state rules, workflow parsing, template integrity); 2 new seeding cases (adoption, full default set) |
| Live roster against the dev DB | pass. Real plan (Max), real run counts; second load stable. |
| `ssrf-guard.service.spec` | timed out once on a live DNS lookup in the full run; passes 7/7 alone (flaky, unrelated) |
| `@org/ai-agent-studio` tests | 7 suites can't load: `@org/ui` `model-icon-map.ts` deep-imports `@lobehub/icons/es/.../Mono.js`. Pre-existing (last changed in `acb03ab`; this pass doesn't touch `@org/ui` or packages). The 32 tests that load pass. |

**Browser check (2026-10-21, signed in as the workspace owner, `virendra-s-workspace`):**

| What | Result |
| --- | --- |
| Page loads with live data | 7 coworkers, Max plan, 46/100,000 runs, 0/100 running, 8 vCPU · 16 GB |
| Connector states | All six states seen. RazorpayX Payroll shows Not available; Asana shows Ready to attach on Tracker. |
| Expand, collapse, expand all, collapse all | Work; `aria-expanded` is correct |
| Attach then Detach Asana on Tracker | `POST → 201`, then the confirmation dialog and `DELETE → 200`; state back to Ready to attach |
| Pause then Launch Ledger | Confirmation dialog, then the Paused badge; back to Live. The dialog's claims match the runtime (`executeTurn` refuses paused entities; the schedule, monitor and chat bridges skip them). |
| Model save | "Provider default" → `PATCH → 200` and it persisted. Ledger was restored to `ollama/llama3` afterwards. |
| Execution history link | Opens Runs filtered to the coworker; Tracker's 2 runs match its card |
| Width check | No horizontal scroll at the 530 px pane width |

Fixed during the browser check:
- Grid children overflowed the card. They now have `min-w-0`.
- The Provider select was blank when the stored provider (`ollama`) isn't in the configured list. This was in the shared `ProviderModelFields`, so the coworker editor dialog is fixed too.
- The card header was a `<button>` containing a `<ul>`, which is invalid HTML. It now uses spans and has an explicit accessible name.
- Saving "Provider default" sent `undefined`, so nothing changed even though the toast reported success. Save now sends only the fields that changed, empty values included.
- A paused coworker still showed the green status dot.
- The toast wording after a model change.

Dev gotcha: a full page reload of the Studio in the built-in browser lands on its own sign-in, because the refresh cookie gets a 401. Entering through the main app's hand-off (`/w/:slug/ai/...` on :4200) works.

## 7. Remaining blockers and configuration

- **RazorpayX Payroll: not implemented.** I found no official public API reference, only third-party guides. Ada lists it as "Not available" rather than pretending to connect.
- **QuickBooks, Xero, DocuSign** need OAuth app credentials. Either set `QUICKBOOKS_* / XERO_* / DOCUSIGN_* _CLIENT_ID/_CLIENT_SECRET` (+ `_REDIRECT_URI`, optional `QUICKBOOKS_ENVIRONMENT=sandbox`, `DOCUSIGN_ENVIRONMENT=demo`), or a workspace admin adds an OAuth app in Connectors. The callback URL is `/api/v1/integrations/<quickbooks|xero|docusign>/callback`.
- **Xero granular scopes:** apps created on Xero's newer granular scopes must set `XERO_SCOPES`.
- **Not verified against live third-party accounts:** none of the nine new adapters has been run against a real account; tests mock HTTP. Request shapes follow each vendor's documented API.
- **Zoho People is read-only.** HR record changes go through BambooHR or DocuSign.
- **Specialist agents are not auto-created.** Creating `type: 'agent'` rows would count against plan micro-agent limits. Link them per coworker from Configure.
- **Connector attachment is explicit.** A workspace connection is never attached to a coworker automatically, because attaching grants that coworker access to the credential.
- **Existing defaults keep their stored model.** Scheduler and Tracker rows from before this pass still use `ollama/llama3`, which does run in this environment. Change them from the model selector if needed.
