# Desktop app (`@org/desktop`)

The desktop app is an Electron shell around the **same** `@org/web` build — there
is no second UI codebase. The shell adds what a browser tab cannot do (tray,
native notifications, deep links, a real save dialog, auto-update) and the web
app reaches those through `@org/web-desktop`, which feature-detects the bridge
and falls back to a browser equivalent when it is absent.

```text
apps/desktop/src
├── main.ts                 app entry: single instance, session policy, bootstrap
├── main/
│   ├── window.ts           frameless window, bounds persistence, navigation policy
│   ├── context-menu.ts     right-click menu: spelling fixes, links, images, editing
│   ├── config.ts           the three URLs: renderer origin, API, public web app
│   ├── permissions.ts      default-deny renderer permissions (mic/camera for calls)
│   ├── display-media.ts    screen-share requests → renderer picker → chosen source
│   ├── tray-policy.ts      close-to-tray default and the one-time hint
│   ├── ipc.ts              every renderer-callable handler
│   ├── tray.ts             tray icon and its menu
│   ├── menu.ts             application menu + accelerators
│   ├── deep-link.ts        `onetab://` parsing and replay
│   ├── static-server.ts    serves the built web bundle in packaged builds
│   ├── store.ts            JSON prefs/window state in userData
│   └── updater.ts          API update check + `electron-updater` when a feed is set
├── preload.ts              the contextBridge surface (`window.onetabDesktop`)
└── shared/ipc.ts           channel names + payload types (main + preload)
```

## Running it

```bash
npm run dev:desktop      # API + Vite + Electron together
nx serve @org/desktop    # Electron alone, against an already-running Vite
nx build @org/desktop    # compile the main process to apps/desktop/dist
nx test  @org/desktop    # unit tests for the static server and deep links
nx package @org/desktop  # electron-builder installers into apps/desktop/release
```

If `bootstrap()` throws — a missing web bundle, no free port in 4200–4209 — the
app shows a native error dialog and appends the stack to
`<userData>/startup-error.log` (`%APPDATA%\Onetab AI\` on Windows). A packaged
build has no console, so without that a startup failure is indistinguishable
from the app not launching at all.

`nx serve` points Electron at `http://localhost:4200`, so HMR works exactly as it
does in the browser. Set `WEB_APP_URL` to aim it somewhere else. If Electron wins
the race against Vite's first compile it retries the load once a second for a
minute rather than showing a connection error.

