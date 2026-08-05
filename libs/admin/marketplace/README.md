# @org/admin-marketplace

The seven storefronts, the marketplace landing page and the plugin developer
console, as catalogue administration.

## What changed when this moved out of the web app

The screens are the same; the verb is not. In the web app a storefront was a
browse-filter-**install** loop, and every install targeted the workspace the
user had open. `scope:admin` cannot depend on `@org/web-workspace`, and more to
the point the console has no workspace to install into — so the install half of
the loop is gone rather than stubbed:

- `useInstallListing`, `useUninstallListing`, `useSetInstallationEnabled`,
  `useInstallations` and `useAddReview` are not ported. They all addressed
  `/marketplace/workspaces/:id/installations`.
- `ListingCard`'s `onInstall` / `onUninstall` are now optional. Without them the
  card shows the listing's platform-wide install count in place of the button,
  so a card never offers an action it cannot perform.
- `Storefront` lost its `grantedScopes` prop, which existed only to describe an
  install.
- `MarketplaceHomeView` replaced "Installed in this workspace" with adoption per
  storefront, and its tiles read `installCount` (platform-wide) rather than
  `installedHere` — which the API leaves at zero when no workspace is passed.

Installing from the catalogue remains a web-app concern. If a workspace ever
needs to be managed from the console, it should arrive as an explicit
workspace picker feeding the workspace id in, not as an implicit "current
workspace".

## Routes

Storefront links are console-absolute (`/marketplace/themes`), not nested under
`/w/:workspaceSlug/...` as they were in the web app.
