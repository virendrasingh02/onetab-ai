# App Store Compliance Audit

**Date:** 2026-11-05 · **Branch:** `feat/desktop-app-rail` (uncommitted) · **Base commit:** `12da6a8`
**Replaces for release purposes:** `DESKTOP_STORE_COMPLIANCE_AUDIT.md` (2026-08-24).

Statuses: **PASS** verified compliant · **FAIL** confirmed issue · **PARTIAL** implemented, not fully verified · **NOT APPLICABLE** · **MANUAL REQUIRED** needs credentials, portal access, legal review or a physical device.

---

## 1. Executive summary

**No platform is ready to publish.** This audit closed the biggest code gaps, but two blockers remain that code alone cannot settle:

1. **Paid plans have no store billing path (iOS and Android).** Plans are sold through Stripe only. This is a business and legal decision (section 3).
2. **Nothing has been signed or run on a real device.** There are no certificates, store accounts or native build tools on this machine.

Content moderation for iOS 1.2 now exists, with limits listed in section 3 that you should review before submitting.

Fixed in this pass:

- In-app account deletion, which did not exist anywhere.
- Report and block for chat and AI output, plus an operator queue.
- Content moderation for text, images, files, voice and AI, before anything is posted.
- A consent step before AI data sharing on mobile.
- A bug that would have blanked every pull-to-refresh screen on Android.
- Electron hardening, including a remote crash of the packaged app's local server.

### Readiness by platform

| Platform                        | Status           | What stops it                                                       |
| ------------------------------- | ---------------- | ------------------------------------------------------------------- |
| iOS                             | **Not ready**    | Billing decision, no native build or device test                    |
| Android                         | **Not ready**    | Billing decision, no native build or device test, Data safety form  |
| Windows (direct)                | **Not ready**    | Unsigned; installer not tested end to end                           |
| macOS (direct)                  | **Not ready**    | Never built; signing, notarization and entitlement changes untested |
| Linux                           | **Not ready**    | Never built in this audit                                           |
| Mac App Store / Microsoft Store | **Not targeted** | No sandbox or MSIX target exists; none added                        |

---

## 2. Existing architecture and supported platforms

| Surface      | Path                     | Stack                                  | Status                                                                                  |
| ------------ | ------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------- |
| Web          | `apps/web`               | React, Vite                            | Implemented                                                                             |
| Admin        | `apps/admin`             | React, Vite                            | Implemented, platform operators                                                         |
| Agent Studio | `apps/ai-agent-studio`   | React, Vite                            | Implemented                                                                             |
| Desktop      | `apps/desktop`           | Electron 43.3.0, electron-builder 26   | Windows NSIS, macOS dmg/zip, Linux AppImage/deb configured                              |
| Mobile       | `apps/mobile`            | Expo SDK 58, React Native 0.88, Hermes | iOS and Android through EAS. No `ios/` folder; `android/` is gitignored prebuild output |
| API          | `apps/api`, `libs/api/*` | NestJS, Prisma, Postgres               | Implemented                                                                             |
| Chat         | Synapse (Matrix)         | External homeserver                    | Messages live here, not in Postgres                                                     |

- **Payments:** Stripe, in `libs/api/workspace/src/lib/billing`.
- **Push:** Expo push tokens through `/notifications/devices`.
- **CI:** one workflow (`.github/workflows/ci.yml`) running lint, test, build, typecheck and e2e. There is no release or signing pipeline.
- **Analytics and crash SDKs:** none found in the app package manifests (Sentry, Crashlytics, Mixpanel, Amplitude, Segment, PostHog).

---

## 3. iOS compliance results

Rules checked against the [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/) on 2026-11-05.

