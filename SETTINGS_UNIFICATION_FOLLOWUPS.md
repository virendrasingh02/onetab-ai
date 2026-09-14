# Settings Unification — Follow-ups

Companion to the settings-unification pass (see plan / session for full context). This file lists what was deliberately **deferred**, so it is never mistaken for done. Everything below was a conscious scoping decision, not an oversight discovered later.

## What this pass actually shipped

- **Foundation**: a shared 3-tier policy resolver (`resolvePolicyGatedSetting` in `libs/shared/types/src/lib/feature-settings.ts`), the `settings.updated` realtime event wired end-to-end (emit → SSE → `@org/sync` cache invalidation), and the Redux `preferences` slice (chat + notification/sound settings) actually round-tripping to the server for the first time — it was 100% `localStorage`-only before this, despite the backend already persisting the `chat` half.
- **Fixed fake Settings tabs**: Channels & DMs, AI Models & Persona, Agent Marketplace, Integration Hub (in-Settings), Billing member count, and the Danger Zone's delete-workspace dialog (now the shared `confirm()` with `requireText`) — all previously bound to a client-only store or hardcoded arrays with dead handlers.
- **New real, enforced settings**: `whoCanReact`, `readReceiptsPolicy`, `messageEditWindowMinutes` + `MODERATE_MESSAGES`, `maxUploadSizeMb`, `autoArchiveInactiveDays` (+ a real daily sweep), `defaultChannelId` (+ real join-flow wiring), `showTypingIndicators`. Each has backend persistence, backend enforcement where the architecture allows it, and frontend UI in Permissions & Policies / Chat Settings.
- **App/Agent/Coworker creation** (`whoCanInstallApps`, `whoCanCreateAgents`, `whoCanCreateCoworkers`) now actually gate the real connect/create endpoints server-side — previously only the coarse RBAC `CREATE` permission (held by every member) gated them, so the policy fields existed but did nothing.

## Deferred — no real backing exists yet, intentionally not faked

- **Scheduled message send.** The dead `onSchedule` stub (hardcoded time options, never reachable — no caller passed the prop) was removed from `composer.tsx` rather than left as unreachable code. A real version needs a DB model (`ScheduledMessage` or similar) and a delivery worker; this was already a known backlog item from the September voice/scheduling brief.
- **DM end-to-end encryption.** The Channels & DMs tab's "Direct Message E2EE" control is now an honest disabled switch with "Coming soon" copy. No E2EE toggle infrastructure exists anywhere in the codebase (Matrix DM rooms are encrypted by default at the transport level, but there's no per-workspace policy layer for it).
- **DM/Group-DM settings have no server-side home.** `use-dm-preferences.ts` (favorites/mutes) is still a client-only, localStorage-persisted zustand store, explicitly documented in that file as "when DMs grow a server-side record, swap this store." Out of scope here — DMs have no Postgres model at all (pure Matrix rooms).

## Deferred — real settings-page tabs left on the old local-only store

Per the plan's scoping, only the tabs with clearly fake/dead controls (channels, ai-persona, agent-marketplace, integrations, billing, danger) were fixed. These tabs in `workspace-settings-page.tsx` still use `useWorkspacePreference` (client-only, per-workspace localStorage, no server API) and were out of scope for this pass:

- `automations` (Workflow Automations config), `schedule` (Schedule & Meetings prefs), `pulse` (Activity Feed prefs), `documents` (Notes & Documents editor prefs), `files` (Files & Storage prefs)
- The `general`/`preferences` tab's `homeView`, `displayNamePref`, `firstDay`, `convertEmojis`, `sendShortcut`, `fontSize` (fontSize is the one exception — it already has a live client effect via `useApplyWorkspacePreferences`)
- `notifyDigest`, `notifyDesktopPush`, `notifyChannelScope` (the real per-category notification routing already lives in `NotificationDisplaySettingsPanel`/`NotificationsService`; these three are a separate, still-fake set in the general tab)
- `docAutoSave`, `grammarAssistance`, `codeSyntaxTheme`, `highQualityVideo`, `fileRetention`, `googleCalendarSync`, `meetingProvider`, `autoRecordMeetings`, `trackOnlineStatus`, `trackCommitsInPulse`, `githubPRWebhook`, `channelTrigger`, `maxConcurrentRuns`, `retryFailedSteps`, `timeFormatPref`, `dateFormatPref`, `workStartHour`, `workEndHour`, `workdays`

None of these were touched — they behave exactly as before (persist per-device via `localStorage`, no server enforcement). Each would need the same treatment as the channels/ai-persona tabs: identify whether real backing functionality exists to connect to, and either wire it or mark it "Coming soon" instead of a working-looking control.

## Deferred — frontend polish on the new backend enforcement

`whoCanCreateAgents`/`whoCanCreateCoworkers`/`whoCanInstallApps` are now enforced server-side (a 403 with a clear message on an unauthorized create/connect), and the Integration Hub's Connect button is gated client-side. The equivalent frontend gating (hiding/disabling the "Create Agent" and "New Coworker" trigger buttons for members without permission) was **not** added to `AgentBuilderView` / `CoworkerCreateDialog` / their directory entry points — an unauthorized member currently discovers the restriction via an error toast on submit rather than a disabled button up front. Not a security gap (the server is the real gate), but a UX rough edge worth closing.

## Deferred — deeper capability system

- Per-tool/per-capability granular toggles for agents and coworkers beyond today's `allowedActions` checklist (e.g. a workspace-wide "agents may not access the filesystem" policy) were not added — `whoCanCreateAgents`/`whoCanCreateCoworkers` gate *creation*, not runtime tool access.
- `ChannelIntegration.isEnabled` / `ChannelAgent.isEnabled` / `ChannelCoworker.isEnabled` were checked (per the plan's Phase D) — no gap was found: these already gate channel-room responses server-side via `AgentMatrixBridgeService`/the Matrix bridge, and don't apply to the 1:1 DM-style `AppChatView`/`AgentChatView`/`CoworkerChatView` surfaces (which aren't channel-scoped). No change was needed there.
- Non-English i18n of all new copy (new Settings rows, error messages, "Coming soon" labels) — written in English only, matching the surrounding untranslated copy in the same files.
- Full manual mobile QA pass — the new UI reuses existing responsive primitives (`SettingsRow`/`SettingsCard`/`Select`/`Switch`) and should inherit their mobile behavior, but was not independently clicked through on a small viewport.

## A note on "migrating" old local preferences

The plan considered migrating stale `localStorage` values (e.g. a member's old local `allowPublicCreation` toggle) into the new real workspace-wide policy on first load. This was deliberately **not** done: those old values were per-device, never had multi-user consistency, and silently promoting one member's stale local click into a real workspace-wide policy write would be a correctness regression, not a safety net. The old keys are simply orphaned in `localStorage` now — harmless, since nothing reads them anymore.
