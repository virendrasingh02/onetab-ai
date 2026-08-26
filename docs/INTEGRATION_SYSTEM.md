# Multi-App API Integration System Documentation

This document provides a comprehensive developer and operational guide for OneTab AI's **Multi-App API Integration System**.

---

## 1. Architectural Overview

The system uses a layered provider-adapter architecture connecting frontend applications to external services through standardized protocols:

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend Layer                        │
│   Integration Hub UI, Gmail Viewer, Custom API Modal       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST
┌──────────────────────────────▼──────────────────────────────┐
│                    Backend API Gateway                      │
│   IntegrationsController & WebhooksController               │
│   (Guarded by WorkspaceRoleGuard & User Ownership)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  Integration Core Layer                     │
│   ├── IntegrationManagerService (Provider Registry)         │
│   ├── IntegrationEncryptionService (AES-256-GCM)            │
│   ├── SSRFGuardService (Private IP / DNS Validator)         │
│   ├── OAuthService (CSRF State / PKCE)                      │
│   ├── WebhookService (HMAC & Idempotency Deduplication)     │
│   ├── IntegrationSyncService (Queue Worker & Backoff)       │
│   └── IntegrationLoggerService (Redaction & Audits)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     Provider Adapters                       │
│   ├── GmailProvider (Google OAuth2 + Gmail API v1)          │
│   ├── CustomApiProvider (Generic REST + SSRF Shield)        │
│   ├── OneTabAppProvider (Internal platform bridge)          │
│   └── [Future: Slack, Notion, MS 365, CRM Adapters]         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      External Services                      │
│   Google Workspace, External REST Endpoints, Webhooks       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Security Architecture

### A. Application-Level Token Encryption
- **Algorithm**: `AES-256-GCM` with a 32-byte key derived via `SHA-256` from `ENCRYPTION_KEY` or `JWT_ACCESS_SECRET`.
- **Payload Format**: `ivHex:authTagHex:ciphertextHex` (12-byte random IV, 16-byte authentication tag).
- **Masking**: Secrets are masked on all read endpoints (`••••••••1234`), ensuring raw credentials are never sent to the browser or logged.

### B. SSRF Protection (`SSRFGuardService`)
All external URLs pass through strict SSRF validation prior to HTTP dispatch:
- Validates protocol: only `http:` and `https:` permitted.
- Rejects loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and private RFC 1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Blocks cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).
- Performs DNS resolution to detect and prevent DNS rebinding attacks.

### C. OAuth 2.0 State Security
- State parameters are signed with an `HMAC-SHA256` signature embedding a timestamp, nonce, workspaceId, and userId.
- Validated with a 10-minute TTL and timing-safe comparison to prevent CSRF attacks.

### D. Webhook Verification & Idempotency
- Validates `HMAC-SHA256` signatures against configured webhook secrets.
- Prevents duplicate event replay via unique constraints in `IntegrationWebhookEvent`.

---

## 3. Database Schema

- **`ExternalIntegration`**: Stores connection status, scopes, encrypted access/refresh tokens, metadata, and sync tracking.
- **`IntegrationWebhookEvent`**: Stores incoming webhooks with status (`RECEIVED`, `PROCESSED`, `DUPLICATE`, `FAILED`) for deduplication and audit.
- **`IntegrationSyncJob`**: Tracks asynchronous background sync execution, processed count, cursors, and retry backoff.
- **`IntegrationAuditLog`**: Structured, sanitized log of integration actions, latency, and status.

---

## 4. API Endpoints Reference

### Connections & Discovery
- `GET /api/v1/workspaces/:workspaceId/integrations`: List active workspace and user integrations.
- `GET /api/v1/workspaces/:workspaceId/integrations/providers`: List available provider capabilities.
- `GET /api/v1/workspaces/:workspaceId/integrations/:id`: Retrieve single integration detail.
- `POST /api/v1/workspaces/:workspaceId/integrations/:provider/connect`: Initiate OAuth connection URL or save Custom API configuration.
- `POST /api/v1/workspaces/:workspaceId/integrations/:id/disconnect`: Revoke and disconnect an integration.
- `POST /api/v1/workspaces/:workspaceId/integrations/:id/sync`: Trigger manual synchronization.
- `GET /api/v1/workspaces/:workspaceId/integrations/:id/jobs`: List background sync jobs.

