# Matrix/Element Feature Audit & Avatar Fix — 2026-09-09

**Repository:** `D:\Onetab-AI\onetab-ai` · **Branch:** `main`
**Builds on:** `PLATFORM_AUDIT_2026-09-07.md` (2 days old, still current) — that
audit's feature matrix (Messaging/DMs/Threads/Reactions/Mentions/
Notifications/Search all "Working") is not re-litigated here. This pass is
scoped to the one thing that audit didn't catch: a rendering-layer bug, not a
wiring gap, so it never showed up in an architecture-level pass.

## Summary

The reported "avatars are broken" bug had one root cause, and it wasn't
avatar-specific: **every image/video/audio sourced from Matrix — not just
avatars — was silently failing to load.** Fixed without any DB/API/schema
change; 7 packages touched, all green (typecheck/lint/test, 34 affected
projects).

## Root cause

`packages/matrix-client`'s `resolveMediaUrl` (the app's single "Matrix media
door") correctly resolves every `mxc://` URL via
`client.mxcUrlToHttp(..., useAuthentication: true)` — the only way Matrix
offers to resolve media once a homeserver enforces **authenticated media**
(MSC3916, default on current Synapse). That produces a URL requiring an
`Authorization: Bearer <token>` header.

Nothing in the app ever attached that header. Every consumer — `@org/ui`'s
`AvatarImage` (so every `UserAvatar`/`WorkspaceAvatar` reading a Matrix
avatar), `@org/chat-ui`'s inline image/video/audio attachments, `@org/ui`'s
`MultiSelect` avatar chips, `@org/web-chat`'s conversation files panel, and
`@org/media-preview`'s lightbox/thumbnails/downloads — fed that URL straight
into a plain `<img src>` / `<video>` / `<audio>` / `fetch()`, none of which can
attach a custom header. The browser 401s, the `<img>` falls back to its
broken-image state, and every one of those surfaces reads as "avatar is
broken" (attachments and the media lightbox have the identical failure, just
less frequently noticed than an avatar that's on screen constantly).

The app's *own* avatars (the `User.avatarUrl` DB column — profile pages, the
member list from `/users`) were never affected; only avatars/media resolved
*through Matrix* were.

## Fix

Added one small, reusable primitive rather than patching each call site
independently — `useAuthenticatedMediaSrc` / `fetchAuthenticatedMediaBlob` in
`@org/hooks` (previously an unused stub package — first real use):

- Detects Matrix's authenticated-media URL shape; anything else passes
  through untouched (zero overhead for the app's own uploads, `data:`/`blob:`
  URIs).
- Fetches the authenticated ones with the current Matrix bearer token,
  caches the result as a `blob:` URL (module-level, capped + LRU-evicted, so
  the same room avatar rendering in the sidebar/message-list/member-panel at
  once triggers one fetch, not three).
- Returns `undefined` while unresolved or on failure, so every caller
  degrades to its existing loading/broken-image/initials state rather than a
  URL the browser would 401 on.

The fetcher itself is wired once, near the app root
(`AuthenticatedMediaBridge` in `@org/web-chat`, mounted in
`apps/web/src/app/providers.tsx` inside `<MatrixProvider>`) — the same
dependency-inversion seam `@org/ui`'s `AvatarPresenceProvider` already uses
for live presence, so `@org/hooks` and `@org/ui` stay ignorant of Matrix.
`OneTabMatrixClient` gained one new method, `getAccessToken()`, exposing
nothing it didn't already hold for its own `/sync` calls.

### Call sites fixed

| File | What was broken |
|---|---|
| `libs/shared/ui/.../avatar.tsx` (`AvatarImage`) | Every `UserAvatar`/`WorkspaceAvatar` reading a Matrix-sourced avatar — sender avatars, room/DM/channel avatars, member lists, profile cards, everywhere `@org/ui`'s avatar is used |
| `libs/shared/ui/.../multi-select.tsx` | Avatar chips in generic pickers (2 raw `<img>` bypasses of `AvatarImage`) |
| `libs/shared/chat-ui/.../attachments.tsx` | Inline image/video/audio message attachments and their thumbnails/posters |
| `libs/shared/chat-ui/.../markdown-message.tsx` | `![]()` images inside a message body |
| `libs/shared/chat-ui/.../cards/universal-card-renderer.tsx` | Image nodes in agent/app structured-response cards |
| `libs/web/chat/.../conversation-files-panel.tsx` | The DM/group/agent-chat "Shared in chat" media grid |
| `libs/shared/media-preview/.../media-thumbnail.tsx` | Small attachment thumbnails |
| `libs/shared/media-preview/.../media-preview-modal.tsx` | The full lightbox (image/video/audio/PDF/text viewers all key off its one resolved `url`) |
| `libs/shared/media-preview/.../download-media-item.ts` | The "Download" action's own `fetch()` |

### Files changed

- `packages/matrix-client/src/lib/matrix-client.ts` — `+getAccessToken()`
- `libs/shared/hooks/{package.json,vitest.config.mts,src/index.ts,src/lib/use-authenticated-media.{ts,spec.ts}}` — new primitive + test target (was a stub package)
- `libs/shared/ui/{package.json,src/lib/components/avatar.tsx,src/lib/components/multi-select.tsx}`
- `libs/shared/chat-ui/{package.json,src/lib/attachments.tsx,src/lib/markdown-message.tsx,src/lib/cards/universal-card-renderer.tsx}`
- `libs/shared/media-preview/{package.json,src/lib/media-thumbnail.tsx,src/lib/media-preview-modal.tsx,src/lib/download-media-item.ts}`
- `libs/web/chat/{package.json,src/index.ts,src/lib/authenticated-media-bridge.tsx (new),src/lib/conversation-files-panel.tsx}`
- `apps/web/src/app/providers.tsx` — mounts `AuthenticatedMediaBridge`
- `nx sync` updated the 4 touched libs' `tsconfig.lib.json` project references

No Prisma/schema/API changes — this was entirely a client-side rendering gap.

## Tests

- New: `libs/shared/hooks/src/lib/use-authenticated-media.spec.ts` (10 cases —
  passthrough, null/undefined, resolve-and-cache, no-fetcher fallback,
  failed-fetch fallback, single-flight dedup across concurrent consumers).
- `nx run-many -t typecheck lint test` on the 7 directly touched projects:
  green (0 errors; only pre-existing warnings untouched by this change).
- `nx affected -t typecheck lint test` (base HEAD): **34 projects, all
  green.**

## What this does *not* fix (follow-up)

- **"Open in new tab" / copy-link for Matrix media** still points at the
  authenticated URL — a bare browser navigation can't attach a bearer token
  either. Not touched this pass; a link that works this way needs a
  short-lived signed URL, the same mechanism the Files/Assets hub already
  uses for its own uploads (`PublicFileController`) — extending that to proxy
  Matrix media is the correct long-term fix and also gets Range-request video
  seeking for free (the blob-fetch approach here loads a whole video/audio
  file before playback can start).
- Everything else in the 30-item Matrix/Element brief this fix was requested
  alongside (rooms, DMs, threads, reactions, mentions, notifications,
  presence, search, AI agents, workspace isolation, etc.) was already
  verified **Working** by `PLATFORM_AUDIT_2026-09-07.md` two days prior; nothing
  in that matrix regressed (see the affected-project test run above). The
  only open items carried from that audit are A6 (channel-agent panel wiring),
  A7 (agent-builder graph persistence), A8 (S3 storage driver) and A9
  (compliance feature test coverage) — none avatar- or media-related.
