# Authentication Architecture & Provider Integration Guide

This document describes the unified authentication system implemented across the platform monorepo, covering Password, Magic Link, **Google OAuth 2.0 (with PKCE)**, and **Sign in with Apple**.

---

## 1. Architectural Overview

The authentication system is built around a single, unified identity model. Regardless of the entry point (Email & Password, Magic Link, Google Login, or Apple Login), all authentication mechanisms resolve to the exact same internal `User` and session model.

```mermaid
flowchart TD
    subgraph Client ["Client Entrypoints"]
        Web[Web Browser / Vite]
        Desktop[Electron Desktop App]
        Ext[Browser Extension]
    end

    subgraph AuthMethods ["Authentication Methods"]
        PWD[Email + Password]
        ML[Magic Link]
        GOOG[Google OAuth 2.0 + PKCE]
        APPL[Sign in with Apple]
    end

    subgraph CoreEngine ["Unified Auth Engine (libs/api/auth)"]
        State[Sealed flow cookie & PKCE]
        Resolver[Account & Identity Resolver]
        Linker[Verified Identity Linker]
    end

    subgraph Database ["Prisma Postgres"]
        UserTable[User (passwordHash?)]
        IdentityTable[UserIdentity (provider, providerUserId)]
        SessionTable[RefreshToken]
        WorkspaceTable[Workspace & Membership]
    end

    subgraph Session ["Application Session"]
        JWT[JWT Access Token (15m)]
        Cookie[Rotating httpOnly Refresh Cookie (30d)]
        DesktopCode[Desktop PKCE Handoff Code]
    end

    Web --> AuthMethods
    Desktop -->|PKCE browser handoff| AuthMethods
    Ext --> AuthMethods

    PWD --> Resolver
    ML --> Resolver
    GOOG --> State --> Resolver
    APPL --> State --> Resolver

    Resolver --> Linker
    Linker --> UserTable
    Linker --> IdentityTable
    UserTable --> WorkspaceTable

    Resolver --> Session
    Session --> JWT
    Session --> Cookie
    Session --> DesktopCode
```

---

## 2. Data Model & Schema

### 2.1 Prisma Schema

The data model defines a one-to-many relationship from `User` to `UserIdentity`:

```prisma
model User {
  id                    String         @id @default(cuid())
  email                 String         @unique
  passwordHash          String?        // Nullable: allows passwordless OAuth users
  name                  String?
  avatar                String?
  role                  GlobalRole     @default(USER)
  emailVerified         Boolean        @default(false)
  emailVerifiedAt       DateTime?
  twoFactorEnabled      Boolean        @default(false)
  // ...
  identities            UserIdentity[]
  refreshTokens         RefreshToken[]
  memberships           WorkspaceMember[]
}

model UserIdentity {
  id             String    @id @default(cuid())
  userId         String
  provider       String    // "google" | "apple"
  providerUserId String    // Provider's stable subject ID (sub)
  email          String?   // Provider email (or Apple private relay)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([userId])
  @@index([provider, email])
}
```

### 2.2 Account Linking & User Resolution Protocol

Every callback first verifies the flow (§6) and the provider's ID token, then:

1. **Explicit linking (Settings → Connect).** The flow carries the signed-in user's id (sealed server-side, never a URL parameter). The identity is attached to that user; if it already belongs to someone else the browser returns to Settings with `?oauth_error=oauth_account_linked_to_other`. No session is issued.
2. **Existing identity.** `(provider, providerUserId)` matches a `UserIdentity` → that user.
3. **Link by verified email.** Only when the ID token says the email is verified (`email_verified === true`, or `"true"` from Apple). Missing email → `oauth_email_required`; unverified → `oauth_email_unverified`.
   - If the matching account's own email was **never verified**, it may have been pre-registered by someone else waiting for the real owner to arrive. Since the provider just proved inbox ownership, that account's password is cleared and its sessions revoked before linking. The owner signs in with Google/Apple or a magic link from then on.