| Requirement                                    | Current implementation                                                                   | Files                                                      | Severity | Status                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- | ------------------------ |
| Build with Xcode 26 / iOS 26 SDK or later      | EAS image not pinned; never built here                                                   | `apps/mobile/eas.json`                                     | Critical | MANUAL REQUIRED          |
| 3.1.1 / 3.1.3 digital purchases                | No in-app purchase. Billing is read-only and the "use the web" call to action is removed | `billing.tsx`                                              | Critical | **FAIL** (see below)     |
| 1.2 filter objectionable material              | Word filter and safety model across text, images, files and AI; voice needs a key        | `content-filter.ts`, `content-moderation.service.ts`       | Critical | PARTIAL (see below)      |
| 1.2 report content                             | Report on chat messages and AI output, with operator queue                               | `conversation.tsx`, `report.ts`, `safety-reports-view.tsx` | Critical | PARTIAL                  |
| 1.2 block abusive users                        | Block and unblock, with a list in Settings                                               | `safety.service.ts`, `blocked-users.tsx`                   | Critical | PARTIAL                  |
| 1.2 timely response                            | Queue exists; no staffing, SLA or alerting                                               | `safety-reports-view.tsx`                                  | High     | MANUAL REQUIRED          |
| 1.2 published contact information              | Production builds refuse to build without a support URL                                  | `app.config.ts`                                            | High     | PARTIAL                  |
| 5.1.1(v) in-app account deletion               | Added; verified through the Expo web build                                               | `delete-account.tsx`, `account-deletion.service.ts`        | Critical | PARTIAL                  |
| 5.1.2(i) third-party AI disclosure and consent | Consent gate on AI chat, writer, images and agent chat; revocable in Settings            | `ai-consent.tsx`                                           | Critical | PARTIAL                  |
| Privacy policy link                            | Sign-in and Settings; required for production builds                                     | `sign-in.tsx`, `settings/index.tsx`                        | Critical | PARTIAL (URL must exist) |
| Privacy manifest and required-reason APIs      | Declared; reasons must be checked against the final build                                | `app.config.ts`                                            | High     | PARTIAL                  |
| App Tracking Transparency                      | No tracking SDK found; `NSPrivacyTracking: false`                                        | `app.config.ts`                                            | n/a      | NOT APPLICABLE           |
| 4.8 login services                             | Mobile offers only the app's own email and password                                      | `sign-in.tsx`                                              | n/a      | NOT APPLICABLE           |
| Permission strings                             | Camera, photos, Face ID described; microphone off                                        | `app.config.ts`                                            | Medium   | PASS (config)            |
| Export compliance                              | `usesNonExemptEncryption: false`                                                         | `app.config.ts`                                            | Medium   | MANUAL REQUIRED          |
| Universal links                                | Added behind `EXPO_PUBLIC_LINK_HOST`; needs a hosted association file                    | `app.config.ts`, `+native-intent.ts`                       | Medium   | PARTIAL                  |
| Custom scheme deep links                       | Web-style `/w/:slug/...` links now translate to native routes (previously unmatched)     | `deep-links.ts`, `+native-intent.ts`                       | Medium   | PARTIAL                  |
| Age rating questionnaire                       | New descriptors open 2026-11-16, due 2027-01-12                                          | App Store Connect                                          | Medium   | MANUAL REQUIRED          |
| iPad layouts                                   | `supportsTablet: true`, content width capped                                             | `app.config.ts`, `ui.tsx`                                  | Medium   | MANUAL REQUIRED          |
| Background execution                           | No background modes declared                                                             | `app.config.ts`                                            | Low      | PASS (config)            |

**What content moderation does and does not cover.** Two layers work together. A local word filter (`checkContent`) stops severe text instantly: hate slurs, sexual content involving children, and direct threats or urging self-harm. A safety model, Llama Guard 4 through the existing NVIDIA key, reads images and judges text by meaning. It blocks violence, sex crimes, child safety, weapons, hate, self-harm and sexual content. Ordinary swearing passes, because this is a workplace product.

| Surface                                                                             | How it is checked                                                       | Live result                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Web chat: send and edit                                                             | Word filter in the composer and Matrix client                           | Unit tests only; Matrix offline                     |
| Mobile chat: send                                                                   | Word filter in the composer                                             | Not run; Matrix offline                             |
| Comments, anonymous and scheduled messages, profiles, status, marketplace           | Word filter at the API                                                  | Comments and profile verified                       |
| Tasks, projects, documents, notes, channel names and topics, meeting and call notes | Word filter at the API, reading the whole document                      | Verified, except meeting and call notes             |
| Images in Files, avatars, covers                                                    | Safety model at the API                                                 | Verified on Files                                   |
| Images, files and voice in chat                                                     | `POST /safety/media-check` before upload                                | Endpoint verified; client path needs Matrix         |
| PDF, DOCX and text files                                                            | Text extracted, then word filter and safety model                       | DOCX and TXT verified                               |
| Voice messages                                                                      | Transcribed, then word filter and safety model                          | Verified with a stand-in transcription service only |
| AI prompts                                                                          | Word filter and safety model                                            | Verified on chat, stream and summarize              |
| AI replies                                                                          | Word filter on every reply; safety model on user-facing chat and agents | Unit tests only                                     |

Limits to weigh:

