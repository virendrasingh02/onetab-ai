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
        State[HMAC-SHA256 State & PKCE Engine]
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

When a user completes an OAuth flow (Google or Apple):

1. **Explicit Linking (Authenticated User):**
   - If the OAuth initiation was triggered from Account Settings (`linkUserId` present in HMAC state), the provider identity is directly linked to the current logged-in user.
   - If the provider account is already linked to a *different* user, the system rejects the operation with `409 Conflict` (`oauth_already_linked`).

2. **Existing Identity Match:**
   - The database is queried for `UserIdentity` matching `(provider, providerUserId)`.
   - If found, the corresponding user is signed in immediately.

3. **Automatic Account Linking by Verified Email:**
   - If no `UserIdentity` exists yet, the system checks whether a user already exists with the matching email.
   - **Crucial Security Requirement:** Automatic linking *only* occurs if the provider explicitly verifies the email (`email_verified === true` for Google; Apple identity tokens signed by Apple with verified email claims).
   - A new `UserIdentity` row is created linked to the existing `User`. Profile metadata (such as avatar or missing name) is optionally backfilled without overwriting existing user data.

4. **New User Registration:**
   - If no existing user matches the verified email, a new `User` is created with `emailVerified = true`, `passwordHash = null`, and the provider `UserIdentity` is attached.
   - If an `invitationToken` is present in the state, the user is automatically added to the target workspace and redirected to the workspace.
   - Otherwise, the user completes the standard onboarding/workspace creation flow.

---

## 3. Google OAuth 2.0 Implementation (PKCE Flow)

### 3.1 Flow Details

- **Protocol:** Authorization Code Flow with PKCE (Proof Key for Code Exchange, S256).
- **Scopes:** `openid email profile`.
- **Endpoints:**
  - `GET /api/v1/auth/google` (or `GET /api/v1/auth/google/url` for SPA JSON response): generates PKCE verifier/challenge, signed HMAC state, and returns Google's authorization URL.
  - `GET /api/v1/auth/google/callback`: receives Google's authorization code and state parameter.
- **Verification:**
  1. Validates the state parameter HMAC signature and freshness (10-minute TTL).
  2. Ensures the state token has not been previously redeemed (replay defense).
  3. Exchanges the code with Google's token endpoint (`https://oauth2.googleapis.com/token`) passing `code_verifier`.
  4. Fetches and validates the user profile from `https://www.googleapis.com/oauth2/v3/userinfo`.
  5. Enforces `email_verified === true`.

---

## 4. Sign in with Apple Implementation

### 4.1 Flow Details

- **Protocol:** Sign in with Apple REST API (authorization code exchange & identity token validation).
- **Response Modes:** Supports `form_post` (Apple default for web) and standard GET redirects.
- **Client Secret Generation:** Apple requires a signed ES256 JWT using an Apple Developer private key (`.p8` file), signed with Team ID, Key ID, and Client ID (Service ID).
  - Implemented natively using Node.js `crypto.createSign('SHA256')` with `dsaEncoding: 'ieee-p1363'`.
- **Endpoints:**
  - `GET /api/v1/auth/apple` (or `GET /api/v1/auth/apple/url`): initiates flow with signed state and `response_mode=form_post`.
  - `POST /api/v1/auth/apple/callback`: receives Apple's POST callback containing `code`, `id_token`, `state`, and optional first-login `user` payload.
  - `GET /api/v1/auth/apple/callback`: handles GET fallbacks.
- **First-Time Authorization & Private Relay:**
  - Apple only sends the user's name during the *first* sign-in. This payload is parsed and saved immediately.
  - Supports Apple Private Relay addresses (`*@privaterelay.appleid.com`).
  - Identity tokens are verified against Apple's live JWKS keys (`https://appleid.apple.com/auth/keys`), checking signature, issuer (`https://appleid.apple.com`), and audience (`APPLE_CLIENT_ID`).

---

## 5. Electron Desktop Application Flow

Desktop applications must never store client secrets or expose tokens directly in webviews.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Desktop as Electron App
    participant Browser as System Default Browser
    participant API as Platform NestJS API
    participant Provider as Google / Apple

    User->>Desktop: Click "Continue with Google"
    Desktop->>Desktop: Generate PKCE (code_verifier, code_challenge, state)
    Desktop->>Browser: shell.openExternal(webAppUrl/login?desktop=true&state=...&code_challenge=...)
    Browser->>API: GET /auth/google?desktop=true&state=...&code_challenge=...
    API->>Browser: 302 Redirect to Provider Auth URL (with state containing desktop handoff)
    Browser->>Provider: User completes consent
    Provider->>API: 302 Redirect /auth/google/callback?code=...&state=...
    API->>API: Resolve user & mint one-time desktop handoff code (DesktopAuthService)
    API->>Browser: 302 Redirect to onetab://auth/callback?code=HANDOFF_CODE&state=DESKTOP_STATE
    Browser->>Desktop: OS forwards onetab:// deep link to Electron
    Desktop->>API: POST /auth/desktop/exchange { code, codeVerifier, state }
    API-->>Desktop: 200 OK { accessToken, refreshToken, user }
    Desktop->>Desktop: Store session securely & transition to authenticated view
```

---

## 6. Security Controls & Defenses

| Threat | Defense Implementation |
|---|---|
| **CSRF / State Manipulation** | State tokens are serialized JSON containing nonce, timestamp, provider, and destination, signed with an HMAC-SHA256 signature using the server secret (`JWT_ACCESS_SECRET`). |
| **State Replay Attacks** | State tokens are stored in an in-memory single-use cache (`redeemedStates`). Re-submitting the same state parameter produces an immediate `400 Bad Request`. |
| **State Expiration** | State tokens expire after 10 minutes (`OAUTH_STATE_TTL_MS = 600_000`). |
| **Open Redirects** | The `returnTo` parameter is sanitized via `sanitizeReturnTo`: only relative paths starting with a single `/` (rejecting `//`) or URLs strictly matching `WEB_APP_URL` are permitted. |
| **Account Takeover via Unverified Email** | Automatic account linking is blocked unless `email_verified` is true from Google or verified in Apple's signed identity token. |
| **Single Sign-in Method Lockout** | In `disconnectIdentity`, the backend verifies that the user has at least one other active sign-in method (either a set password or another connected identity) before allowing disconnection. |
| **Credential Exposure in Frontend** | Zero client secrets or Apple private keys are bundled or exposed to frontend code. All code exchanges occur strictly server-side. |

---

## 7. Account Settings & Identity Management

Under **Workspace Settings -> Security -> Sign-in Methods**:
- Shows connected status for **Email & Password**, **Google**, and **Apple**.
- Users can click **Connect** to link a new provider to their existing profile.
- Users can click **Disconnect** to remove a provider identity.
- Disconnecting is disabled with a helpful tooltip/message if the identity is the user's only remaining sign-in method.

### Endpoints
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
