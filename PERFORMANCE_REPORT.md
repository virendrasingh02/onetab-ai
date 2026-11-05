# Production build performance report

Measured 2026-11-04 on Windows 11, 20 threads, Node 26.13, Vite 8.3.5 (Rolldown 1.2.15),
Nx 23.1. Baseline is commit `e94b1a2`. Every number below comes from a build or a live
run; nothing is estimated. Reproduce with `npm run build`, then `npm run analyze:bundles`.

"Initial" means what must download before the app can run: `index.html`'s scripts and
stylesheets plus everything they statically import, walked with an ES module lexer.
Lazy chunks are not counted. Compressed sizes use gzip level 9 and Brotli quality 11.

## Results

| Metric                             | Target           | Result                                                      |
| ---------------------------------- | ---------------- | ----------------------------------------------------------- |
| Initial web JavaScript             | Under 1.2 MB     | **Met with Brotli (1.01 MB). Missed with gzip (1.25 MB).**  |
| Shiki grammars in the initial load | Zero             | Met: 0 (about 240 before)                                   |
| Public production sourcemaps       | Zero             | Met: 0 in every `dist` and in the desktop package           |
| Heavy libraries in initial chunks  | Zero             | Met for PDF, charts, editor, syntax, canvas. Matrix remains |
| PDF, charts, rich-text editor      | Lazy-loaded      | Met, confirmed in the browser                               |
| API bundle minimized               | No regressions   | Met: 9.15 MB to 5.60 MB, booted and exercised               |
| Brotli and gzip files              | Where applicable | Met for the build. **No production static host exists yet** |
| Duplicate dependencies             | Minimized        | Audited, none removed (see Remaining work)                  |

## What was wrong

**One line caused most of the bloat.** `manualChunks` ended in `return 'vendor'`. A chunk is
a single file, so every dynamic import target from `node_modules` was merged into one
13.1 MB file that the entry imported statically. That included all of Shiki's grammars
(8.56 MB of source), its themes (1.47 MB), Recharts and pdf.js. Web and admin downloaded
every grammar to show a sign-in form. The code already used `import()`; the chunk config
silently undid it.

Removing the catch-all exposed three more problems:

1. **Named chunks swallowed their dependencies.** `manualChunks` implies Rolldown's
   `includeDependenciesRecursively`, so `vendor-charts` absorbed `react` and `vendor-syntax`
   absorbed Vite's preload helper. Entries then imported both "lazy" chunks. The config now
   uses `codeSplitting` with that option off, which Rolldown requires to be paired with
   `strictExecutionOrder` and `preserveEntrySignatures: false`.
2. **Barrels kept heavy modules in the entry.** `@org/analytics-ui` and `@org/chat-ui` reach
   every app's entry, so Recharts and Lexical came along. Both now have a lazy boundary at
   the library's public export, which fixes all apps at once.
3. **Studio had no route splitting.** All 21 pages were static imports in `app.tsx`.

## Before and after

Sizes are MB. Files in parentheses.

### Initial JavaScript

| App    | Raw before | Raw after | Gzip before | Gzip after | Brotli before | Brotli after | Brotli change |
| ------ | ---------: | --------: | ----------: | ---------: | ------------: | -----------: | ------------: |
| Web    | 16.73 (14) | 4.58 (28) |        3.42 |       1.25 |          2.49 |         1.01 |          -59% |
| Admin  |  12.24 (6) | 1.83 (10) |        2.27 |       0.49 |          1.58 |         0.41 |          -74% |
| Studio |  6.81 (35) | 2.12 (15) |        1.77 |       0.59 |          1.40 |         0.48 |          -66% |

Web's initial file count rose from 14 to 28. They load in parallel from `modulepreload`, but
it is more requests over HTTP/1.1.

### Initial CSS