- **Voice is off until a transcription key is set.** `OPENAI_API_KEY` is blank here, so voice messages post unchecked. Set it, or `CONTENT_TRANSCRIBE_*`. The live test used a stand-in for Whisper, so a real transcription service has not been exercised.
- **The image model misses things.** It blocked a poster of bomb-making instructions but passed one reading "I will kill all of you tomorrow". No explicit or graphic image was tested, so how it does on the most important cases is unknown.
- **It fails open.** If the provider is down or times out, content posts unchecked and the API logs `content_moderation_unavailable`. The word filter still runs.
- **Videos are not scanned**, only their file names. Nor are other binary files, zip contents or scanned PDFs that take over 8 seconds to read.
- **Encrypted rooms skip media checks on purpose**, so their content is never sent to a server in the clear. The word filter still runs in the composer.
- **Chat is enforced in our apps only.** Apps send chat straight to Matrix, so another Matrix client with a valid token skips the check. Closing that needs a Synapse module, left out because the docker layer is off limits.
- **Streaming AI replies can show text before the final check.** The word filter stops mid-stream, but the safety model only sees the finished reply, so a flagged answer is already on screen when the error arrives.
- **Imports are not filtered.** Slack and Notion importers and agent tools that write straight to the database skip these checks.
- **The word list is small and English only**, and needs an owner.
- **Moderation is itself third-party AI sharing.** User images and text now go to NVIDIA. Mobile asks once before the first share, but the privacy policy, App Privacy labels and Data safety form must say so, and the NVIDIA API catalog's terms must be confirmed for production use.
- **Whether this satisfies Apple is for Apple to decide.** The guideline does not say how thorough a filter must be.

**Billing, the blocker that needs an owner.** Guideline 3.1.3(b) only lets an app unlock subscriptions bought elsewhere if the same items are also offered as in-app purchases. 3.1.3(c) exempts apps sold directly to organizations, but not consumer or single-user sales. Pro and Max can be bought by an individual, so the enterprise exemption probably does not cover them. Outside the US storefront, the app also cannot encourage other purchase methods. The options are:

- Add StoreKit and Play Billing for individual plans.
- Restrict store builds to organization-sold accounts, then confirm that with Apple.
- Ship the mobile app free with paid features limited to organization plans.

No payment code was changed, because this needs a business decision.

---

## 4. Android compliance results

