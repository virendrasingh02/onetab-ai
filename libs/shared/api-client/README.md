# @org/api-client

Typed HTTP client, endpoint functions and query keys.

## Design

Holds the in-memory access token and the 401 refresh interceptor. Concurrent 401s share a single refresh promise — refreshing N times in parallel would rotate the token N times and invalidate the session.

## Surface

- `http` — axios instance with `withCredentials` for the refresh cookie.
- `authApi`, `workspaceApi`, `channelApi`, `memberApi`, `invitationApi`, `userApi`.
- `queryKeys` — hierarchical keys so invalidating a subtree clears everything beneath it.
- `ApiError` / `toApiError` — normalised errors carrying `code` and field errors.

## Notes

Never persist the access token. The refresh token is an httpOnly cookie the browser attaches automatically.

## Commands

```sh
nx lint @org/api-client
nx typecheck @org/api-client
```