| App    | Raw before | Raw after | Gzip after | Brotli after |
| ------ | ---------: | --------: | ---------: | -----------: |
| Web    |       0.31 |      0.29 |       0.04 |         0.03 |
| Admin  |       0.20 |      0.20 |       0.03 |         0.02 |
| Studio |       0.31 |      0.31 |       0.04 |         0.03 |

CSS was already healthy. Tailwind v4 only emits classes it finds, so it was left alone.

### Whole build

| App    | `dist` before | `dist` after |     All JS raw |  All JS gzip | All JS Brotli |
| ------ | ------------: | -----------: | -------------: | -----------: | ------------: |
| Web    |    71.48 (76) |  40.54 (970) | 18.24 to 17.16 | 3.80 to 3.86 |  2.80 to 3.11 |
| Admin  |    37.35 (38) |  16.29 (799) | 12.96 to 11.74 | 2.40 to 2.37 |  1.68 to 1.91 |
| Studio |   27.99 (369) | 37.45 (1045) | 18.57 to 16.97 | 4.02 to 3.74 |  3.21 to 3.01 |

Two things here got worse, by design:

- **Total compressed JS rose for web and admin.** Many small grammar files compress less well
  than one large file. This is not a download anyone makes in full.
- **Studio's `dist` grew** because `.br` and `.gz` copies were added and it had no sourcemaps
  to remove. The `after` figures include those copies for all three apps.

### Chunks (raw / gzip / Brotli)

`*` means initial. These are the web build's named chunks.

| Chunk            | Contents                        |               Size | Loads when                     |
| ---------------- | ------------------------------- | -----------------: | ------------------------------ |
| `vendor-matrix`* | matrix-js-sdk and friends       | 0.93 / 0.22 / 0.18 | Entry                          |
| `vendor-ui`*     | Radix, Lucide, Motion, Sonner   | 0.28 / 0.09 / 0.06 | Entry                          |
| `vendor-react`*  | React, React DOM, Router        | 0.21 / 0.07 / 0.06 | Entry                          |
| `vendor-data`*   | TanStack, axios, Redux, Zustand | 0.14 / 0.04 / 0.04 | Entry                          |
| `vendor-forms`*  | React Hook Form, Zod            | 0.11 / 0.03 / 0.03 | Entry                          |
| `vendor-syntax`  | Shiki core, Oniguruma WASM      | 0.76 / 0.27 / 0.18 | First code block               |
| `vendor-pdf`     | pdf.js                          | 0.43 / 0.13 / 0.10 | Opening a PDF                  |
| `vendor-charts`  | Recharts, d3 scales and shapes  | 0.38 / 0.10 / 0.08 | First chart                    |
| `vendor-editor`  | Lexical                         | 0.31 / 0.10 / 0.08 | First composer                 |
| `vendor-flow`    | React Flow, its d3 packages     | 0.17 / 0.05 / 0.05 | Workspace shell, Studio canvas |

`vendor-misc` from the brief was not created. Anything without a named chunk goes to Rolldown,
which places it beside the imports that use it. A catch-all group is what caused the problem.

The largest app chunks in web's initial load are three `src-*` files (1.28, 0.61 and 0.49 MB
raw): workspace and chat screens, `@org/ui`, and shared types.

## Sourcemaps

| Target          | Before                             | After |
| --------------- | ---------------------------------- | ----: |
| Web             | 28 files, 41.69 MB                 |     0 |
| Admin           | 17 files, 24.17 MB                 |     0 |
| Studio          | 0                                  |     0 |
| API             | 1 file, 12.73 MB                   |     0 |
| Desktop `dist`  | 54 files                           |     0 |
| Desktop package | 28 files (web maps in `resources`) |     0 |

`GENERATE_SOURCEMAP=true` was tested on web, API and desktop:

- Web wrote 313 maps, all moved to `apps/web/dist-sourcemaps/` (gitignored). `dist` held 0, and
  no bundle carried a `sourceMappingURL`.
- API wrote a hidden `main.js.map` with no reference in `main.js`. It stays in `dist`, which
  is server-side only.
