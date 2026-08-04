# @org/config

Environment schema and validation.

## Design

Validated once at boot so a missing or malformed variable fails immediately with a readable message listing every problem at once, rather than surfacing later as a confusing runtime error.

## Surface

- `apiEnvSchema` / `validateApiEnv()` — wired into `ConfigModule.forRoot({ validate })`.
- `parseCorsOrigins()` — turns the comma-separated allowlist into an array.

## Notes

Add new variables here first; the API refuses to start without them.

## Commands

```sh
nx lint @org/config
nx typecheck @org/config
```