If Electron itself is missing (`npm`'s postinstall download can be skipped),
`npm rebuild electron` fetches the binary.

### Two environment traps, both already worked around

Both bite only on a developer machine, never in CI, and both are handled by a
launcher script rather than left for the next person to rediscover:

- **`ELECTRON_RUN_AS_NODE=1`** — VS Code, Cursor and Windsurf export it into
  their integrated terminals, and it makes any Electron binary run as plain
  Node: no window, and the app dies on `app.isPackaged` being undefined.
  `scripts/run-electron.mjs` deletes the variable before spawning. Electron
  tests for its *presence*, so setting it empty does not help.

  This catches the **packaged** app too, and there it has no launcher script to
  protect it: run `release/win-unpacked/Onetab AI.exe` from one of those
  terminals and it exits in under 100 ms with no window and nothing logged,
  because `main.js` throws on `require('electron')` before a single line of ours
  runs. Nothing is wrong with the build — launch it from the Start menu, a
  shortcut, or `env -u ELECTRON_RUN_AS_NODE ./'Onetab AI.exe'`.
- **Windows drive-letter case** — Nx invokes tasks with `d:\…` where a shell
  gives `D:\…`, and Vitest keys its module registry by absolute path, so every
  spec fails to collect before a test body runs. Every project's `test` target
  runs through the workspace-wide `scripts/run-vitest.mjs`, which spawns
  Vitest from `realpathSync.native()`, the canonical spelling — not a
  desktop-specific script.

## Four URLs, four different jobs

The shell juggles four URLs and `main/config.ts` keeps them apart — mixing them
up is how a packaged build ends up signing in against the user's own machine.

| URL | Used for | Dev | Packaged |
| --- | --- | --- | --- |
| `appUrl` | where the renderer loads from | Vite, `localhost:4200` | the internal static server |
| `apiUrl` | the main process's own API calls: sign-in code exchange, token refresh, update check, background notifications, agent execute | `VITE_API_URL`, else `http://localhost:3000/api/v1` | `desktop-config.json`, else the same default (logged as a warning) |
| `webUrl` | what the **system browser** is sent to: sign-in, "open in browser" | `appUrl` | `desktop-config.json`, else `appUrl` |
| `updateUrl` | the folder holding `latest.yml` + the installer, for in-app update install | unused (dev never self-updates) | `desktop-config.json`; optional — without it "Update now" opens the installer page instead |

Precedence is environment (`ONETAB_API_URL` / `VITE_API_URL`, `ONETAB_WEB_URL`, `ONETAB_UPDATE_URL`) →
`resources/desktop-config.json` → default. The web bundle already has the API URL
compiled in, but the main process never sees a Vite env, so `nx package` runs
`scripts/write-config.mjs` first and bakes them in:

```bash
VITE_API_URL=https://api.example.com/api/v1 \nONETAB_WEB_URL=https://app.example.com \nONETAB_UPDATE_URL=https://downloads.example.com/desktop \nnx package @org/desktop
```

A relative `VITE_API_URL` (the dev-proxy form `/api/v1`) is ignored there, and a stale
file from a previous package is removed so a local build cannot ship another
environment's endpoints. The resolved origins are logged at startup (`[Config]`).

## Why the packaged app serves over localhost

A packaged build starts a tiny HTTP server on `localhost:4200–4209` and loads the
UI from there instead of `file://`. Three things break otherwise:

- **Routing** — history-mode URLs 404 on reload under `file://`.
- **Storage** — `localStorage` is scoped to an opaque origin, so the theme and
  the cached session are lost on every launch.
- **Auth** — the refresh token is an httpOnly `SameSite` cookie, and no browser
  attaches those to requests from a `file://` or custom-scheme page.

The port range deliberately matches the API's dev CORS allowlist, so a local API
needs no configuration change. The server binds by the name `localhost` rather
than to `127.0.0.1`: on Windows the name resolves to `::1` first, so an
IPv4-only bind would leave the renderer unable to reach a server that reports
itself as `http://localhost:<port>`, and the free-port probe would miss an
IPv6-only listener and hand back a port something else is already using.

## What does *not* work the same as in a browser

| Area | Status in the desktop app | What was done |
| --- | --- | --- |
| **Session refresh in production** | ✅ **Handled** | The renderer never depends on the browser refresh cookie in the shell — `use-auth.ts` registers a `refreshTokenProvider` that routes `/auth/refresh` through the main process's own `fetch` (manual `Cookie:` header, disk-persisted rotated token). See "Session refresh in the shell" below. |
| **CORS in production** | ✅ **Configured** | Desktop shell origins `http://localhost:4200–4209` included automatically |
| `window.open` / target=`_blank` | Blocked by the navigation policy | Routed through `openExternal()` → system browser |
| External links in message content | Would navigate the whole app window | `will-navigate` sends off-origin URLs to the system browser |
| `navigator.clipboard` | Needs a secure context and a permission prompt | `copyText()` uses the native clipboard in the shell |
| Web `Notification` API | Only fires while the window is alive | `notify()` uses OS notifications, which survive a hidden window and can carry a route to open on click |
| Downloads via `<a download>` | No "Save as…", lands in the default folder | `saveFile()` opens a real save dialog and writes the file |
| Camera / microphone | ✅ **Allowed** | Voice messages, huddles and calls use `getUserMedia`, so `media` (and `speaker-selection` for the device picker) is allowed for the app's own page — see `permissions.ts`. macOS additionally needs the usage strings and entitlements already in `electron-builder.json` / `entitlements.mac.plist`, and the main process asks for OS access before answering. Screen sharing (`display-capture`) is allowed the same way, and Electron has no built-in "choose what to share" sheet, so `display-media.ts` forwards the request to `ScreenSharePicker` (in `DesktopChrome`) and matches the answer back — only to a source it actually offered, cancelled after a minute. macOS 15+ uses the system picker; older macOS needs Screen Recording permission, which the picker explains and links to. |
| `<webview>` / nested frames | ❌ Denied | `will-attach-webview` is blocked; nothing in the app uses it |
| Multiple windows | ❌ Not supported | Single-window by design; a second launch focuses the running one |
| Closing the window | ✅ **Keeps running** on Windows and macOS | Closing hides the window into the tray so notifications keep arriving; the first time, a notification says so. Linux stays opt-in (many desktops have no tray). Settings → "Keep running in background" and the tray menu change it. Quit from the tray, the app menu or the updater; a Windows shutdown is never blocked (`session-end`). Defaults live in `tray-policy.ts`. |
| PWA install / service worker | N/A | The app uses neither |
| Invite links in email (`https://…/invite/x`) | Opens the browser, not the app | Register `onetab://invite/<token>` in the email template to hand the link to the desktop app |
| Matrix E2EE (WASM + IndexedDB) | ✅ Works | The static server serves `.wasm` as `application/wasm`; do not add a CSP without `wasm-unsafe-eval` |
| Drag-and-drop upload, `<input type="file">` | ✅ Works unchanged | Electron opens the OS dialog natively |
| Theme, layout, all feature screens | ✅ Work unchanged | Same bundle, same code paths |

### Session refresh in the shell

`libs/api/auth/src/lib/auth.controller.ts` sets the refresh cookie with
`sameSite: isProduction ? 'strict' : 'lax'`. In a **production** packaged build
the renderer is on `localhost` and the API on a real domain, so a browser would
never attach a `SameSite=strict` cookie to `POST /auth/refresh`.

The shell does not rely on that cookie. Two paths cover refresh:

1. **The renderer** — `libs/web/auth/src/lib/use-auth.ts` registers a
   `setRefreshTokenProvider(...)` at module scope when `getDesktopApi()` is
   present. The shared axios interceptor's 401 → refresh path then calls
   `window.onetabDesktop.auth.refreshSession()` instead of hitting
   `/auth/refresh` with a cookie.
2. **The main process** — `apps/desktop/src/main/auth.ts` `refreshSecureSession()`
   `POST`s `/auth/refresh` with the rotated refresh token it persisted to disk
   (from `/auth/desktop/exchange`) set as an explicit `Cookie:` header, captures
   the rotated value out of `Set-Cookie`, and re-persists it. `sameSite` is a
   browser concept and does not apply to a header the main process sets itself.

So the API's `sameSite: 'strict'` production policy is left as-is — relaxing it
to `'none'` would weaken CSRF protection on the refresh endpoint for no benefit
to the shell. Both the refresh token and the (short-lived) access token are
encrypted at rest via `safeStorage` (DPAPI / Keychain / libsecret); the on-disk
`onetab-auth-session.json` holds no plaintext token.

### Sign-in happens in the browser only

The shell has **no sign-in or sign-up form**. `/login` and `/register` render
`DesktopBrowserSignIn` (`@org/auth`) when `isDesktop`: "Continue in Browser"
(plus the existing phone-pairing QR as a second path). Every method — password,
magic link, SSO, 2FA — lives once, in the web app, in the user's own browser.

```text
DesktopBrowserSignIn ──startBrowserLogin(intent)──▶ main: PKCE pair + 10 min timer
        ▲                                              │ shell.openExternal(/login|/register?desktop=true&state&code_challenge)
        │ auth flow-status events                      ▼
        │ waiting · success · cancelled ·         browser LoginPage / RegisterPage
        │ expired · timeout · error                    │ session exists → POST /auth/desktop/authorize (single-flight)
        │                                              ▼
main: handleAuthCallback ◀── onetab://auth/callback?code&state   (or ?error=cancelled&state)
        │ POST /auth/desktop/exchange → safeStorage session → authSessionChanged
```

- The browser tab's last screen is `DesktopHandoffPanel`; its button re-sends the
  *same* callback URL if the "Open Onetab AI?" prompt was dismissed.
- `/auth/callback` deep links are handled in the main process and never
  forwarded to the renderer (replaying them there would bounce back to
  `onetab://`).
- A duplicate callback within 30 s of a success is ignored rather than reported
  as expired. Specs: `apps/desktop/src/main/auth-flow.spec.ts`.

### Browser-only surfaces

AI Agent Studio and the Admin console are separate browser apps and are not in
the desktop bundle (`electron-builder.json` packs only `apps/web/dist`). They are
declared `platforms: ['web']` in `FEATURE_REGISTRY` (`agentStudio`,
`adminConsole`); the web app's `/w/:slug/agent-studio` entry point opens the
system browser on desktop instead of navigating the app window.

### Production CORS

`getCorsOrigins()` only auto-allows `localhost:4200–4209` outside production.
A packaged app talking to a production API needs its origin listed explicitly:

```dotenv
CORS_ORIGINS=https://app.example.com,http://localhost:4200
```

## The renderer bridge (`@org/web-desktop`)

Import it from anywhere in the web app — it is safe in the browser.

```tsx
import {
  isDesktop, openExternal, copyText, notify, saveFile, pickFiles,
  useDesktop, useDesktopCommand, useDesktopBadge, useDesktopPreference,
  DesktopChrome, DesktopTitleBar, DesktopUpdateIndicator, DesktopSettingsCard,
  PlatformNotice,
} from '@org/web-desktop';
```

- `DesktopChrome` wraps the whole app in `providers.tsx`: a bare title-bar
  drag strip (no app name — the workspace name and every action already live
  in `AppHeader`), then routed content. It renders in the browser too (with
  the title bar `null`) so screens size themselves identically on both
  platforms.
- `DesktopUpdateIndicator` is the app-update control: a compact nudge that
  `AppHeader` docks next to the profile menu, not a banner claiming a row of
  its own. It renders nothing outside the `downloading`/`available`/`ready`/
  `error` states; `DesktopSettingsCard` carries the full detail (version,
  manual "Check for updates").
- `useDesktopCommand('open-search', fn)` receives menu items, tray items and the
  global `Ctrl/Cmd+Shift+Space` shortcut. `AppShell` wires the six current ones.
- `PlatformNotice` states a capability gap in the UI instead of leaving a control
  that quietly does nothing.

Adding a capability means touching three files, in this order:
`apps/desktop/src/shared/ipc.ts` (channel + payload) →
`apps/desktop/src/main/ipc.ts` (handler) →
`apps/desktop/src/preload.ts` (expose it) → then mirror the signature in
`libs/web/desktop/src/lib/desktop-api.ts`. The preload pins its channel names to
the contract with `satisfies`, so a rename that misses a file fails to compile.

## Capability, feature & policy layer (`@org/platform`)

`DesktopCapabilities` (above) answers "what can this runtime do". A second
question — "should this feature be shown, and if not, what happens instead" —
is answered by `@org/platform` (`libs/shared/platform`), a small,
Electron-agnostic engine, plus the hooks in `@org/web-desktop` that feed it a
live snapshot. See `DESKTOP_STORE_COMPLIANCE_AUDIT.md` for the audit this was
built from and what it deliberately does not cover yet (Store packaging,
signing, a remote config backend).

```tsx
import { useFeature, FeatureRoute, featureManager } from '@org/web-desktop';

const update = useFeature('appUpdates');
if (update.state === 'STORE_RESTRICTED') {
  // update.reason: "Updates are managed by the store this build was installed from."
}

// Outside the component tree (menu handlers, route loaders):
featureManager.evaluate('deepLinks'); // → { state: 'AVAILABLE' | ..., reason, fallback }
```

- **`FEATURE_REGISTRY`** (`@org/platform`) declares what each feature needs —
  `platforms`, `requiredCapabilities`, `permissionCapabilities`, an optional
  `requiredPlan` (inert; there is no real billing backend — see the audit
  doc §5), and a `degrade` strategy (`hidden` | `disabled` | `web_only` |
  `external`) for when a required capability is missing.
- **`evaluate(id, snapshot)`** resolves one of ten `FeatureState` values —
  `AVAILABLE`, `DISABLED`, `HIDDEN`, `WEB_ONLY`, `EXTERNAL`,
  `REQUIRES_PERMISSION`, `REQUIRES_PLAN`, `STORE_RESTRICTED`,
  `OS_UNSUPPORTED`, `COMING_SOON` — checked in a fixed precedence documented
  on `evaluateFeature` in `libs/shared/platform/src/lib/feature-manager.ts`.
- **`policies/{apple-direct,apple-app-store,microsoft-direct,microsoft-store,
  linux,web}.ts`** are the only place a Store/platform restriction is allowed
  to live — never inline in a component. `resolvePolicy(platform,
  distribution)` pairs the two because `'direct'` means something different
  on Windows than on macOS.
- **`useFeature`/`useAllFeatures`/`usePlatform`/`useDistribution`/
  `useCapability`** (`@org/web-desktop`) recompute from
  `toPlatformSnapshot(useCapabilities())` on every capability change.
  `featureManager.evaluate`/`evaluateAll` are the same thing outside React.
- **`FeatureRoute`** wraps a route: `HIDDEN`/`OS_UNSUPPORTED` redirects home,
  a `WEB_ONLY` state with a web fallback redirects there, anything else
  unavailable renders the reason instead of the route's children.
- **Settings → Platform & Features** (inside `DesktopSettingsCard`) groups
  every user-facing feature into Available / Limited / Web-only from
  `useAllFeatures()` — nothing hardcoded per platform.
- **`/dev/platform-diagnostics`** (linked only by `PlatformDiagnosticsLink`,
  both gated on `import.meta.env.DEV`) dumps platform, runtime, distribution,
  every capability, and every feature's resolved state and reason.

Adding a new feature means adding one entry to `FEATURE_REGISTRY` — never a
new `if (isWindows)`/`if (isMacAppStore)` check at the call site.

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`. The preload therefore imports nothing but `electron` —
  a sandboxed preload cannot `require` a relative file.
- Every IPC handler checks the sender is the main window's `webContents`.
- `openExternal` accepts only `http(s):` and `mailto:`; handing an arbitrary
  scheme to the OS is a code-execution vector.
- Permissions are default-deny and same-origin only (`permissions.ts`): notifications
  and clipboard writes need the asking frame to be the app; mic/camera are judged on
  the page, so the embedded call frame works while any other origin gets nothing.
- The renderer cannot open windows or navigate off-origin.

## Packaging notes

- `apps/desktop/electron-builder.json` copies `apps/web/dist` into the bundle as
  `resources/web`, which is where `resolveAppUrl()` looks. Installers land in
  `apps/desktop/release/`, which is gitignored.
- **The app is `apps/desktop`, not the repo root** (`directories.app`). electron-builder
  runs from the workspace root, and left to itself it reads the *root* `package.json` as
  the app manifest — no `main`, version `0.0.0`, and every Nest/Prisma/React dependency
  of the monorepo as a runtime dependency of the shell. Pointing it at `apps/desktop`
  gives the asar the desktop workspace's own manifest (`main`, and a `dependencies` of
  just `electron-updater`); `extraMetadata` supplies `productName`, `author` and the
  rest. `files` patterns are relative to that folder.
- **`electronDist` points at `node_modules/electron/dist`.** The packaged
  Electron is then by construction the same build as the pinned `electron`
  devDependency, and packaging neither re-downloads a second 225 MB copy nor
  extracts one — which on Windows is also what avoids `EPERM: rename
  win-unpacked.tmp → win-unpacked`, where the on-access virus scanner still
  holds the freshly written `electron.exe` when electron-builder renames the
  directory.
- **`files` lists the compiled output file by file** rather than
  `apps/desktop/dist/**/*`. A glob over the whole directory sweeps in anything
  else that has ever been written there — Nx caches `dist` as a build output, so
  one stray directory stays in the cache and is restored into every later build.
  That is how a 214 KB `app.asar` once shipped as 364 MB.
- **`node_modules` is whatever `apps/desktop/package.json` depends on, and nothing else.**
  That is `electron-updater` and its small closure (the asar is ~1.4 MB). Do not try to
  allow-list packages with `files` patterns: for `node_modules` electron-builder honours
  only the `!` exclusions, so a `!node_modules/**/*` followed by re-includes silently
  ships *none* of them — which is exactly how `electron-updater` was missing from the
  package until this was checked against a real build. Add a runtime dependency to
  `apps/desktop/package.json` and it ships; keep the main process's imports to
  `electron`, Node built-ins and those.
- Icons in `apps/desktop/resources/` are generated placeholders
  (`node apps/desktop/scripts/make-icons.mjs`) — replace `icon.png` with real
  artwork before a release.
- **Updates.** The check goes to the API (`/app-versions/check-update`), which also
  carries the mandatory/minimum-version rules. What "Update now" does depends on the
  build: with `ONETAB_UPDATE_URL` set, `electron-updater` (a runtime dependency) reads
  `latest.yml` from that folder, downloads on request and installs on restart; without
  it — or if that download fails — the installer's page opens in the browser and the
  dialog says so, so the button is never a no-op. Store builds (MAS / Microsoft Store)
  skip all of this. To publish a release, upload `release/latest.yml`, the installer
  and its `.blockmap` to the update folder. `electron-builder` is a declared
  devDependency, so `nx package` works from a clean install. electron-updater can
  *check* a feed it was given at runtime but will not *download* without
  `app-update.yml` beside the asar (it takes its cache folder name from it), so
  `write-config.mjs` writes one when `ONETAB_UPDATE_URL` is set and `extraResources`
  ships it. The whole path — check, download with checksum verification, `ready`, and
  the installer-page fallback — was exercised against a packaged build and a mock feed.
- macOS builds need signing and notarisation; the entitlements file is already in
  `resources/entitlements.mac.plist`.