- Desktop wrote 54 maps. `tsc` has no hidden mode, so these keep their references, but packaging
  strips them regardless.

Development keeps its maps: Vite's dev server is unaffected, `build:development` for the API
keeps them, and `nx serve @org/desktop` now goes through a `build-dev` target.

The flag is in Nx's hash, so a cached build cannot return the wrong variant.

## Shiki

`createHighlighter` from the `shiki` bundle became `createHighlighterCore` from `shiki/core`,
keeping the installed 4.4.3.

- **Oniguruma stays the engine**, not the smaller JavaScript engine, so tokens match what users
  saw before. It costs about 0.18 MB Brotli, only when a code block appears.
- Nothing from Shiki loads until a block needs highlighting.
- First use loads the 14 core languages. Studio's `/widgets/new` loaded 15 grammar files
  (one is a dependency of another) and rendered 11 coloured tokens.
- Other languages load one at a time, with concurrent requests sharing a single load.
- Only 2 themes are emitted, down from the 65 available.
- A failed load no longer disables highlighting for the whole session.

**Grammars still exist on disk.** About 240 language chunks are emitted so that a block tagged
`haskell` or `lua` keeps highlighting as it does today. None are fetched unless asked for, but
they account for most of `dist`'s file count and ride along in the desktop package. A curated
list would remove them at the cost of plain text for unlisted languages. That is a product
decision, so it was not made here.

## API

`apps/api/webpack.config.js` now minifies in production through Nx's `optimization` flag, which
is Nx's own option and accepts a boolean. Webpack's own `optimization` object is then set by Nx,
and the `minimizer` inside it is replaced.

| Metric          |   Before |   After |
| --------------- | -------: | ------: |
| `main.js`       |  9.15 MB | 5.60 MB |
| `dist` total    | 21.88 MB | 5.60 MB |
| Cold build time |    3.5 s |   5.3 s |

Nx's default disables mangling. The custom minimizer shortens local names but keeps class and
function names, because Nest logger contexts and `this.constructor.name` use them. Property
names are never mangled, which protects route handlers and reflection metadata.

**Tree-shaking was not claimed or changed.** Nx sets webpack's mode to `none` for Node, and
`node_modules` are external, so the bundle is almost entirely first-party decorated code that
must not be dropped. The saving here is minification only.

The minified bundle was booted on port 3100 against the real database. It mapped 975 routes,
`/health` and `/ready` returned 200, and login, `/auth/me`, `/workspaces`, members and channels
all returned 200 with data. Logger names such as `[PrismaService]` stayed readable. The only
logged errors were 203 repeats of the Matrix homeserver being unreachable.

Production stack traces now have minified locals unless `GENERATE_SOURCEMAP=true` is used.

## Compression and caching

`vite-plugin-compression2` was not added. About 40 lines using `node:zlib` do the same job in
`scripts/vite-production.mts` with no dependency, and this repo already needs
`--legacy-peer-deps` to install.

Each JS, CSS, SVG, JSON, WASM, HTML and text file over 1 KB gets `.br` and `.gz` copies. A copy
that is not smaller is skipped, and originals stay. WASM was added beyond the brief: the 7.82 MB
Matrix crypto file drops to 1.45 MB.

Real responses from `vite preview`, using the same middleware as `npm run share`:

| Request                         | `Content-Encoding` | Size        | `Cache-Control`                       |
| ------------------------------- | ------------------ | ----------- | ------------------------------------- |
| JS, `Accept-Encoding: br, gzip` | `br`               | 58,254 B    | `public, max-age=31536000, immutable` |
| JS, `gzip`                      | `gzip`             | 67,329 B    | Same                                  |
| JS, `identity`                  | None               | 213,889 B   | Same                                  |
| JS, `br;q=0, gzip`              | `gzip`             | 67,329 B    | Same                                  |
| WASM, `br`                      | `br`               | 1,446,494 B | Same, `application/wasm`              |
| `index.html`, SPA routes        | None               | 6,774 B     | `no-cache`                            |