4. **New account.** Verified, passwordless, with the identity attached.

Identity/user creation runs in a transaction; a concurrent duplicate callback resolves to the winning row instead of failing.

**The session goes through `AuthService.signInWithFederatedIdentity`**, the same gate as password and magic-link sign-in. An account with two-factor on gets a challenge, not a session: the browser lands on `/login#two_factor=<token>&expires_at=…` (fragment, so it never reaches a server log) and the login page shows the code step.

Destination after sign-in: desktop handoff → `/login?desktop=true&state=…&code_challenge=…` (the login page mints the one-time desktop code); invitation → `/invite/<token>`; otherwise the sanitized `returnTo`, or `/`.

---

## 3. Google (Authorization Code + PKCE + OIDC)

- Scopes `openid email profile`; `code_challenge_method=S256`; a per-flow `nonce`.
- `GET /api/v1/auth/google/url` → `{ url }` and sets the flow cookie. The SPA navigates to `url` in the same browser.
- `GET /api/v1/auth/google/callback` → code exchange at `https://oauth2.googleapis.com/token` with the `code_verifier`, then the returned `id_token` is verified against Google's JWKS (RS256, issuer, audience = `GOOGLE_CLIENT_ID`, expiry, nonce). Profile data comes from the verified token; there is no separate userinfo call.

## 4. Sign in with Apple

