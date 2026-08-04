# @org/validation

Zod schemas shared by the browser and the API.

## Design

One source of truth for every input rule. The API validates with the same objects through `ZodValidationPipe`, so a rule cannot drift between client and server.

## Surface

- `auth.schema` — login, register, forgot/reset/change password.
- `workspace.schema` — create/update, roles, invitations.
- `channel.schema` — create/update, visibility, members, pins.
- `profile.schema` — profile updates and upload constraints.

## Notes

Avoid `.default()` on form schemas: it makes input and output types diverge, which React Hook Form surfaces as an unassignable `control`. Supply defaults via `defaultValues` instead.

## Commands

```sh
nx lint @org/validation
nx typecheck @org/validation
```
