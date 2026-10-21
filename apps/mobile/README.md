# Onetab AI — mobile (Android & iOS)

Expo SDK 58 / React Native 0.88 app in the Nx workspace (`@org/mobile`). It is a
native client for the **existing** API: it imports `@org/api-client` and
`@org/types` directly, so every call, type and query key is the same one the web
app uses. There is no mobile-specific backend.

## Architecture

| Concern    | How                                                                                                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation | `expo-router` (file routes in `src/app`). `(auth)` and `(app)` group layouts redirect to `/sign-in` or `/` by session status. WhatsApp-inspired 4-tab bar (Chats, Agents, Updates, Settings) uses `expo-router/native-tabs` — the real UITabBar / Material 3 nav bar — and each tab owns a native stack (`(tabs)/<tab>/_layout.tsx`, iOS large titles, native header search on Chats). Shared stack options, keyboard offsets and haptics live in `components/navigation.tsx` and `lib/haptics.ts`. |
| API        | `@org/api-client` (axios). `setApiBaseURL()` points it at `EXPO_PUBLIC_API_URL`.                                                                                                                                                                                                                                                                   |
| Auth       | Password + TOTP 2FA via `/auth/login` and `/auth/login/2fa`. The refresh token lives in the iOS Keychain / Android Keystore (`expo-secure-store`, this-device-only) and is sent in the `/auth/refresh` body — the API already supports this for desktop. Access token is memory-only. Sign-out revokes the token server-side and unregisters push. |
| Biometrics | Optional Face ID / Touch ID / fingerprint unlock (`expo-local-authentication`), re-required after 60 s in the background; device passcode is the fallback.                                                                                                                                                                                         |
| Data       | `@tanstack/react-query` with `NetInfo` (pauses offline) and `AppState` (refetch on foreground). No background polling timers except live views (chat, running executions).                                                                                                                                                                         |
| Chat       | Matrix client-server REST (`src/lib/matrix.ts`) using the session from `POST /matrix/session`, stored in the keychain and reused. Read, send, attachments (camera/library/file), authenticated media, read markers.                                                                                                                                |
| Push       | `expo-notifications` → `POST /notifications/devices` (existing). The API's new `PushDeliveryService` sends every notification-centre row to registered Expo tokens, honouring the per-workspace push toggle and quiet hours, and revokes dead tokens. Taps deep-link into the matching screen and workspace.                                       |
| Files      | Native streaming upload to `POST /workspaces/:id/uploads` (same plan caps/validation as web); downloads go to the app cache and open the system share sheet.                                                                                                                                                                                       |
| Theme      | `src/theme/tokens.ts` mirrors `libs/shared/design-system/src/styles/theme.css`; follows the OS light/dark setting. Layouts cap at 760 px for tablets.                                                                                                                                                                                              |

### Why React is pinned here

React Native 0.88's renderer requires exactly `react@19.3.0`; the web apps run
19.2.8. The root `package.json` pins `react`/`react-dom` to `19.2.8` so npm nests
19.3.0 under `apps/mobile/node_modules`, and `metro.config.js` forces every
`react` import in the mobile bundle to that copy. `expo-doctor` reports this as a
"duplicate dependency"; that is expected (the bundle contains one React — checked
via the source map). Upgrade both together when the web moves to 19.3.

`metro.config.js` also resolves `@org/*` workspace packages to their real source
folder (npm creates junctions on Windows that Metro does not follow) and maps the
NodeNext-style `./file.js` imports in shared libs back to `.ts`.

## Feature coverage

| Area                   | On mobile                                                                                                         | Stays on web                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Agents                 | List, create, configure (name/role/instructions/welcome), activate/pause, run once, chat, run history, delete     | Graph/canvas editing, tools, knowledge, deployments                             |
| Automations            | List, create (manual/schedule/webhook), enable/disable, run now (confirmed), execution history                    | Step builder (opens the web builder)                                            |
| Executions & approvals | Live monitor with filters; pause/resume/cancel/retry; approve/reject with comment                                 | —                                                                               |
| Chats (WhatsApp UX)    | Channels, DMs, group DMs, AI coworkers; speech bubbles, delivery checkmarks, quote replies, floating reactions, multiline composer, in-chat message search, room info modal, filter chips (All, Unread, Direct, Channels, AI), pinned/muted/archived conversations, FAB | E2EE rooms (shown as placeholders, composer disabled), full emoji picker, edits |
| Updates                | Daily AI Catch-Up & attention briefing, pending approvals queue with 1-tap Approve/Reject, live workflow runs monitor | Workflow step builder (opens web builder)                                       |
| Settings               | Native profile card, workspace switcher, biometrics/security, notification toggles, storage/files, team, billing, sign out | Password/2FA setup, passkeys, OAuth sign-in                                     |
| Integrations           | All connectors with status, accounts, last sync/errors; Sync now; Disconnect                                      | Connecting (OAuth / credential forms)                                           |
| Dashboard & analytics  | AI usage, automation health, plan usage, workspace analytics (7/30/90 d), execution log                           | Custom reports, CSV export                                                      |
| Team                   | Members (search) and AI coworkers                                                                                 | Role changes, invites, removal                                                  |
| Billing                | Plan, subscription status, all usage limits, credit balance, invoices                                             | Any purchase or plan change (store rules — see below)                           |
| Account                | Profile edit, notification prefs, push device, biometric lock, active sessions, sign out, workspace switcher      | Password/2FA setup, passkeys, OAuth sign-in                                     |

## Setup