- `GET /api/v1/auth/apple/url` → `{ url }` with `response_type=code`, `response_mode=form_post`, `scope=name email`, and a `nonce`.
- `POST /api/v1/auth/apple/callback` (form post) → the `code` is exchanged at `https://appleid.apple.com/auth/token` using a 5-minute ES256 client secret signed with the team key (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`). The returned `id_token` is verified against Apple's JWKS (RS256, issuer `https://appleid.apple.com`, audience = `APPLE_CLIENT_ID`, expiry, nonce). An `id_token` posted by the browser is never trusted.
- Apple sends the user's name only on the first authorization, in the `user` form field; it is used when the account is created. Private-relay addresses work like any other verified email.
- All four Apple variables are required; with any missing, Apple is reported as unavailable.

`GET /api/v1/auth/oauth/providers` → `{ google: boolean, apple: boolean }` lets the UI hide a provider the server has no credentials for.

---

## 5. Electron Desktop Application Flow

```mermaid
sequenceDiagram
    autonumber
    participant Desktop as Electron App
    participant Browser as System Browser
    participant API
    participant Provider as Google / Apple

    Desktop->>Browser: open webApp/login?desktop=true&state=S&code_challenge=C
    Browser->>API: GET /auth/google/url?desktop=true&state=S&code_challenge=C
    API-->>Browser: { url } + flow cookie (holds S, C)
    Browser->>Provider: consent
    Provider->>API: callback (code, state)
    API-->>Browser: 302 webApp/login?desktop=true&state=S&code_challenge=C (+ refresh cookie)
    Browser->>API: POST /auth/desktop/authorize (signed-in browser)
    Browser->>Desktop: onetab://auth/callback?code=…&state=S
    Desktop->>API: POST /auth/desktop/exchange { code, codeVerifier, state }
```

If the account has two-factor on, step 6 lands on the code step first and the handoff continues once it is completed.

---

## 6. Security Controls & Defenses

| Threat | Defense |
|---|---|
| **Login CSRF / forged callbacks** | The flow (state, nonce, PKCE verifier, return path, desktop handoff, link target) is sealed with AES-256-GCM (key derived via HKDF from `JWT_ACCESS_SECRET`) into the httpOnly `onetab_oauth` cookie, scoped to `/api/v1/auth`. The callback requires that cookie and a constant-time match on `state`, so a callback URL replayed in another browser fails. |
| **PKCE verifier leakage** | The verifier lives only in the sealed cookie; the provider and the address bar only ever see the challenge. |
| **Replay** | The flow cookie is cleared by the first callback and expires after 10 minutes; codes are single-use at the provider. |
| **Forged / substituted ID tokens** | Mandatory RS256 signature check against the provider's JWKS (unknown `kid` → one refetch, then reject), plus issuer, audience, expiry, issued-at and nonce. Any failure → `oauth_invalid_token`. |
| **Two-factor bypass** | Federated sign-in uses the same 2FA challenge gate as password and magic link. |
| **Account takeover via email** | Auto-linking requires a provider-verified email; linking into an unverified local account clears its password and sessions first. |
| **Open redirects** | `returnTo` accepts only same-origin paths (`/x`, never `//x` or `/\x`) or absolute URLs on `WEB_APP_URL`. |
| **Apple form_post vs SameSite** | In production the flow cookie is `SameSite=None; Secure` so Apple's cross-site POST carries it; it is useless without the matching `state`. Development uses `Lax` (Google only, since Apple needs HTTPS). |
| **Lockout** | An identity cannot be disconnected when it is the only sign-in method (no password, no other identity). |
| **Secrets** | No client secret or Apple key reaches the browser; all exchanges are server-side. |

---

## 7. Account Settings & Identity Management

Under **Workspace Settings -> Security -> Sign-in Methods**:
- Shows connected status for **Email & Password**, **Google**, and **Apple**.
- Users can click **Connect** to link a new provider to their existing profile.
- Users can click **Disconnect** to remove a provider identity.
- Disconnecting is disabled with a helpful tooltip/message if the identity is the user's only remaining sign-in method.

### Endpoints
- `GET /api/v1/auth/{google|apple}/link/url` (bearer-authenticated): returns the provider URL for linking and seals the caller's user id into the flow cookie. The provider returns to the settings page with `?linked=<provider>` or `?oauth_error=<code>`.
- `GET /api/v1/auth/identities`: returns list of connected provider identities for the authenticated user.
- `DELETE /api/v1/auth/identities/:provider`: disconnects the specified provider identity with lockout protection.

---

## 8. Environment Setup Guide

### 8.1 Google Cloud Console Setup

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create or select your project.
3. Configure the **OAuth consent screen** (User Type: External, Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`).
4. Under **Credentials**, click **Create Credentials -> OAuth client ID** (Application type: *Web application*).
5. Add Authorized redirect URIs:
   - Local: `http://localhost:3000/api/v1/auth/google/callback`
   - Production: `https://api.yourdomain.com/api/v1/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** into `.env`:
   ```bash
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_AUTH_REDIRECT_URI="http://localhost:3000/api/v1/auth/google/callback"
   ```

### 8.2 Apple Developer Setup

1. Log in to [Apple Developer Account](https://developer.apple.com/account/resources/identifiers/list).
2. **App ID / Service ID**:
   - Create an App ID for your primary application if not already created.
   - Go to **Identifiers -> Services IDs** and create a new Service ID (e.g. `ai.onetab.auth.service`).
   - Enable **Sign in with Apple**, click **Configure**, set your primary App ID, and add your web domain and return URLs:
     - Return URL: `https://api.yourdomain.com/api/v1/auth/apple/callback` (or ngrok/tunnel for local development, as Apple requires HTTPS for web callbacks).
3. **Private Key**:
   - Go to **Keys** -> create a new key, check **Sign in with Apple**, and associate it with your primary App ID.
   - Download the `.p8` private key file (note: Apple only allows downloading this once).
   - Note down the **Key ID** (10 characters) and your Apple **Team ID** (found in membership details).
4. Add credentials to `.env`:
   ```bash
   APPLE_CLIENT_ID="ai.onetab.auth.service"
   APPLE_TEAM_ID="ABC123XYZ0"
   APPLE_KEY_ID="DEF456UVW1"
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   APPLE_AUTH_REDIRECT_URI="https://api.yourdomain.com/api/v1/auth/apple/callback"
   ```
