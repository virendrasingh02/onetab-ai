# Settings Unification — Follow-ups

Companion to the settings-unification pass (see plan / session for full context). This file lists what was deliberately **deferred**, so it is never mistaken for done. Everything below was a conscious scoping decision, not an oversight discovered later.

## Update — 2026-09-21

Two of the items below are now done:

- **Frontend permission-gating** (was: "Deferred — frontend polish on the new
  backend enforcement"). A shared `useCreationPolicies(workspaceId)` hook
  (`libs/web/workspace/src/lib/use-workspaces.ts`, next to
  `useWorkspacePolicies`) lifts the Integration Hub's disabled-button-plus-
  `<Hint>` pattern into `CoworkerDirectoryView`'s two "Add/Create Coworker"
  buttons and `AgentMarketplaceView`'s "Build Agent"/"Create New Agent"
  buttons. More robustly, `AgentBuilderView` itself — the single chokepoint
  every agent-creation path routes through, including a direct URL visit —
  now disables Save with an explanatory tooltip and rejects the mutate call
  itself when `whoCanCreateAgents` disallows a *new* agent (editing an
  existing one is unaffected). Verified live: a seeded MEMBER-role test
  account sees both buttons disabled and the builder's Save button disabled
  with "Only admins can create agents in this workspace."
- **Settings tabs left on the old local-only store** (automations, schedule,
  pulse, documents, files, and the listed `general`/notify fields). Rather
  than swapping ~28 individual `useWorkspacePreference` call sites to bespoke
  new hooks, a new `WorkspaceMemberPreference` Prisma model (migration
  `20260921120000_workspace_member_preferences`, mirrors
  `WorkspaceThemePreference`'s per-(workspace, user) JSON-blob shape exactly)
  plus `GET/PUT /workspaces/:id/settings/member-preferences` backs the
  *existing* Zustand store transparently: `useWorkspaceMemberPreferencesSync`
  (mounted once in `settings-layout.tsx`, alongside the existing
  `WorkspacePreferencesEffects`) hydrates the whole `byWorkspace[workspaceId]`
  map from the server on first load and pushes local changes back debounced
  (900ms), the same shape `usePreferencesSync` already uses for the user's
  global chat/notification preferences. No call site in
  `workspace-settings-page.tsx` needed to change. `settings.updated` (new
  category `memberPreferences`) invalidates the query on the realtime bridge
  so a change on another device shows up live. Verified live: toggling
  "Google Calendar Sync" in the Schedule tab produced a real
  `workspace_member_preferences` row in Postgres and survived a reload.
  `fontSize`'s existing live-effect wiring was untouched (it rides along in
  the same generic sync for free, which is harmless).
  Enforcement (actually gating `googleCalendarSync`/`githubPRWebhook`/
  `trackCommitsInPulse` against the real Google Calendar/GitHub integrations
  that already exist) was **not** attempted — out of scope for this pass, see
  the deferred list below, now narrowed to just that.

## What this pass actually shipped

- **Foundation**: a shared 3-tier policy resolver (`resolvePolicyGatedSetting` in `libs/shared/types/src/lib/feature-settings.ts`), the `settings.updated` realtime event wired end-to-end (emit → SSE → `@org/sync` cache invalidation), and the Redux `preferences` slice (chat + notification/sound settings) actually round-tripping to the server for the first time — it was 100% `localStorage`-only before this, despite the backend already persisting the `chat` half.
- **Fixed fake Settings tabs**: Channels & DMs, AI Models & Persona, Agent Marketplace, Integration Hub (in-Settings), Billing member count, and the Danger Zone's delete-workspace dialog (now the shared `confirm()` with `requireText`) — all previously bound to a client-only store or hardcoded arrays with dead handlers.
- **New real, enforced settings**: `whoCanReact`, `readReceiptsPolicy`, `messageEditWindowMinutes` + `MODERATE_MESSAGES`, `maxUploadSizeMb`, `autoArchiveInactiveDays` (+ a real daily sweep), `defaultChannelId` (+ real join-flow wiring), `showTypingIndicators`. Each has backend persistence, backend enforcement where the architecture allows it, and frontend UI in Permissions & Policies / Chat Settings.
- **App/Agent/Coworker creation** (`whoCanInstallApps`, `whoCanCreateAgents`, `whoCanCreateCoworkers`) now actually gate the real connect/create endpoints server-side — previously only the coarse RBAC `CREATE` permission (held by every member) gated them, so the policy fields existed but did nothing.

## Deferred — no real backing exists yet, intentionally not faked

- **Scheduled message send.** The dead `onSchedule` stub (hardcoded time options, never reachable — no caller passed the prop) was removed from `composer.tsx` rather than left as unreachable code. A real version needs a DB model (`ScheduledMessage` or similar) and a delivery worker; this was already a known backlog item from the September voice/scheduling brief.
- **DM end-to-end encryption.** The Channels & DMs tab's "Direct Message E2EE" control is now an honest disabled switch with "Coming soon" copy. No E2EE toggle infrastructure exists anywhere in the codebase (Matrix DM rooms are encrypted by default at the transport level, but there's no per-workspace policy layer for it).
- **DM/Group-DM settings have no server-side home.** `use-dm-preferences.ts` (favorites/mutes) is still a client-only, localStorage-persisted zustand store, explicitly documented in that file as "when DMs grow a server-side record, swap this store." Out of scope here — DMs have no Postgres model at all (pure Matrix rooms).