Prerequisites: Node 24, the repo installed with `npm install --legacy-peer-deps`
at the root, the API running and reachable from the phone.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

| Variable              | Required              | Purpose                                                                                                                                            |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | yes                   | API base incl. `/api/v1`. Use your LAN IP (`http://192.168.x.y:3000/api/v1`), `http://10.0.2.2:3000/api/v1` for the Android emulator, or a tunnel. |
| `EXPO_PUBLIC_WEB_URL` | yes                   | Web origin for "Open on web" links.                                                                                                                |
| `EAS_PROJECT_ID`      | for push & EAS builds | From `npx eas init`. Without it push registration is skipped (Settings says so).                                                                   |
| `EXPO_OWNER`          | optional              | Expo account/org owning the project.                                                                                                               |
| `APP_VARIANT`         | set by EAS            | `development` / `preview` / `production` → bundle id `ai.onetab.mobile[.dev\|.preview]`.                                                           |

API-side (server env, never in the app):

| Variable                      | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `EXPO_ACCESS_TOKEN`           | Only if "enhanced push security" is enabled for the Expo project. |
| `PUSH_DELIVERY_DISABLED=true` | Kill switch for mobile push delivery.                             |

The API's CORS settings do not apply to native apps; no API change is needed for
the phone to connect.

## Run

The app uses native modules (secure store, biometrics, notifications), so use a
**development build**, not Expo Go:

```bash
cd apps/mobile
npx eas build --profile development --platform android   # or ios / development-simulator
npm exec nx -- run @org/mobile:start                      # Metro for the dev client
```

With Android Studio / Xcode installed locally instead of EAS:

```bash
cd apps/mobile && npx expo run:android   # or: npx expo run:ios (macOS)
```

## Checks

```bash
npm exec nx -- run-many -t typecheck lint test -p @org/mobile
npm exec nx -- run @org/mobile:bundle      # Metro bundle for Android + iOS (Hermes)
cd apps/mobile && npx expo install --check
```

Unit tests (Vitest, Node) cover the platform-free logic: token refresh/rotation
rules, deep-link routing, the Matrix client and timeline mapping, formatting.

## Release

1. `npx eas login && npx eas init` (sets the project id → put it in `EAS_PROJECT_ID`).
2. Push credentials: `npx eas credentials` — upload an APNs key (iOS) and an FCM
   v1 service-account key (Android) to the Expo project.
3. Store builds: `npx eas build --profile production --platform all`
   (versions auto-increment remotely; Android builds an `.aab`).
4. Submit: `npx eas submit --profile production --platform android|ios`
   (needs a Play service-account JSON and App Store Connect API key, configured
   through `eas credentials` / the submit prompts — never committed).
5. Store listing needs: privacy policy URL, data-safety / privacy nutrition labels
   (account email, user content, device push token, crash-free usage), test
   account for review, screenshots for phone and tablet.

### Store-policy decisions baked in

- **No in-app purchasing or checkout links.** Billing is read-only on mobile;
  plan changes happen on the web by an admin (App Store 3.1.1 / Play payments).
- **Account creation** opens the web registration page; App Store 5.1.1(v)
  requires in-app account _deletion_ if sign-up is offered — confirm the web
  account-deletion path is linked from the store listing before submitting.
- Android blocks `RECORD_AUDIO` (never used) and, in production,
  `SYSTEM_ALERT_WINDOW` (RN debug overlay only).
- `ITSAppUsesNonExemptEncryption = false` (HTTPS/TLS only).

## Background work

The app does not run automations itself. Scheduled and webhook automations run
on the server (`@nestjs/schedule` crons), so they keep working while the phone is
locked or offline; the phone only gets notified via push. No background fetch is
registered.

## Web target

`npx expo start --web` (or the `mobile-web` entry in `.claude/launch.json`)
runs the same app in a browser through react-native-web. What differs:

- **Session:** the refresh token stays in the API's httpOnly `onetab_rt`
  cookie, exactly like the web app; only a non-secret "has a session" marker is
  stored. The cookie is `SameSite=lax` (strict in production), so the page and
  the API must be the same site — point `EXPO_PUBLIC_API_URL` at
  `http://localhost:3000/api/v1` for local web runs, not a tunnel URL. The API
  allows the Expo web dev origins (`localhost:8081–8083`) outside production.
- **Dialogs:** `src/lib/alert.ts` replaces `Alert` everywhere; on web it maps
  onto `alert` / `confirm` / a numbered `prompt` (react-native-web's `Alert` is
  a no-op). Import `Alert` from there, not from `react-native`.
- **Files:** uploads use `fetch` with the picked `Blob`; downloads save through
  the browser instead of the share sheet.
- **Authenticated media:** `Image` cannot send headers on web, so avatars and
  thumbnails load through `useAuthedImageSource` (cached `blob:` URLs).
- **Not available:** push notifications (no Expo push token in a browser — the
  in-app notification list still works) and the biometric lock.

## Known limitations

- Native builds and device runs were not executed in the environment this was
  built in (no Android SDK, Xcode or Expo account); JS bundles for both
  platforms, prebuild (Android) and config plugins were verified.
- Encrypted (E2EE) Matrix rooms are read-only placeholders on mobile; new DMs created here are unencrypted.
- Chat syncs with a long-poll `/sync` scoped to the open room while it is focused and the app is foregrounded; the DM list refreshes on focus/pull.
- Social sign-in (Google/Apple), passkeys and magic links are web-only for now.
- `assets/icon.png` is upscaled from the 512 px desktop icon; replace with a
  1024 px master before release.