Rules checked against the [target API policy](https://support.google.com/googleplay/android-developer/answer/11926878), [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) and [AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/14094294).

| Requirement                            | Current implementation                                                         | Files                                      | Severity | Status                              |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ | -------- | ----------------------------------- |
| Target API 36 for new apps and updates | Resolved default is target 36, compile 37, min 24; no AAB built to confirm     | `react-native/gradle/libs.versions.toml`   | Critical | PARTIAL                             |
| Play Billing for digital goods         | Same issue as iOS                                                              | `billing.tsx`                              | Critical | **FAIL**                            |
| Account deletion in app                | Added                                                                          | `delete-account.tsx`                       | Critical | PARTIAL                             |
| Account deletion web resource          | Public `/account/delete` page added; URL goes in the Data safety form          | `account-deletion-page.tsx`                | Critical | PARTIAL                             |
| UGC reporting and blocking             | Same as iOS                                                                    | see section 3                              | Critical | PARTIAL                             |
| AI content safety                      | In-app report on AI output. Server-side output filtering not audited           | `report.ts`                                | High     | PARTIAL                             |
| Data safety form                       | Draft inputs in section 8                                                      | Play Console                               | Critical | MANUAL REQUIRED                     |
| Runtime permissions                    | Camera, notifications and biometrics only                                      | `app.config.ts`                            | High     | PASS (config)                       |
| Sensitive permissions                  | `RECORD_AUDIO` blocked everywhere, `SYSTEM_ALERT_WINDOW` blocked in production | `app.config.ts`                            | High     | PASS (config)                       |
| Android 13+ notification permission    | `POST_NOTIFICATIONS` declared, requested at runtime                            | `push.ts`                                  | Medium   | PASS (config)                       |
| Storage permissions                    | `READ/WRITE_EXTERNAL_STORAGE` capped at SDK 32 in the prebuild manifest        | `android/app/src/main/AndroidManifest.xml` | Low      | PASS (prebuild output)              |
| Foreground services                    | None declared                                                                  | same                                       | n/a      | NOT APPLICABLE                      |
| Cleartext traffic                      | Allowed in debug variants only; production guard requires https                | `app.config.ts`                            | High     | PASS (config)                       |
| Backups                                | `allowBackup: false`                                                           | `app.config.ts`                            | Medium   | PASS (config)                       |
| Secure storage                         | Keystore through `expo-secure-store`, device only                              | `secure-store.ts`                          | High     | PASS (code review)                  |
| Verified App Links                     | Added behind `EXPO_PUBLIC_LINK_HOST`; needs `assetlinks.json`                  | `app.config.ts`                            | Medium   | PARTIAL                             |
| Pull-to-refresh screens                | **Fixed**: content was dropped on Android                                      | `ui.tsx`                                   | Critical | PARTIAL (fix confirmed on web only) |
| AAB and Play App Signing               | EAS production profile builds an app bundle                                    | `eas.json`                                 | High     | MANUAL REQUIRED                     |
| 16 KB page size                        | Not checked; no native build available                                         | n/a                                        | High     | MANUAL REQUIRED                     |
| Tablet and foldable layouts            | Not tested                                                                     | n/a                                        | Medium   | MANUAL REQUIRED                     |

---

## 5. Windows compliance results

| Requirement                            | Current implementation                                                              | Severity | Status          |
| -------------------------------------- | ----------------------------------------------------------------------------------- | -------- | --------------- |
| NSIS installer                         | Built successfully, 113 MB, unsigned                                                | High     | PARTIAL         |
| Code signing                           | No certificate on this machine                                                      | Critical | MANUAL REQUIRED |
| Publisher name for update verification | Not set; must match the certificate subject exactly                                 | High     | MANUAL REQUIRED |
| Fuses applied                          | Read back from the packaged binary                                                  | High     | PASS            |
| Packaged app launches with fuses on    | Ran 14 seconds with `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS` set; stayed a GUI app | High     | PASS            |
| Install and uninstall                  | Installer not run                                                                   | High     | MANUAL REQUIRED |
| Auto-update and rollback               | Needs a hosted feed; not exercised                                                  | High     | MANUAL REQUIRED |
| Display scaling, screen readers        | Not tested                                                                          | Medium   | MANUAL REQUIRED |
| Microsoft Store                        | No MSIX target; not added                                                           | n/a      | NOT APPLICABLE  |

---

## 6. macOS compliance results

Nothing here could run on Windows.

| Requirement                           | Current implementation                                                      | Severity | Status                                    |
| ------------------------------------- | --------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| Developer ID signing and notarization | electron-builder notarizes when Apple credentials are in the environment    | Critical | MANUAL REQUIRED                           |
| Hardened runtime                      | On                                                                          | High     | PASS (config)                             |
| Entitlements                          | Removed `allow-unsigned-executable-memory` and `disable-library-validation` | High     | PARTIAL (**needs a smoke test on a Mac**) |
| Camera and microphone strings         | Present                                                                     | Medium   | PASS (config)                             |
| Architectures                         | `x64` and `arm64` now set                                                   | Medium   | PARTIAL                                   |
| Mac App Store sandbox                 | Not enabled; store not targeted                                             | n/a      | NOT APPLICABLE                            |

If a signed Mac build crashes at launch, check the removed entitlements first.

---

## 7. Linux compliance results

| Requirement                | Current implementation                               | Severity | Status           |
| -------------------------- | ---------------------------------------------------- | -------- | ---------------- |
| AppImage and deb           | Configured, maintainer added; not built here         | Medium   | MANUAL REQUIRED  |
| Token storage              | The `basic_text` backend now counts as no encryption | High     | PASS (unit test) |
| Auto-update, notifications | Not tested                                           | Medium   | MANUAL REQUIRED  |

---

## 8. Security and privacy audit

### Electron

| Check                                                                            | Result                                                                   | Status               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`, no `webview` | On, guarded by a test                                                    | PASS                 |
| DevTools in packaged builds                                                      | Was reachable through `webPreferences`; now off                          | PASS                 |
| IPC sender validation                                                            | Every handler is wrapped by `guard()`                                    | PASS                 |
| Preload exposure                                                                 | Typed bridge, no raw `ipcRenderer`                                       | PASS                 |
| Navigation and `window.open`                                                     | Same-origin only; https links go to the system browser                   | PASS                 |
| External URL handling                                                            | Protocol checks on all renderer-supplied URLs                            | PASS                 |
| Permission handler                                                               | Default deny, origin checked                                             | PASS                 |
| Content Security Policy                                                          | Hashed inline scripts, no `unsafe-eval`; `style-src` allows inline       | PASS                 |
| Local server crash                                                               | **Fixed**: a malformed URL threw in the request handler                  | PASS                 |
| Local server DNS rebinding                                                       | **Fixed**: Host checked, read-only methods                               | PASS                 |
| Plaintext token fallback                                                         | **Fixed**: never written; old files rewritten on load                    | PASS                 |
| `showItemInFolder`                                                               | **Fixed**: only paths chosen in a dialog this session                    | PASS                 |
| Fuses                                                                            | **Added** through electron-builder                                       | PASS                 |
| Hardcoded build and license metadata                                             | **Fixed**                                                                | PASS                 |
| Packaging against localhost                                                      | **Fixed**: `ONETAB_RELEASE=1` refuses non-https config (exit 1 verified) | PASS                 |
| Generic preference keys over IPC                                                 | Not allow-listed; values stay in the app's own store                     | Low risk, left as is |

### Data handling

| Area                             | Finding                                                                                                            | Status                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Transit encryption               | Enforced for production mobile and desktop release builds. Server TLS is deployment config                         | PARTIAL                 |
| Encryption at rest               | Integration secrets encrypted by `IntegrationEncryptionService`. Database and blob storage depend on hosting       | MANUAL REQUIRED         |
| OAuth revocation                 | Revoked on account deletion through `disconnectIntegration`; provider failures are logged and tokens still deleted | PARTIAL                 |
| Tenant isolation                 | Not re-audited; see `PLATFORM_WORKSPACE_ISOLATION_AUDIT.md`                                                        | Not re-verified         |
| Secrets in the repository        | No `.env`, keystore or certificate tracked                                                                         | PASS                    |
| Backup retention                 | No documented schedule, and the deletion copy says "normal schedule"                                               | MANUAL REQUIRED         |
| AI disclosure on web and desktop | The consent gate is mobile only                                                                                    | MANUAL REQUIRED (legal) |
| Agent and marketplace isolation  | Covered by earlier passes; not re-audited here                                                                     | Not re-verified         |
| Dependencies                     | `npm audit --omit=dev`: 28 findings, 12 high, 0 critical. Not fixed                                                | **FAIL**                |

### What account deletion really does

The UI states this, and the privacy policy must match it.

**Deleted:** credentials, sessions, passkeys, 2FA, push devices, integrations and their tokens, notifications, preferences, bookmarks, reminders, private AI chats, agent conversations, employee profile, workspace and channel memberships, avatar and cover images, and any workspace with no other members.

**Kept:**

- A scrubbed `users` row (`deleted+<id>@deleted.invalid`, "Deleted user") so shared content keeps an author.
- Tasks, documents, comments and uploads in shared workspaces.
- Audit logs and content reports, which keep the anonymous ID.
- Copies of messages other people received. Synapse's `erase` hides them only from people who join later.
- Stripe's billing records. **Invoices stored locally are deleted with a sole-member workspace**, so have your accountant or lawyer confirm that is acceptable.
- Database backups, until they expire.

If chat erasure fails, the account is still deleted, the response says `chatErased: false`, and the Matrix ID is logged for an operator. There is no automatic retry.

### Data safety and App Privacy inputs (draft, needs legal review)

| Data                           | Collected                  | Purpose           | Shared with                                              |
| ------------------------------ | -------------------------- | ----------------- | -------------------------------------------------------- |
| Name, email, profile           | Yes                        | Account           | None by default                                          |
| Messages, files, photos        | Yes                        | App functionality | Other workspace members                                  |
| AI prompts and attachments     | Yes                        | AI features       | Selected AI provider (OpenAI, Anthropic, Google, others) |
| Payment                        | Through Stripe             | Billing           | Stripe                                                   |
| Device push token, device name | Yes                        | Notifications     | Expo, Apple, Google                                      |
| IP and session data            | Yes                        | Security          | None by default                                          |
| Location                       | Attendance geofence on web | Attendance        | Confirm before declaring                                 |

---

## 9. Accessibility and native UX findings

Reviewed by code search only. No VoiceOver or TalkBack session was run.

| Area                                          | Finding                                                                                                                  | Status             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Dynamic Type                                  | No code disables font scaling                                                                                            | PARTIAL            |
| Shared primitives                             | `IconButton`, `TextField` and rows carry labels and roles                                                                | PASS (code review) |
| Touchables                                    | 52 of 115 `Pressable` uses have a label or role nearby (rough search). New controls are labelled; the rest are not fixed | **FAIL**           |
| Reduced motion                                | Referenced in 5 places; 8 animated call sites not individually reviewed                                                  | PARTIAL            |
| Localization                                  | Mobile is English only; web has i18n                                                                                     | PARTIAL            |
| Safe areas, keyboard avoidance, native sheets | Implemented in shared components                                                                                         | PARTIAL            |
| Offline                                       | Banner exists; no device test                                                                                            | PARTIAL            |

**Mobile feature gaps** against "all major features work on mobile":

- No voice messages or calls. `RECORD_AUDIO` is deliberately blocked.
- No in-app sign-up (it opens the web).
- No marketplace.
- Connecting integrations opens the web.
- Encrypted rooms cannot be read, and those messages cannot be reported.
- People who signed up with Google or Apple on the web have no way to sign in on mobile unless they set a password.

---

## 10. Issues discovered

| #   | Severity | Issue                                                                                             | Location                                             | State                               |
| --- | -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| 1   | Critical | No account deletion on any platform                                                               | n/a                                                  | Fixed                               |
| 2   | Critical | No reporting or blocking of users or content                                                      | n/a                                                  | Fixed                               |
| 3   | Critical | Compliance seed said deletion was "verified on Windows client", though no deletion existed        | `compliance.service.ts`                              | Fixed, status now `WARNING`         |
| 4   | Critical | Pull-to-refresh wrapper dropped screen content on Android and web                                 | `apps/mobile/src/components/ui.tsx`                  | Fixed                               |
| 5   | Critical | No consent before sending data to third-party AI                                                  | mobile AI screens                                    | Fixed for the four AI screens       |
| 6   | Critical | Paid plans have no store billing path                                                             | `billing.tsx`                                        | **Open**                            |
| 7   | Critical | No filter on user content                                                                         | `content-filter.ts`, `content-moderation.service.ts` | Fixed, with the limits in section 3 |
| 24  | High     | Document editor showed "Saved" and dropped the text when a save failed                            | `DocumentEditor.tsx`, `use-docs.ts`                  | Fixed                               |
| 25  | High     | Web Files page has no upload control, so Files upload moderation was only tested through the API  | `FileManagerView`                                    | **Open**, confirm this is intended  |
| 8   | High     | Malformed URL could crash the packaged desktop app                                                | `static-server.ts`                                   | Fixed                               |
| 9   | High     | Desktop wrote tokens in plaintext when encryption was unavailable                                 | `auth.ts`                                            | Fixed                               |
| 10  | High     | Any website could reach the local server through DNS rebinding                                    | `static-server.ts`                                   | Fixed                               |
| 11  | High     | Production mobile build could ship pointing at localhost                                          | `app.config.ts`                                      | Fixed                               |
| 12  | High     | No Electron fuses                                                                                 | `electron-builder.json`                              | Fixed                               |
| 13  | High     | Over-broad macOS entitlements                                                                     | `entitlements.mac.plist`                             | Fixed, untested                     |
| 14  | High     | No legal links in the mobile app                                                                  | `settings/index.tsx`, `sign-in.tsx`                  | Fixed                               |
| 15  | High     | Billing screen steered users to the web                                                           | `billing.tsx`                                        | Fixed                               |
| 16  | High     | 12 high-severity dependency advisories                                                            | `package-lock.json`                                  | **Open**                            |
| 17  | High     | Report queue can mark reports but has no suspend or remove action                                 | `safety-reports-view.tsx`                            | **Open**                            |
| 18  | Medium   | Web-style deep links matched no native route                                                      | `deep-links.ts`                                      | Fixed                               |
| 19  | Medium   | Unlabelled touch targets                                                                          | `apps/mobile/src`                                    | **Open**                            |
| 20  | Medium   | Push permission is requested right at sign-in, with no context                                    | `push.ts`                                            | **Open**                            |
| 21  | Medium   | `expo-doctor`: 5 failed checks, 16 packages behind the SDK's expected versions, duplicate `react` | `apps/mobile`                                        | **Open**                            |
| 22  | Low      | `@expo/ngrok` is a runtime dependency                                                             | `apps/mobile/package.json`                           | **Open**                            |
| 23  | Low      | Help menu links to `github.com/onetab-ai`, not confirmed to be yours                              | `menu.ts`                                            | **Open**                            |

---

## 11. Changes implemented

**API**

- `AccountDeletionService`: `GET /users/me/deletion-preview`, `POST /users/me/delete`. Requires the password, a 2FA code when enabled, and a typed `DELETE`. Blocked while the person owns a workspace others use.
- `SafetyService`: `POST /safety/reports`, `GET|POST /safety/blocks`, `DELETE /safety/blocks/:userId`, and `GET|PATCH /admin/safety/reports` for operators.
- Blocks are written to Matrix `m.ignored_user_list`. Clients also filter blocked senders.
- `JwtStrategy` rejects deleted accounts.
- Migration `20261105120000_account_deletion_and_safety`, applied to the local database only.

**Mobile:** delete account screen, blocked people screen, report and block in the message menu, report on AI output, AI consent gate and Settings toggle, legal links, deep-link translation, the refresh fix, neutral billing copy, and config guards.

**Web and admin:** Settings → Account Security deletion panel, public `/account/delete`, report and block in the message menu, and the `/safety` queue. The queue is not yet linked from the admin navigation.

**Content filter:** `checkContent` in `@org/types`, one implementation shared by every client and the API. `assertContentAllowed` in `@org/api-common` returns 422 `CONTENT_BLOCKED` and never names the matched term. The web composer also fixes the old lint error in `lexical-composer.tsx`.

**Moderation:** `ContentModerationService` in `@org/api-ai`, used by `UploadService`, avatars and covers, `POST /safety/media-check` and the AI gateway (`moderate: 'all' | 'output'`). The Matrix client gained a `mediaGuard` option. Mobile asks once before a first share. Settings are in `.env.example`.

**Desktop:** fuses, server hardening, encrypted-only token storage, `showItemInFolder` limits, DevTools off, entitlements, metadata, and a release guard.

---

## 12. Tests executed and actual results

| Check                                       | Result                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, all 81 projects                  | Passed. `@org/mobile` and `@org/chat-ui` re-run and passed after later edits                                                                                                                                                                                                                        |
| `@org/api-user` tests                       | 15 of 15 passed (new)                                                                                                                                                                                                                                                                               |
| `@org/desktop` tests                        | 180 of 180 passed                                                                                                                                                                                                                                                                                   |
| `@org/mobile` tests                         | 94 of 94 passed                                                                                                                                                                                                                                                                                     |
| Other tests in the 12-project run           | **Failures in `@org/api-auth`, `@org/chat-ui`, `@org/web`, `@org/web-chat`.** The same spec groups fail on a clean checkout of `12da6a8` (table below). `@org/api-agents` also fails `agent-widget-sdk.spec.ts` on `localStorage` undefined; that file is unchanged, not re-run on a clean checkout |
| Lint                                        | Passed for all changed projects, including `@org/chat-ui` after fixing its old `lexical-composer.tsx` error                                                                                                                                                                                         |
| Content filter tests                        | 35 of 35 in `@org/types`, including innocent-word and hostile-input cases; 2 in `@org/api-common`; 3 in `@org/matrix-client`                                                                                                                                                                        |
| Content filter, live API                    | 4 of 4: blocked profile name and task comment returned 422, ordinary text passed                                                                                                                                                                                                                    |
| Moderation, live API with real NVIDIA model | 25 of 25 flow checks (text surfaces, files, voice through a stand-in, AI). A bomb-instructions poster was blocked, also when renamed `.bin`. A written-threat poster was **not** blocked. No provider failures in the final run                                                                     |
| Moderation unit tests                       | `@org/api-ai` passed, including 14 moderation and 6 gateway cases                                                                                                                                                                                                                                   |
| Document editor in the browser              | Blocked text stays on screen with "Not saved" and the rules message; corrected text shows "Saved"                                                                                                                                                                                                   |
| `@org/matrix-client` tests                  | 135 of 141. The 6 failures are `session-store.spec.ts` (`localStorage` undefined in the test environment); that file is unchanged, but this was not re-run on a clean checkout                                                                                                                      |
| Production builds                           | `@org/api`, `@org/web`, `@org/admin`, `@org/desktop` passed                                                                                                                                                                                                                                         |
| Expo JS bundles                             | iOS and Android exports passed                                                                                                                                                                                                                                                                      |
| Windows package                             | `--dir` and NSIS builds passed, unsigned                                                                                                                                                                                                                                                            |
| Fuses                                       | Read back from the binary: all set as configured                                                                                                                                                                                                                                                    |
| Packaged app smoke test                     | Launched, served the bundle with the new headers                                                                                                                                                                                                                                                    |
| Release guards                              | Desktop exit 1 without https URLs; Expo throws for missing URLs                                                                                                                                                                                                                                     |
| Live API, 20 checks                         | 18 passed first run. The 2 misses were test mistakes: operator routes return 404 by design, and the login call lacked `rememberMe`. Login after deletion then returned 401                                                                                                                          |
| Mobile UI (Expo web build)                  | Sign-in links, consent gate, Settings rows, blocked list, billing, and a full deletion ending at sign-in                                                                                                                                                                                            |
| Web UI                                      | Public deletion page and Settings panel rendered                                                                                                                                                                                                                                                    |
| `npm audit --omit=dev`                      | 28 findings: 1 low, 15 moderate, 12 high                                                                                                                                                                                                                                                            |
| `expo-doctor`                               | 5 checks failed                                                                                                                                                                                                                                                                                     |

**Failures present before this audit:**

| Project                      | With these changes                 | Clean `12da6a8`  |
| ---------------------------- | ---------------------------------- | ---------------- |
| `@org/api-auth` oauth spec   | 2 failed                           | 2 failed         |
| `@org/chat-ui`               | 13 to 14 failed of 240 across runs | 14 failed of 238 |
| `@org/web` theme spec        | 3 failed                           | 3 failed         |
| `@org/web-chat` dm-mute spec | 5 failed                           | 5 failed         |

**Not run:**

- Native iOS or Android builds (no Mac, Java or Android SDK here).
- Any physical device, VoiceOver or TalkBack.
- macOS or Linux packaging.
- `@org/api-e2e` and the `e2e-tester` flow suite.
- The whole-workspace test run; only the 12 affected projects ran.
- **Anything needing Matrix, which was offline:** chat erasure, `m.ignored_user_list`, report or block on a real message, and the chat composer filter in a live conversation. The report and block menu items passed component tests, the Matrix client check passed unit tests, and the two composer checks have no automated test.
- Stripe cancellation against a real or test account. The ordering is unit tested only.
- Subscription upgrade, restore, trial expiry and billing errors.
- Social sign-in, session expiry during a transaction, and slow or low-memory devices.

---

## 13. External actions still required

**Decisions**

1. Choose the mobile billing model (section 3).
2. Review the word list, add a transcription key for voice, and decide whether video scanning, stricter failure handling and a Synapse module are needed.
3. Name who answers reports, and how fast.
4. Have legal review the privacy policy, retention and invoice deletion.

**Accounts and credentials**

5. Apple Developer and Play Console accounts. Create the Expo project and set `EAS_PROJECT_ID`.
6. APNs key and FCM credentials for push.
7. Windows signing certificate, then set `win.signtoolOptions.publisherName`.
8. Apple Developer ID certificate and notarization credentials.

**Hosting**

9. Publish privacy, terms and support pages. The `onetab.ai` URLs in `ipc.ts` and `app-metadata.ts` were not checked.
10. Set `EXPO_PUBLIC_API_URL`, `_WEB_URL`, `_PRIVACY_URL`, `_TERMS_URL`, `_SUPPORT_URL` and `_LINK_HOST`, plus `VITE_PRIVACY_URL`, `VITE_TERMS_URL` and `VITE_SUPPORT_URL` so `/account/delete` shows support contact details.
11. Host `apple-app-site-association` and `assetlinks.json`.
12. Host the desktop update feed and set `ONETAB_UPDATE_URL`.
13. Deploy the migration, and confirm Synapse runs in admin mode, because erase and block sync do nothing otherwise.

**Store forms**

14. App Privacy labels, Data safety form, deletion URL, age rating, export compliance, and a reviewer demo account.

---

## 14. Final publishing checklist

**All platforms**

- [ ] Critical issue 6 resolved; moderation limits reviewed; voice transcription key set
- [ ] Dependency advisories triaged
- [ ] Migration deployed; deletion tested against production-like Matrix and Stripe test mode
- [ ] Report response process staffed
- [ ] Legal pages live and matching section 8

**iOS**

- [ ] EAS build with Xcode 26 or later, then TestFlight
- [ ] Merged privacy manifest reviewed
- [ ] VoiceOver and Dynamic Type pass on iPhone and iPad
- [ ] Deep links, push, camera and photos tested on a device
- [ ] App Privacy, age rating and export compliance complete

**Android**

- [ ] AAB built; target API 36 and final merged manifest confirmed
- [ ] 16 KB page size check
- [ ] TalkBack pass; phone, tablet and foldable tested
- [ ] Pull-to-refresh screens confirmed on a device
- [ ] Data safety form with the deletion URL

**Windows**

- [ ] Signed installer, SmartScreen check, install, update and uninstall

**macOS**

- [ ] Signed and notarized build launches with the reduced entitlements
- [ ] Camera, microphone and Gatekeeper tested on Intel and Apple silicon

**Linux**

- [ ] AppImage and deb built and installed

---

## Summary

- **Critical blockers:** mobile billing model, no signed builds or device testing.
- **High priority:** 12 dependency advisories, no enforcement actions in the report queue, report response process, unverified Matrix erasure and blocking, untested macOS entitlements.
- **Medium priority:** unlabelled touch targets, push prompt timing, `expo-doctor` failures, mobile feature gaps, mobile localization.
- **Completed fixes:** issues 1–5, 8–15 and 18 in section 10, plus issues 7 and 24.
- **Remaining manual tasks:** section 13.
- **Readiness:** no platform is READY TO PUBLISH.
