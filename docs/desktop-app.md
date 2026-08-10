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
│   ├── ipc.ts              every renderer-callable handler
│   ├── tray.ts             tray icon and its menu
│   ├── menu.ts             application menu + accelerators
│   ├── deep-link.ts        `onetab://` parsing and replay
│   ├── static-server.ts    serves the built web bundle in packaged builds
│   ├── store.ts            JSON prefs/window state in userData
│   └── updater.ts          optional `electron-updater` wiring
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

`nx serve` points Electron at `http://localhost:4200`, so HMR works exactly as it
does in the browser. Set `WEB_APP_URL` to aim it somewhere else. If Electron wins
the race against Vite's first compile it retries the load once a second for a
minute rather than showing a connection error.

If Electron itself is missing (`npm`'s postinstall download can be skipped),
`npm rebuild electron` fetches the binary.

### Two environment traps, both already worked around

Both bite only on a developer machine, never in CI or a packaged build, and both
are handled by a launcher script rather than left for the next person to
rediscover:

- **`ELECTRON_RUN_AS_NODE=1`** — VS Code, Cursor and Windsurf export it into
  their integrated terminals, and it makes any Electron binary run as plain
  Node: no window, and the app dies on `app.isPackaged` being undefined.
  `scripts/run-electron.mjs` deletes the variable before spawning. Electron
  tests for its *presence*, so setting it empty does not help.
- **Windows drive-letter case** — Nx invokes tasks with `d:\…` where a shell
  gives `D:\…`, and Vitest keys its module registry by absolute path, so every
  spec fails to collect before a test body runs. `scripts/run-tests.mjs` spawns
  Vitest from `realpathSync.native()`, the canonical spelling.

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
| **Refresh cookie in production** | ⚠️ **Breaks** — see below | Needs a server-side change before the first production release |
| **CORS in production** | ⚠️ **Breaks** until configured | Add the desktop origin to `CORS_ORIGINS` |
| `window.open` / target=`_blank` | Blocked by the navigation policy | Routed through `openExternal()` → system browser |
| External links in message content | Would navigate the whole app window | `will-navigate` sends off-origin URLs to the system browser |
| `navigator.clipboard` | Needs a secure context and a permission prompt | `copyText()` uses the native clipboard in the shell |
| Web `Notification` API | Only fires while the window is alive | `notify()` uses OS notifications, which survive a hidden window and can carry a route to open on click |
| Downloads via `<a download>` | No "Save as…", lands in the default folder | `saveFile()` opens a real save dialog and writes the file |
| Camera / microphone | ❌ **Denied** | Only `notifications`, `clipboard-sanitized-write` and `fullscreen` are allowed; add `media` to the allowlist in `main.ts` when voice input actually ships |
| `<webview>` / nested frames | ❌ Denied | `will-attach-webview` is blocked; nothing in the app uses it |
| Multiple windows | ❌ Not supported | Single-window by design; a second launch focuses the running one |
| PWA install / service worker | N/A | The app uses neither |
| Invite links in email (`https://…/invite/x`) | Opens the browser, not the app | Register `onetab://invite/<token>` in the email template to hand the link to the desktop app |
| Matrix E2EE (WASM + IndexedDB) | ✅ Works | The static server serves `.wasm` as `application/wasm`; do not add a CSP without `wasm-unsafe-eval` |
| Drag-and-drop upload, `<input type="file">` | ✅ Works unchanged | Electron opens the OS dialog natively |
| Theme, layout, all feature screens | ✅ Work unchanged | Same bundle, same code paths |

### The production cookie problem, in detail

`libs/api/auth/src/lib/auth.controller.ts` sets the refresh cookie with
`sameSite: isProduction ? 'strict' : 'lax'`.

- **In development this is fine.** The desktop renderer is on `localhost:4200`
  and the API on `localhost:3000` — same site, so the cookie is sent.
- **In production it is not.** The renderer is still on `localhost`, but the API
  is on a real domain. `SameSite=strict` means the cookie never leaves the
  browser, `POST /auth/refresh` returns 401, and the session dies as soon as the
  in-memory access token expires. (`useSessionBootstrap` keeps the user signed in
  from `localStorage` until then, so the failure shows up as a surprise logout
  rather than an immediate one.)

Pick one before shipping a production desktop build:

1. `sameSite: 'none', secure: true` for the refresh cookie. Simplest, and the
   cookie is httpOnly either way — but it relaxes the policy for the web app too.
2. Return the refresh token in the body for the desktop client only and store it
   through `preferences.set()` in the shell, sending it as a header. Keeps the
   web policy strict at the cost of a second code path.

This is deliberately **not** changed here: it is an auth-policy decision, not a
packaging detail.

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
  DesktopChrome, DesktopTitleBar, DesktopUpdateBanner, DesktopSettingsCard,
  PlatformNotice,
} from '@org/web-desktop';
```

- `DesktopChrome` wraps the whole app in `providers.tsx`: title bar, update
  strip, then routed content. It renders in the browser too (with both bars
  `null`) so screens size themselves identically on both platforms.
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

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`. The preload therefore imports nothing but `electron` —
  a sandboxed preload cannot `require` a relative file.
- Every IPC handler checks the sender is the main window's `webContents`.
- `openExternal` accepts only `http(s):` and `mailto:`; handing an arbitrary
  scheme to the OS is a code-execution vector.
- Permissions are default-deny and same-origin only.
- The renderer cannot open windows or navigate off-origin.

## Packaging notes

- `apps/desktop/electron-builder.json` copies `apps/web/dist` into the bundle as
  `resources/web`, which is where `resolveAppUrl()` looks.
- Icons in `apps/desktop/resources/` are generated placeholders
  (`node apps/desktop/scripts/make-icons.mjs`) — replace `icon.png` with real
  artwork before a release.
- Auto-update is wired but inert: install `electron-updater` and publish a feed
  to turn it on. Without it, `updates.check()` reports `not-available` instead of
  throwing.
- macOS builds need signing and notarisation; the entitlements file is already in
  `resources/entitlements.mac.plist`.
