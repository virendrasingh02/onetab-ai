# Security audit — 2026-10-22

Scope: Nx monorepo (API, web, desktop, admin, studio). Method: code review by area, fixes, regression tests.
Verification run: `nx test` on 14 API libs (all pass), `typecheck`/`lint` on 18 touched projects (0 errors), `nx build @org/web` and `@org/api` (pass), `npm audit`. **Not done:** live penetration test, browser run of the CSP / CAPTCHA widget, running against a real IdP, Postgres RLS.

## Status per checklist item

| # | Area | Status | Evidence |
|---|---|---|---|
| 1 | Row-Level Security | **FAIL (not implemented)** | No `ENABLE ROW LEVEL SECURITY` in any migration; app connects as the DB owner. Tenant isolation is application-level only (`WorkspaceRoleGuard` + `workspaceId` filters). Rollout plan below. |
| 2 | API authentication | **PASS** | `JwtAuthGuard` is global, routes opt out with `@Public()`. All 40+ public routes reviewed; unthrottled ones now throttled. `guards.security.spec.ts`. |
| 3 | Frontend trust | **FIXED** | Marketplace install/update/uninstall/approve had no permission check (guests could call) → `MANAGE_SETTINGS`. Analytics config/trace routes → `MANAGE_SETTINGS`, reads → member+. `marketplace.authorization.spec.ts`. Many handlers still take `@Body() any` (see risks). |
| 4 | Rate limiting | **FIXED** | Per-IP limits already existed; they were useless behind nginx (no `trust proxy`, all clients shared one bucket) → `TRUST_PROXY_HOPS`. Added per-account login limiter (`account` throttler, `LOGIN_ACCOUNT_LIMIT`), throttles on invitation preview/decline, device info/reject, SSO lookup/recovery-login. |
| 5 | Input validation / XSS | **FIXED** | Reflected XSS in OAuth callback (`:provider` echoed into HTML/JS) fixed + CSP. Gmail HTML now rendered in a script-less sandboxed iframe (was `dangerouslySetInnerHTML`). Link-preview ids validated. |
| 6 | Parameterized queries | **PASS** | Every `$queryRaw/$executeRaw` is a tagged template or constant (audited); no user JSON reaches Prisma `where`. |
| 7 | CORS | **PASS** | Explicit origin list, localhost only outside production; added preflight `maxAge`. |
| 8 | HTTPS / cookies | **FIXED (code) + manual** | `httpsRedirect()` (308 for GET, 426 for writes, probes exempt), HSTS 2y+preload via helmet. Cookies already `httpOnly`, `secure`+`sameSite=strict` in prod. Needs `TRUST_PROXY_HOPS=1` and TLS termination. `http-security.spec.ts`. |
| 9 | IDOR / BOLA | **FIXED (partial)** | Private-channel members/pins/files were readable by every workspace member → `assertReadable`. Upload list/download now hide private-channel and other users' DM files. Analytics `compareVersions` cross-tenant name leak scoped. Remaining: see risks. |
| 10 | Production debugging | **PASS (with caveat)** | No Swagger/debug endpoints; filter returns generic 500s. `analytics/health` (probed deps, leaked topology) now SUPERADMIN/SUPPORT only. Caveat: several behaviours key off `NODE_ENV !== 'production'` (invite tokens in API responses, billing test mode) — deployments must set `NODE_ENV=production`. |
| 11 | CAPTCHA / bots | **FIXED (needs config)** | `CaptchaGuard` (Turnstile/hCaptcha/reCAPTCHA siteverify, fail-closed once `CAPTCHA_SECRET_KEY` set) on register, login, forgot-password, magic-link ×2, email-verification. Web: invisible widget via `configureCaptcha(VITE_CAPTCHA_SITE_KEY)`. **Inactive until both keys are set.** `captcha.guard.spec.ts`. Desktop/mobile/studio clients do not send a token — enable only after wiring them or they will be locked out. |
| 12 | Admin audit logs | **FIXED (partial)** | Admin role change, user delete, workspace delete and login success/failure, password change/failed change now write audit rows (reusing `ComplianceAuditLog`, no migration). Still unaudited: 2FA/passkey changes, API-key create/revoke, SSO sign-ins. |
| 13 | Private storage | **FIXED** | File URLs signed with a dedicated derived key (previously the JWT secret, with a hardcoded fallback); fails closed. Variant parameter allow-listed (storage-key injection); extension in storage key sanitized (traversal). Per-context visibility (item 9). |
| 14 | Admin authorization | **PASS** | All admin/compliance/billing/enterprise controllers use `SystemRoleGuard` (fail-closed, role re-read per request); regression spec added. SSO recovery codes now owner-only. SUPPORT role still has write access to compliance/app-versions (risk). |
| 15 | Dependencies | **FIXED (partial)** | Criticals (proxy-addr, shell-quote) cleared; axios 1.20, vite 8.3.5, compression, js-yaml, etc. updated. `npm audit --omit=dev`: 0 critical, 23 high (was 2 / 28). Remaining highs are the Expo/React-Native toolchain, Prisma CLI chain (`@prisma/config`, `mysql2`), `undici` via Qdrant client, `follow-redirects` 1.16.0 (1.16.1 not yet resolvable). Added `xml-crypto` (SAML). |
| 16 | File upload security | **FIXED** | MIME normalised (parameters stripped — `image/svg+xml; charset=…` bypassed the block), active types (html/js/xml/svg/css/wasm) rejected; served files are forced to `attachment` unless on a short inert list, active types relabelled `application/octet-stream`, `Content-Security-Policy: sandbox` + `nosniff`. Previously a `text/javascript` upload could run on the API origin. `upload-safety.spec.ts`. Magic-byte sniffing is still image-only. |
| 17 | AI security | **PASS (prior pass) + FIXED** | Prior pass (2026-09-28): SSRF guard, tool gating, approvals, MCP. This pass: custom-LLM endpoint SSRF pre-flight + no redirects on save/test. Open: custom-LLM `apiKey` stored in plaintext JSON; code-step sandbox is `node:vm` in a worker (not a hard boundary). |
| 18 | Security headers | **FIXED (API + web build)** | API: strict CSP (`default-src 'none'`, `frame-ancestors 'none'`), HSTS, no-referrer, frameguard deny. Web production build: CSP `<meta>` with hash for the one inline theme script (verified hash matches in `dist/index.html`). `frame-ancestors`/`X-Frame-Options` for the web host must be set at the host. Not browser-tested. |
| 19 | Webhook security | **FIXED** | Stripe/connector webhooks were already sound (raw-body HMAC, timestamp, dedupe). Fixed: Resend failed open when secret unset outside production; Matrix appservice and inbound-email and workflow-webhook secrets compared with `!==` (now constant-time); inbound-email secret accepted in header/Bearer (query kept for providers that need it); unsigned generic `webhooks/:provider` ingest (unauthenticated writes, event-id poisoning) now 410; raw body captured for `/webhook(s)`/`/inbound`; body limit 50 MB → 10 MB. `resend-webhook.security.spec.ts`, `secrets-equal.spec.ts`. |

