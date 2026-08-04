# @org/web-profile

The signed-in user profile screen.

## Design

Empty strings from the form are converted to `null` before submitting, because the API models a cleared optional field as null rather than an empty string.

## Surface

- `ProfilePage` — name, display name, bio, timezone and avatar.

## Notes

The avatar falls back to a deterministic tinted initials avatar derived from the user id.

## Commands

```sh
nx lint @org/web-profile
nx typecheck @org/web-profile
```
