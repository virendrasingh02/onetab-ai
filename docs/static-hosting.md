# Hosting the web builds

`apps/web/dist`, `apps/admin/dist` and `apps/ai-agent-studio/dist` are static
sites. `docker/nginx/nginx.conf` only proxies to the API, so whatever serves them
needs the behaviour below. `vite preview` (and so `npm run share`) already does
this through `scripts/vite-production.mts`; use it to compare.

## What the build produces

- Content-hashed files in `assets/`, and an `index.html` that names them.
- A `.br` and a `.gz` beside each JS, CSS, SVG, JSON, WASM, HTML and text file over
  1 KB. The originals stay, for clients that accept neither.
- No sourcemaps. With `GENERATE_SOURCEMAP=true` they are hidden and moved to a
  sibling `dist-sourcemaps/` folder. Upload that to your error tracker and do not
  deploy it.

## Required responses

| Request                     | `Cache-Control`                       | Notes                                                 |
| --------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `/assets/*`                 | `public, max-age=31536000, immutable` | A miss must be a real 404, never `index.html`         |
| `index.html` and SPA routes | `no-cache`                            | Otherwise clients ask for chunks a deploy has removed |
| Everything else             | `no-cache`                            | `emojibase/`, `favicon.ico` and others are not hashed |

For a precompressed file, send `Content-Encoding: br` or `gzip`, the type of the
original file (`text/javascript`, not `application/x-gzip`), and
`Vary: Accept-Encoding`. Do not compress it again.

Also send `frame-ancestors 'none'` or `X-Frame-Options: DENY`; the CSP in the web
app's `index.html` is a `<meta>` tag, which cannot carry that directive.

## nginx

`brotli_static` needs the `ngx_brotli` module. Without it, `gzip_static` alone
still works and serves the `.gz` files.

```nginx
server {
  root /srv/onetab/web;

  gzip_static on;
  brotli_static on;
  # Types the precompressed files do not cover still get compressed on the fly.
  gzip on;
  gzip_vary on;
  gzip_types text/plain text/css application/json application/javascript image/svg+xml application/wasm;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header Vary "Accept-Encoding" always;
    try_files $uri =404;
  }

  location / {
    add_header Cache-Control "no-cache" always;
    add_header Vary "Accept-Encoding" always;
    try_files $uri /index.html;
  }
}
```

## CDNs

Cloudflare, CloudFront and similar compress for you, and usually fetch from the
origin with their own `Accept-Encoding`. Keep the origin's `Vary` header, and do
not purge `/assets/` on deploy: those URLs change whenever their content does.
Purge or revalidate `index.html` only.

## Desktop

The desktop installer ships the same `apps/web/dist`, minus maps and compressed
copies (`extraResources.filter` in `apps/desktop/electron-builder.json`). It reads
from disk through its local static server, so compression would gain nothing.

## Checking a deployment

```bash
curl -sI -H 'Accept-Encoding: br' https://app.example.com/assets/<file>.js
```

Expect `content-encoding: br`, a `vary` with `Accept-Encoding`, and the immutable
`cache-control`. Then `node scripts/analyze-bundles.mjs --budget` after a build
checks the sizes, and that no sourcemaps or lazy libraries reached the entry.