All compressed responses carried `Vary: Accept-Encoding` and the right `Content-Type`. The
Brotli body decoded byte for byte to the original file.

**Existing infrastructure.** `docker/nginx/nginx.conf` compresses API traffic with gzip but does
not serve the frontends at all, so there was no static host to configure and no live deployment
to test. `docker/` was left alone, as it has been off limits. `docs/static-hosting.md` has the
required headers and an nginx config, which has **not** been run.

## Desktop

| Metric                  |    Before |     After |
| ----------------------- | --------: | --------: |
| Installer               | 119.60 MB | 113.32 MB |
| `win-unpacked`          |    418 MB |    377 MB |
| `resources/web`         |     69 MB |     29 MB |
| `.map` in package       |        28 |         0 |
| `.br`, `.gz` in package |         - |         0 |

The installer shrinks far less than `resources/web` because most of it is the Electron runtime,
and maps compress well. Packaging took 171 s, up from 131 s, measured while other work was running.

The packaged app was launched from `win-unpacked` with a debugging port. It opened at
`http://localhost:4202/`, titled "Home — Onetab AI", and its local server returned the entry
chunk, `index.html` and the WASM file with 200s. The exit code 143 lines in its log are from the
test's own 25-second timeout.

## Build time and Nx

| Run                          | Before |          After |
| ---------------------------- | -----: | -------------: |
| Cold, 5 apps, `--parallel=3` | 33.5 s | 40.1 to 44.2 s |
| Warm, 5 of 5 cached          |      - |          3.1 s |

**Builds got about 25% slower.** Brotli quality 11 costs that, and the web build is now the
critical path. It is a one-off per deploy, and a warm run restores everything in 3 seconds,
compressed files included.

`scripts/vite-production.mts` and `GENERATE_SOURCEMAP` were added to Nx's `sharedGlobals`, so
changing either invalidates the cache. No memory problems were seen at `--parallel=3`.

Share a remote cache to avoid repeating cold builds in CI. That was not set up here.

## Lazy-loading checks

Tested against production builds in a real browser, through `vite preview` proxying to the
development API.

| Check               | Result                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Charts              | `vendor-charts` absent until `/settings/analytics`, then 2 Recharts surfaces drew                                                |
| PDF                 | No PDF files before opening. Then viewer, chunk and worker loaded, both pages rendered with thumbnails, page 2 navigation worked |
| Composer            | Lexical loaded with the first composer. Typing, the `/` menu and clearing all worked. Nothing was sent                           |
| Code blocks         | All 14 core languages pass in a real-grammar spec. Coloured tokens seen in Studio                                                |
| Studio canvas       | 3 nodes rendered on an existing agent, `vendor-flow` loaded                                                                      |
| Web routes (17)     | All loaded, no failed asset requests                                                                                             |
| Studio routes (22)  | All loaded, including the lazily hosted workspace pages                                                                          |
| Web console         | No Prism, chunk, hook or CSP errors after the fix. 503s were Matrix                                                              |
| Studio sign-in page | 16 assets, 513 KB transferred                                                                                                    |
| Admin sign-in page  | 11 assets, 430 KB transferred, API connected, no heavy chunks                                                                    |

## Other fixes

- **Inline theme script blocked on Windows builds (pre-existing).** The CSP hash covered
  `index.html`'s CRLF bytes, but browsers hash the script after normalizing newlines. The theme
  bootstrap was blocked in production. Verified fixed in the browser's reported hash.
- `apps/ai-agent-studio/tsconfig.spec.json` no longer includes `vite.config.mts`, matching web
  and admin, since it now imports a file outside the project.

## Tests

