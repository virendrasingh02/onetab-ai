# DESKTOP_STORE_COMPLIANCE_AUDIT.md

**Repository:** `D:\Onetab-AI\onetab-ai` · **Date:** 2026-08-24
**Scope:** Desktop app store compliance & conditional feature system — the
audit required before any capability/feature/policy layer was written, plus a
record of what was subsequently built on top of it.
**Companion documents:** `PLATFORM_ARCHITECTURE.md`, `PLATFORM_AUDIT_REPORT.md`,
`PLATFORM_FEATURE_MATRIX.md` (broader platform audit, 2026-08-21),
`docs/desktop-app.md` (the desktop app's own living reference).

---

## 1. What existed before this pass

The desktop app was **not** starting from zero. Before any of the work below,
`apps/desktop` and `libs/web/desktop` already had:

- A sandboxed, `contextIsolation`-on Electron shell with a typed IPC bridge
  (`apps/desktop/src/shared/ipc.ts`), every handler sender-validated
  (`apps/desktop/src/main/ipc.ts`).
- PKCE browser-based login with `safeStorage`-encrypted session persistence
  (`apps/desktop/src/main/auth.ts`).
- Custom protocol deep links (`onetab://`, `mie://`) with argv/second-instance/
  macOS `open-url` handling and a validated parser (`apps/desktop/src/main/
  deep-link.ts`).
- `electron-updater` wiring already refusing to run under a Mac App Store
  build (`process.mas`/`IS_MAS`/`APP_STORE`) — `apps/desktop/src/main/
  updater.ts`.
- A renderer-side bridge (`@org/web-desktop`) with feature-detected fallbacks
  for every native call (notify, clipboard, save/pick file, badge), a
  `DesktopProvider` React context, a `FeatureGate` component, a static
  `FEATURE_MATRIX`, and a `PlatformNotice` component for stating capability
  gaps in the UI instead of leaving dead buttons.
- 33 passing unit tests across the desktop app and its bridge.

**What was missing** — the actual gap this pass closed — was entirely the
*distribution* dimension and a real state machine: there was no concept of
`microsoft-store` at all, `FEATURE_MATRIX` was static and read by nothing
(the audit report's "decorative — renders convincingly but does nothing"
pattern, found again here), and every Store restriction that did exist
(`isMas` gating updates) was duplicated three times across three files with
no central policy.

---

## 2. Feature compatibility matrix (from the code, not the brief)

| Feature | Native API / integration | Platforms | Distributions where it works | Runtime dependency | Requires OS permission | Fallback when unavailable |
| --- | --- | --- | --- | --- | --- | --- |
| Browser-based sign-in (PKCE) | `shell.openExternal` + deep-link callback | Windows, macOS, Linux, Web | All | Any | No | N/A — works everywhere already |
| Custom protocol deep links | `app.setAsDefaultProtocolClient`, `open-url`, argv parsing | Windows, macOS, Linux | direct, microsoft-store*, mac-app-store | Electron | No | Web URL navigation |
| OS desktop notifications | `Notification` (main) / Web `Notification` (browser) | Windows, macOS, Linux, Web | All | Any | Yes (OS permission) | In-app toast (already wired in `notify()`) |
| Automatic app updates | `electron-updater` (NSIS/DMG feed) | Windows, macOS, Linux | **direct only** | Electron | No | Store's own update mechanism |
| Launch at login | `app.setLoginItemSettings` | Windows, macOS | direct (see §4) | Electron | No | Manual launch |
| Encrypted credential storage | `safeStorage` (DPAPI/Keychain/libsecret) | Windows, macOS, Linux | All | Electron | No | Plain-text fallback already coded in `auth.ts` |
| Native file dialogs | `dialog.showOpenDialog`/`showSaveDialog` | Windows, macOS, Linux, Web | All | Any | No | HTML `<input type="file">` / anchor download (already wired) |
| Frameless window & custom title bar | `BrowserWindow({titleBarStyle:'hidden'})` | Windows, macOS, Linux | All | Electron | No | N/A — hidden on web |
| Single instance enforcement | `app.requestSingleInstanceLock` | Windows, macOS, Linux | All | Electron | No | N/A |
| System tray | `Tray`, context menu | Windows, macOS, Linux | All | Electron | No | N/A |
| Background execution (minimize to tray) | `window.hide()` on close | Windows, macOS, Linux | All | Electron | No | Full quit |
| Global shortcut (`Ctrl/Cmd+Shift+Space`) | `globalShortcut.register` | Windows, macOS, Linux | All | Electron | No, but can silently fail to register (already logged) |
| Shell/command execution | **None found.** No `child_process`, no arbitrary command execution anywhere in `apps/desktop`. | — | — | — | — | — |
| Arbitrary filesystem access | **None found.** Only `dialog`-mediated open/save and a JSON prefs file in `userData`; no general read/write API is exposed to the renderer. | — | — | — | — | — |
| Downloaded/side-loaded executable code | **None found.** The only network fetches from the main process are `fetch()` calls to the app's own API (`auth.ts`) and the updater's feed (electron-builder/electron-updater, config-only — no feed URL is currently published). | — | — | — | — | — |
| Payment flow | **None found in the desktop shell.** Billing is a client-side `useState` simulation in the shared web app (`libs/web/workspace/.../workspace-billing-settings.tsx`) — not a desktop concern, not connected to any store IAP. | — | — | — | — | — |

\* `microsoft-store` distribution does not exist as a real build yet (no
`appx` electron-builder target) — see §4.

**Not applicable / web-only-safe:** every other feature in the product
(chat, projects, tasks, docs, agents, workflows, etc.) is plain web content
running inside the same Electron `BrowserWindow` with no native dependency at
all — verified by `docs/desktop-app.md`'s own "What does *not* work the same
as in a browser" table, which lists everything that differs. Nothing outside
that table needs a platform check.

---

## 3. What was built on top of this

A new library, **`@org/platform`** (`libs/shared/platform`), framework- and
Electron-agnostic:

- `FEATURE_REGISTRY` — replaces `FEATURE_MATRIX` with the same feature ids,
  now carrying `requiredCapabilities`, `permissionCapabilities`,
  `requiredPlan` (inert — see §5), a `degrade` strategy, and a fallback.
- `evaluateFeature`/`evaluate`/`evaluateAll` — the state machine producing one
  of the ten `FeatureState` values (`AVAILABLE`, `DISABLED`, `HIDDEN`,
  `WEB_ONLY`, `EXTERNAL`, `REQUIRES_PERMISSION`, `REQUIRES_PLAN`,
  `STORE_RESTRICTED`, `OS_UNSUPPORTED`, `COMING_SOON`) with a `reason` and a
  `fallback`. 18 unit tests in `libs/shared/platform/src/lib/
  feature-manager.spec.ts` and `policies/index.spec.ts` cover the precedence
  order.
- `policies/{apple-direct,apple-app-store,microsoft-direct,microsoft-store,
  linux,web}.ts` — one `DistributionPolicy` per (platform, distribution) pair,
  each carrying its restriction list and a `notes` field explaining *why*.
  `resolvePolicy(platform, distribution)` is the only place that pairs the two
  (a bare `distribution` value is ambiguous — `'direct'` means something
  different on Windows vs. macOS).

`@org/web-desktop` now feeds this from the live bridge:

- `toPlatformSnapshot()` — the one seam between `DesktopCapabilities` and the
  generic `PlatformSnapshot` the engine evaluates against.
- `useFeature`, `useAllFeatures`, `usePlatform`, `useDistribution`,
  `useCapability` — hooks recomputing on every capability change.
- `featureManager.evaluate`/`evaluateAll` — the non-hook entry point for menu
  handlers and route loaders.
- `FeatureRoute` — route-level enforcement: `HIDDEN`/`OS_UNSUPPORTED` redirect
  home, `WEB_ONLY` with a web fallback redirects there, anything else
  unavailable renders `FeatureUnavailableNotice` with the reason instead of
  silently bouncing.
- `PlatformDiagnosticsPage` (`/dev/platform-diagnostics`, gated by
  `import.meta.env.DEV`, linked only from `PlatformDiagnosticsLink`) — every
  capability and every feature's resolved state and reason, for debugging a
  specific build/distribution combination.
- Settings → **Platform & Features** — the existing `DesktopSettingsCard` now
  groups every `uiRelevance: 'user-facing'` feature into Available / Limited
  / Web-only, driven entirely by `evaluateAll()` — no hardcoded per-platform
  list.
- The `isMas`-only checks in `apps/desktop/src/main/{capabilities,ipc,
  updater}.ts` (duplicated three times) were consolidated into
  `isMasBuild()`/`isWindowsStoreBuild()`/`detectDistribution()` in
  `capabilities.ts`, and a real (if untested end-to-end) Microsoft Store
  detection via Electron's own `process.windowsStore` was added alongside the
  existing Mac App Store one. `updater.ts` now refuses to self-update under
  either.

**Deliberately not built in this pass** (see §7 for the reasoning behind the
scope cut):

- A backend remote feature-configuration endpoint (§25 of the brief).
- An `appx`/MSIX electron-builder target, code signing, or Store submission
  metadata.
- A `npm run validate:store` build-time compliance CLI.
- An automated cross-distribution test matrix beyond the unit tests listed
  above.
- Wiring `requiredPlan` to a real entitlements check — there is no real
  billing backend to check against (see §5).

---

## 4. Known gaps that make a real Store submission premature

These are genuine blockers, recorded rather than silently worked around:

1. **No macOS App Sandbox entitlement.** `apps/desktop/resources/
   entitlements.mac.plist` declares `allow-jit`, `network.client`,
   `network.server`, and `files.user-selected.read-write` — but **not**
   `com.apple.security.app-sandbox`. Without it the app is not sandboxed at
   all, and Mac App Store submission requires it. `appleAppStorePolicy` in
   `@org/platform` restricts `autoLaunch` defensively for exactly this reason
   — its own `notes` field says so. Turning on the sandbox is real work
   (testing every native call still works under it) that was out of scope
   here.
2. **No `appx`/MSIX packaging target.** `apps/desktop/electron-builder.json`'s
   `win.target` is `["nsis"]` only. `microsoftStorePolicy` exists and is
   correct, but nothing can produce a build that would make Electron's
   `process.windowsStore` true to exercise it.
3. **No code signing configured** for either platform in
   `electron-builder.json` — required for both a Microsoft Store submission
   and macOS notarization (direct or Store).
4. **Production refresh-cookie `sameSite` policy** — already documented as an
   open decision in `docs/desktop-app.md` ("The production cookie problem, in
   detail"), unrelated to this pass but relevant to any real production
   desktop rollout.

---

## 5. `requiredPlan` is intentionally inert

`FeatureDefinition.requiredPlan` and the `REQUIRES_PLAN` state exist in
`@org/platform`, and `evaluateFeature` always treats a declared `requiredPlan`
as satisfied. This is not an oversight: `PLATFORM_AUDIT_REPORT.md` §4-B2
documents that billing is a client-side `useState` simulation with no API
call, no `OrganizationSubscription` write, and no payment provider. There is
nothing real to check a plan against yet. The field is wired so a real
entitlements check can be dropped into one function
(`evaluateFeature` in `libs/shared/platform/src/lib/feature-manager.ts`)
without touching any of its call sites once billing is real — but no feature
in `FEATURE_REGISTRY` sets it today, and none should until then.

---

## 6. A build-pipeline bug found and fixed along the way

While verifying that the new `/dev/platform-diagnostics` route was actually
excluded from a production build (a direct requirement of this task — "an
internal diagnostics screen available only in development/debug builds"),
`nx run @org/web:build` was found to produce a build where
`import.meta.env.DEV` evaluates `true` and React's development JSX runtime is
used — i.e. **a build Nx labels as "build" was shipping a development-mode
bundle.** A bare `vite build` in the same directory, with no Nx involved,
built correctly.

Root cause: `apps/web`'s `build` target is inferred entirely by the
`@nx/vite/plugin` crystal plugin (only its `test` target had an explicit
override) and nothing forced `NODE_ENV=production` through to the spawned
Vite process. Fixed by adding an explicit `env` override to the inferred
target in `apps/web/package.json`:

```json
"targets": {
  "build": {
    "options": { "env": { "NODE_ENV": "production" } }
  }
}
```

Verified: rebuilding via `nx run @org/web:build --skip-nx-cache` after the
change no longer includes `jsxDEV` calls or the dev-only route string in the
output bundle.

**`apps/admin` has the identical pattern** (only a `test` target override in
`apps/admin/package.json`, `build` left entirely to the inferred Vite plugin)
and was not modified — it almost certainly has the same bug and needs the
same one-line fix, applied deliberately rather than as a side effect of
unrelated desktop work.

---

## 7. Why this pass stopped where it did

The full 33-section brief this task was based on is, taken literally, a
multi-week initiative: a backend remote-config service, MSIX/notarization
signing, a build-time store-compliance CLI, and an automated cross-platform
(web / Windows direct / Windows Store / macOS direct / Mac App Store / Linux)
test matrix are each their own project. Building all of them speculatively —
without a Windows Store account, signing certificates, or a real billing
backend to integrate against — would have produced exactly the kind of
"renders convincingly but does nothing" code `PLATFORM_AUDIT_REPORT.md`
already catalogues as this repository's biggest existing problem.

This pass built the part that is real today and testable today: the
capability/feature/policy engine, wired to the app's actual native features,
covered by unit tests, and surfaced in Settings and a diagnostics screen. §4
above is the honest list of what stands between this and an actual Store
submission.
