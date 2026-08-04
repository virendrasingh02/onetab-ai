# @org/web-invitations

Sending, revoking and accepting workspace invitations.

## Design

The invite field accepts a pasted block of addresses and splits on commas, semicolons and newlines, because that is how people actually paste a list.

## Surface

- `useInvitations`, `useInvitationMutations`, `useAcceptInvitation`.
- `InvitationsPage` — compose and manage pending invitations.
- `AcceptInvitationPage` — the `/invite/:token` landing page.

## Notes

Outside production the API returns invite tokens in the response and the UI surfaces them, because no mail transport exists yet. Acceptance is guarded against double-submit under StrictMode.

## Commands

```sh
nx lint @org/web-invitations
nx typecheck @org/web-invitations
```