| Check                   | Result                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `typecheck`, 8 projects | Pass                                                                    |
| `lint`, 8 projects      | **1 error**, pre-existing, in `lexical-composer.tsx` (not changed here) |
| `analyze:bundles`       | All budgets met                                                         |
| New Shiki specs         | Pass                                                                    |
| `@org/ui`               | 274 of 275. `use-prompt-dialog` timed out under load, passes alone      |
| `@org/chat-ui`          | 224 of 238. 13 also fail on `e94b1a2`, 1 is timing (below)              |
| `@org/web-chat`         | 73 of 78. The same 5 fail on `e94b1a2`                                  |
| `@org/web`              | 38 of 41. `localStorage` is undefined under Node 26                     |
| Two more projects       | 137 of 137 and 166 of 166                                               |

The `chat-ui` timing failure is `markdown-message`'s hover test. It failed in full runs on this
branch but passes alone on both trees, 2 of 2 times each. The `@org/web` failures are in an
unchanged spec with the same `localStorage` error as `chat-ui`, but were not rerun on the baseline.

## Not verified

- **Admin past sign-in.** The only admin account's password is not a test credential, so admin
  charts were not opened in admin. They use the same `lazy-charts.tsx` proven in web.
- **Chat with messages.** The Matrix homeserver was unreachable, so sending, encrypted rooms, the
  WASM load and code blocks inside messages were not tested live.
- **The API behind the frontends** was the development build from another session. The minified
  API was tested separately with direct requests.
- **macOS and Linux desktop packages** were not built.
- **A real deployment.** No CDN or production host exists to check.
- **Circular dependencies** were not audited beyond what Rolldown and Nx reported.
- **Image optimization** had nothing to act on: `public/` holds a favicon and the emoji dataset.

## Remaining work, by value

1. **Lazy-load Matrix (0.18 MB Brotli, 0.22 gzip).** `MatrixProvider` mounts on every render, so
   signed-out pages load the SDK. Mounting it after sign-in would bring gzip under 1.2 MB, but it
   changes provider structure, so it was left for a deliberate change.
2. **Split `src-*` chunks.** `@org/web-chat` is static in `app.tsx` and `providers.tsx`, which keeps
   its screens in the entry. `sideEffects` markers on more libraries may help; only `chat-ui` has one.
3. **Keep `vendor-flow` off Home (0.05 MB).** `channel-nav` uses workflow hooks from the same
   `@org/web-automations` chunk as the canvas views.
4. **Decide on the grammar list** if the 300-file `dist` or installer size matters.
5. **Reduce dependency versions.** The lockfile has 263 of 2,296 packages at several versions.
   Relevant here: `zod` 3 and 4, `lucide-react` 0.469 and 1.28, `zustand` 4 and 5, and `axios`
   1.18 and 1.20. Each needs its own migration.
6. **Fix `docker/api.Dockerfile`.** It copies `dist/apps/api`, but the build writes to
   `apps/api/dist`, so that image cannot work as written. Left alone under the docker rule.
7. **Move the Google Fonts `@import`.** It sits after other rules, so browsers ignore it, and
   the build warns. `index.html` already links the fonts, so nothing is broken.

## Files changed

- **New:** `scripts/vite-production.mts`, `scripts/analyze-bundles.mjs`, `docs/static-hosting.md`,
  `apps/desktop/scripts/compile.mjs`, `lazy-charts.tsx`, `lazy-editors.tsx`, `composer-mentions.ts`,
  `core-pages.ts`, `code-block.highlight.spec.ts`
- **Build config:** the three `vite.config.mts`, `apps/api/webpack.config.js`,
  `apps/desktop/electron-builder.json`, `apps/desktop/package.json`, `nx.json`, `.gitignore`,
  `package.json`, `.claude/launch.json`, Studio's `tsconfig.spec.json`
- **Source:** `code-block.utils.ts`, the `analytics-ui` and `chat-ui` barrels, `charts.tsx` (one
  type export), `composer.tsx`, `chat-ui/package.json` (`sideEffects`), Studio's `app.tsx` and
  `studio-core-bridge.tsx`