## Resolved (2026-09-21) — real settings-page tabs left on the old local-only store

~~Per the plan's scoping, only the tabs with clearly fake/dead controls~~ — as of the 2026-09-21 pass, every field below round-trips to the server via `WorkspaceMemberPreference` + `useWorkspaceMemberPreferencesSync` (see the update note at the top of this file). None of them gained real *enforcement* (a value existing server-side is not the same as something consuming it to gate real behavior) except where noted:

- `automations` (Workflow Automations config), `schedule` (Schedule & Meetings prefs), `pulse` (Activity Feed prefs), `documents` (Notes & Documents editor prefs), `files` (Files & Storage prefs)
- The `general`/`preferences` tab's `homeView`, `displayNamePref`, `firstDay`, `convertEmojis`, `sendShortcut`, `fontSize` (fontSize keeps its pre-existing live effect via `useApplyWorkspacePreferences`, now also server-synced as a side effect of the generic sync)
- `notifyDigest`, `notifyDesktopPush`, `notifyChannelScope` (the real per-category notification routing already lives in `NotificationDisplaySettingsPanel`/`NotificationsService`; these three remain a separate, cosmetic set in the general tab — now server-persisted, still not consumed by anything)
- `docAutoSave`, `grammarAssistance`, `codeSyntaxTheme`, `highQualityVideo`, `fileRetention`, `googleCalendarSync`, `meetingProvider`, `autoRecordMeetings`, `trackOnlineStatus`, `trackCommitsInPulse`, `githubPRWebhook`, `channelTrigger`, `maxConcurrentRuns`, `retryFailedSteps`, `timeFormatPref`, `dateFormatPref`, `workStartHour`, `workEndHour`, `workdays`

**Still open**: wiring `googleCalendarSync`/`githubPRWebhook`/`trackCommitsInPulse` — the three fields with real backing already available (`libs/api/integrations/.../providers/google-calendar.provider.ts`, `github.provider.ts`, both OAuth-connected with `supportsSync`/`supportsWebhooks`) — to actually gate that provider's sync/webhook behavior, instead of just being persisted. The rest have no real consuming feature to wire to yet (same "identify whether real backing exists, wire it or mark it Coming soon" judgment call as before, just now starting from "persisted" instead of "not even that").

## Resolved (2026-09-21) — frontend polish on the new backend enforcement

~~`whoCanCreateAgents`/`whoCanCreateCoworkers`/`whoCanInstallApps` are now enforced server-side... The equivalent frontend gating was not added~~ — it now is. `useCreationPolicies(workspaceId)` (`libs/web/workspace/src/lib/use-workspaces.ts`) is the shared hook; `CoworkerDirectoryView`'s two buttons and `AgentMarketplaceView`'s (`MarketplaceHeader`/`MarketplaceMyItemsView`) creation buttons are disabled with a `<Hint>` for a disallowed member. `AgentBuilderView` itself additionally rejects a *new*-agent save (editing an existing agent is unaffected) regardless of entry point, which also covers the dashboard/AI-Studio quick-action links into the builder without needing to gate each of those individually.

## Deferred — deeper capability system

- Per-tool/per-capability granular toggles for agents and coworkers beyond today's `allowedActions` checklist (e.g. a workspace-wide "agents may not access the filesystem" policy) were not added — `whoCanCreateAgents`/`whoCanCreateCoworkers` gate *creation*, not runtime tool access.
- `ChannelIntegration.isEnabled` / `ChannelAgent.isEnabled` / `ChannelCoworker.isEnabled` were checked (per the plan's Phase D) — no gap was found: these already gate channel-room responses server-side via `AgentMatrixBridgeService`/the Matrix bridge, and don't apply to the 1:1 DM-style `AppChatView`/`AgentChatView`/`CoworkerChatView` surfaces (which aren't channel-scoped). No change was needed there.
- Non-English i18n of all new copy (new Settings rows, error messages, "Coming soon" labels) — written in English only, matching the surrounding untranslated copy in the same files.
- Full manual mobile QA pass — the new UI reuses existing responsive primitives (`SettingsRow`/`SettingsCard`/`Select`/`Switch`) and should inherit their mobile behavior, but was not independently clicked through on a small viewport.

## A note on "migrating" old local preferences

The plan considered migrating stale `localStorage` values (e.g. a member's old local `allowPublicCreation` toggle) into the new real workspace-wide policy on first load. This was deliberately **not** done: those old values were per-device, never had multi-user consistency, and silently promoting one member's stale local click into a real workspace-wide policy write would be a correctness regression, not a safety net. The old keys are simply orphaned in `localStorage` now — harmless, since nothing reads them anymore.
