# @org/auth

Client-side authentication: store, session bootstrap, route guards and the four auth screens.

## Design

The access token lives in memory inside `@org/api-client`, never in this store and never in localStorage — an injected script must not be able to read it. A page reload recovers the session by exchanging the httpOnly refresh cookie.

## Surface

- `useAuthStore` — Zustand; holds the user and session status only.
- `useSessionBootstrap()` — restores the session on cold load; must run once at the app root.
- `<ProtectedRoute>` / `<PublicOnlyRoute>` — render a loader while status is `authenticating`, so a refresh does not bounce the user to /login.
- `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`.

## Notes

This library is imported statically by the app (guards run on first paint), so it is intentionally not lazy-loaded.

## Commands

```sh
nx lint @org/auth
nx typecheck @org/auth
```