### Public OAuth & Webhooks
- `GET /api/v1/integrations/:provider/callback`: Public callback endpoint for OAuth code exchange.
- `POST /api/v1/webhooks/:provider`: Ingest external provider webhooks with HMAC validation.

### Normalized Email & Messaging
- `GET /api/v1/workspaces/:workspaceId/integrations/:id/messages`: List normalized messages (`?q=...&pageToken=...`).
- `GET /api/v1/workspaces/:workspaceId/integrations/:id/threads/:threadId`: Retrieve full message thread.
- `POST /api/v1/workspaces/:workspaceId/integrations/:id/messages`: Send an email or message.
- `POST /api/v1/workspaces/:workspaceId/integrations/:id/reply`: Reply to an email or thread.
- `POST /api/v1/workspaces/:workspaceId/integrations/:id/drafts`: Save draft email.
- `PATCH /api/v1/workspaces/:workspaceId/integrations/:id/messages/:messageId/labels`: Update read or star labels.

### Custom API Connector
- `POST /api/v1/workspaces/:workspaceId/integrations/custom/test`: Test custom API endpoint with SSRF check.
- `POST /api/v1/workspaces/:workspaceId/integrations/:id/custom/execute`: Secure backend proxy for executing HTTP requests against the external API.

---

## 5. Developer Guide: Adding a New Provider Adapter

To add a new provider (e.g. `Slack`, `Notion`, `Microsoft 365`):

1. **Implement `ProviderAdapter`**:
```typescript
import { Injectable } from '@nestjs/common';
import type { ProviderAdapter, ResolvedCredential, SyncResult, TokenResult } from '../core/provider-adapter.interface.js';
import type { IntegrationCapabilities } from '@org/types';

@Injectable()
export class NotionProvider implements ProviderAdapter {
  readonly providerId = 'NOTION';

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Notion',
      description: 'Sync docs and databases with Notion.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
    };
  }

  async getAccount(credential: ResolvedCredential) { /* ... */ }
  async sync(credential: ResolvedCredential, cursor?: string): Promise<SyncResult> { /* ... */ }
  async disconnect(credential: ResolvedCredential): Promise<void> { /* ... */ }
  async handleWebhook(payload: unknown, headers: Record<string, string>) { /* ... */ }
  async testConnection(config: Record<string, unknown>) { /* ... */ }
}
```

2. **Register in `IntegrationManagerService` and `IntegrationsModule`**:
Add `NotionProvider` to module providers and inject it in `IntegrationManagerService.onModuleInit()`.

---

## 6. Google Cloud Setup Guide (Gmail OAuth 2.0)

### Development Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project: `OneTab AI Development`.
3. Enable the **Gmail API** in `APIs & Services > Library`.
4. Configure the **OAuth consent screen**:
   - User Type: `External` (or `Internal` for Google Workspace domain).
   - Scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Add test user email addresses under "Test users".
5. Create **OAuth 2.0 Client ID**:
   - Application type: `Web application`.
   - Name: `OneTab AI Dev Client`.
   - Authorized JavaScript origins: `http://localhost:4200`, `http://localhost:3000`.
   - Authorized redirect URIs: `http://localhost:3000/api/v1/integrations/gmail/callback`.
6. Copy Client ID and Client Secret into `.env`:
   ```bash
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/v1/integrations/gmail/callback"
   ```

### Production Setup
1. Submit the Google Cloud OAuth app verification for restricted scopes (`gmail.readonly`, `gmail.send`).
2. Update Authorized origins to production domain (e.g. `https://app.onetab.ai`).
3. Set `GOOGLE_REDIRECT_URI="https://api.onetab.ai/api/v1/integrations/gmail/callback"`.
