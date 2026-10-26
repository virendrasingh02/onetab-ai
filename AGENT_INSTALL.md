# Install Custom Agent — architecture & status

Built on the existing marketplace (`@org/api-marketplace`, `@org/web-agents`) rather than beside it. Agent
listings (AI Agent Studio "Publish to marketplace", seeded/community listings) now install through a
server-confirmed lifecycle; apps/integrations keep the generic install.

## Layers (kept separate)

| Layer | Where | Notes |
| --- | --- | --- |
| Definition | `MarketplaceListing` (`manifestJson`, `payloadJson.blueprint`) | Versioned; republishing never touches installs. |
| Installation record | `MarketplaceInstallation` (one per listing per workspace) | Status, scope, access, approved permissions, pinned manifest, health, last error, lease. |
| Runtime | `AIAgent` provisioned per install (`configuration.marketplace`) | Gated at run time by `AgentInstallService.assertCanRun`. |
| User config | `settingsJson` (plain values + `_secretRefs`), secrets in `AISecret` | Secret values never stored in settings, manifests, logs or responses. |

## Lifecycle

`PENDING_APPROVAL → INSTALLING → ACTIVE ⇄ DISABLED`, `ACTIVE → UPDATING → ACTIVE`, `* → FAILED`, `* → UNINSTALLED`.

* **Install** (`POST …/agent-installs/:slug`): validate package → permission/approval check → config validation
  (secrets split out) → connector dependency check → take a DB lease (unique `(listing, workspace)` row +
  conditional `updateMany`; stale after 2 min) → store secrets → create the agent → health check → one transaction
  flips the row to `ACTIVE`, bumps the install count and writes the audit row. A repeat request on an
  `ACTIVE`/`DISABLED` install is a no-op (`alreadyInstalled: true`).
* **Failure**: anything this attempt created (agent, secrets) is removed; the row becomes `FAILED` with a typed
  `lastErrorCode`; the dialog offers a retry. Never reports success before the health check passed.
* **Update** (`…/update`): listing version is only applied on request. Any permission not already approved needs a
  fresh approval (`PERMISSION_APPROVAL_REQUIRED`); a failed update restores the agent from `rollbackJson`.
* **Disable/enable**, **access** (scope + roles + named users), **uninstall** (keeps agent, conversations and
  settings so reinstall restores them) and **purge** (`?purge=true&confirm=true`: deletes agent, history and stored
  credentials; type-to-confirm in the UI).
* **Reinstall** after uninstall/failure is the same install call; a kept agent is reactivated, not overwritten.

## Package / manifest format

A package is data, never code: `manifestJson` + `payloadJson.blueprint` (prompt, provider/model, tool ids, canvas
graph). Validated by `agent-manifest.ts` (zod): `capabilities` (tool ids, `^[A-Za-z0-9_.:-]{1,80}$`),
`security.externalServices` (public https URLs only), `dependencies.connectors`, `configSchema`
(`text|secret|url|select|boolean`, max 24), `requiresAdmin`, `minPlatformVersion`, `compatibility.platforms`,
prompt ≤ 50k chars, graph ≤ 1 MB. Studio's "Check & preview" runs the same validator before publishing.

Permissions are derived from the package: workspace context (standard), each tool (sensitive when its id implies
delete/exec/http/email/payment/publish…), external hosts, connector use, and code/HTTP graph nodes (all sensitive).

## Roles & policy (enforced server-side)

* Install needs `CREATE` + either `MANAGE_SETTINGS`, or the workspace policy **whoCanInstallApps** (Settings →
  Permissions). Policy-allowed members install **for themselves only** (`PERSONAL`) and only agents with no
  sensitive permissions; otherwise they **request** and an admin approves (queue in Installed → AI agents).
* Sensitive permissions must be named in `approvedPermissions` by the approver.
* Admin-only: approve/reject, change access, audit history. Creator or admin: update/disable/uninstall.
  Personal installs are managed by their owner.
* Runtime: `AIRuntimeService.executeTurn` calls `assertCanRun` (inactive → 409, outside access list → 403) and the
  agent list hides restricted installs. Every action is audited in `WorkspaceAuditLog` (`agent.*`), written in the
  same transaction as the state change.
* The generic `/installations` routes now refuse AGENT listings (`USE_AGENT_INSTALL_FLOW`) so nothing can bypass
  the flow. Rate limits: 10/min on install, request, resolve, update, uninstall; 20/min on health.

## Database

Migration `20261026130000_agent_install_lifecycle` (additive, backfills `agentId` for existing installs).
Apply with `npx prisma migrate deploy`. No new env vars; secrets use the existing `AISecretsService` encryption
(`ENCRYPTION_KEY`, else `JWT_ACCESS_SECRET`). No new infrastructure or paid services.

## Fixes made on the way

* Marketplace "Installed"/approval views read fields the API never sent (`enabled`, `kind`, `approvalStatus`…) —
  added `normalizeInstallation`; "Start chat" used the installation id as the agent id.
* Failed/pending installs counted as "installed" on catalog cards, blocking retry.

## Tests

`libs/api/marketplace` (56): manifest validation, install/idempotency/concurrency, secrets, approvals, failure
recovery, update/rollback, uninstall/purge, runtime access, authorization metadata. `libs/web/agents` (12):
dialog loading/permission review/progress/server-confirmed success/errors/request flow, installed section states.

## Known limits (honest)

* **Not built:** importing agent packages from arbitrary files/URLs. Sources today: marketplace/community listings and
  Studio publishes. No executable packages exist, so there is nothing to sandbox beyond the workflow engine's
  existing node sandbox.
* Permission sensitivity is a name/node-type heuristic. Approved permissions are recorded and gate install/update;
  the runtime tool list still comes from the agent's own config (existing tool gates/approvals apply), not a
  per-install allowlist.
* SSRF validation checks hostnames and IP literals, not DNS resolution.
* One install per listing per workspace; `PERSONAL` therefore means "installer only", not one copy per person.
* A workspace's own Studio agent is already live there (`OWN_AGENT`); "Publish & install" for another workspace
  is done from that workspace's marketplace (publish PUBLIC first).
* No notification/event beyond the audit row; no manual rollback endpoint (rollback is automatic on failed update).
* Desktop/mobile reuse the same API/records; no native capability was added and neither shell was exercised here.
* UI verified by component tests and typecheck/lint only — not clicked through in a browser against a seeded admin.
