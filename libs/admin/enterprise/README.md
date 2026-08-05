# @org/admin-enterprise

Organization-wide governance screens for the admin console: the enterprise
dashboard, SSO configuration and the audit log.

## Why it is `scope:admin`

These screens answer questions about the *organization*, not about the
workspace someone happens to have open — seat licensing, identity provider
configuration, who changed what across every workspace. They were originally
routed inside the web app under `/w/:workspaceSlug/enterprise`, which put
tenant-wide administration behind a workspace-scoped URL and showed it to every
member of that workspace.

Moving them here makes the audience explicit: the admin console is internal, so
the boundary is enforced by `@nx/enforce-module-boundaries` rather than by a
role check that a future route could forget.

## Surface

| Export                    | Screen                                        |
| ------------------------- | --------------------------------------------- |
| `EnterpriseDashboardView`  | Seats, departments, security posture, billing |
| `SSOConfigView`            | Identity provider and SAML/OIDC configuration |
| `AuditLogView`             | Cross-workspace audit trail                   |

The views render static content today; they gain their data when the
platform-admin API surface lands.
