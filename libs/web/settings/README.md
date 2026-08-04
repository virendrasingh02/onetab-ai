# @org/web-settings

User preferences and account security.

## Design

Notification toggles render disabled until the notification service exists — an editable control that silently does nothing would misrepresent the state of the system.

## Surface

- `SettingsPage` — theme selection, notification placeholders and change password.

## Notes

Changing a password revokes every session, which the UI states before submitting.

## Commands

```sh
nx lint @org/web-settings
nx typecheck @org/web-settings
```
