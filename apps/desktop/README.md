# @org/desktop

Electron shell for the OneTab AI web app.

```bash
npm run dev:desktop      # API + Vite + Electron
nx serve @org/desktop    # Electron against an already-running Vite
nx package @org/desktop  # installers into apps/desktop/release
```

Architecture, the browser-vs-desktop capability table, and the two production
prerequisites (refresh-cookie policy and CORS) are in
[`docs/desktop-app.md`](../../docs/desktop-app.md).