## Additional critical findings fixed
- **SAML**: only the RSA signature over `SignedInfo` was checked — the digest was never verified, so a captured signature could be attached to a forged assertion (full account takeover). Replaced with `xml-crypto`; assertion is now read from the *signed* bytes (anti-wrapping); SHA-1 refused; Conditions and exact audience required. 6 tests incl. tamper, wrapping, id swap. `@org/api-enterprise` previously had **no test target** (its specs never ran) — added.
- **SSO/SCIM account takeover**: IdP-asserted email linked to any existing account with no domain-ownership check, and SCIM could overwrite/repoint emails. Now requires an org-verified domain; SCIM no longer rewrites existing users' names and rejects email changes outside verified domains or onto taken addresses.
- Hardcoded fallback encryption/webhook keys removed (`ENCRYPTION_KEY` || `JWT_ACCESS_SECRET`, no public default).

## Remaining risks (not fixed)
1. **No RLS.** Plan: separate migration role vs `onetab_app` (NOBYPASSRLS); per-request transaction with `set_config('app.workspace_id', …, true)`; start with ~12 high-risk tables; background jobs need an explicit bypass. ~1–2 weeks incl. tests.
2. Many handlers use `@Body() body: any` (analytics, marketplace, admin); validate with zod. Add a lint/test that fails on mutating routes under `WorkspaceRoleGuard` without a permission decorator (integrations/connectors still lack decorators — any member incl. GUEST can use workspace Gmail/Slack connections).
3. Link-preview visibility, huddle join/lookup, agent API keys (scopes ignored, not bound to an agent), presence only partially authorised; realtime broadcasts private-channel metadata workspace-wide; SSE accepts the access JWT in `?token=`.
4. Auth events (2FA, passkeys, sessions, API keys, SSO login) not audited; audit rows use `ComplianceAuditLog` rather than a dedicated model.
5. Access token in `localStorage` + refresh token also returned in JSON bodies (XSS blast radius).
6. Device-code login: 6-char code, process-local state, code logged.
7. Docker: compose publishes Postgres/Redis/MinIO on all interfaces with default credentials (docker/ left untouched by instruction; bind to 127.0.0.1 and remove defaults before any shared deployment). nginx config has no TLS or security headers.
8. User-uploaded content is still served from the API origin; a separate cookieless domain is the real fix.
9. Remaining `npm audit` highs (above); `desktop.log` files are tracked in git.

## Production configuration required (not code)
`NODE_ENV=production`; `TRUST_PROXY_HOPS=1` behind nginx/LB; TLS termination forwarding `X-Forwarded-Proto`; `ENFORCE_HTTPS=true`; `CAPTCHA_SECRET_KEY` + web `VITE_CAPTCHA_SITE_KEY` (after wiring non-web clients); `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_SECRET`, `MATRIX_HS_TOKEN`, `ENCRYPTION_KEY` (≥32 chars; do not rotate without re-encrypting stored credentials); web host must send `X-Frame-Options: DENY` / `frame-ancestors 'none'`; verified domains configured on every SSO/SCIM organization (SSO now rejects emails outside them); Redis for rate limits and any multi-node deployment.

## Behaviour changes to be aware of
- `POST /marketplace/listings/custom` is SUPERADMIN-only (any user could overwrite another publisher's listing); the "publish custom agent" UI will 404 for non-operators.
- Marketplace install/uninstall/approve need workspace `MANAGE_SETTINGS`.
- Unsigned `POST /webhooks/:provider` and `/integrations/webhooks/:provider` return 410; use the per-connection URL.
- File signed URLs minted before deploy stop working (new key); JSON bodies > 10 MB rejected (`BODY_LIMIT_MB`).
- SSO sign-in for new identities fails unless the email domain is verified for the org.
- Uploaded HTML/JS/SVG/XML types are rejected; other non-inert types download instead of rendering inline.
