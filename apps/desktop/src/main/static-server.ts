import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

/**
 * Serves the built web app over `http://localhost:<port>` inside the packaged
 * desktop app.
 *
 * Loading `file://` would be simpler, but it breaks three things the web app
 * depends on: history-mode routing 404s on reload, `localStorage` is scoped to
 * an opaque origin, and — the fatal one — the API's refresh token is an
 * httpOnly `SameSite` cookie, which the browser will not attach to a request
 * coming from a `file://` or custom-scheme page. Serving from `localhost`
 * makes the desktop renderer same-site with the API on `localhost:3000`, so
 * auth behaves exactly as it does in the browser.
 *
 * The port range mirrors the API's dev CORS allowlist (4200–4209), so no server
 * config has to change for the desktop build to talk to a local API.
 */
export const PORT_RANGE_START = 4200;
export const PORT_RANGE_LENGTH = 10;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

function resolveWithinRoot(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const candidate = resolve(join(root, normalize(decoded)));

  // Reject anything that escapes the bundle directory via `..` traversal.
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;

  return candidate;
}

function listen(server: Server, port: number): Promise<boolean> {
  return new Promise((done) => {
    const onError = () => {
      server.removeListener('listening', onListening);
      done(false);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      done(true);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    /*
     * Bound by name, not to `127.0.0.1`.
     *
     * `localhost` resolves to `::1` before `127.0.0.1` on Windows, so an
     * IPv4-only bind leaves the renderer unable to reach a server that
     * nonetheless *reports* itself as `http://localhost:<port>` — and the
     * in-use probe misses an IPv6-only listener (a running Vite, say) and hands
     * back a port that is not actually free. Using the same name here as in the
     * returned origin keeps the two in agreement, and `localhost` never
     * resolves off-machine, so this stays loopback-only.
     */
    server.listen(port, 'localhost');
  });
}

export async function startStaticServer(root: string): Promise<StaticServer> {
  const rootDir = resolve(root);

  const server = createServer((request, response) => {
    const urlPath = request.url ?? '/';
    const file = resolveWithinRoot(rootDir, urlPath);

    if (file) {
      const type = MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
      // Hashed asset filenames make long-lived caching safe; index.html is
      // served through the SPA fallback below and stays uncached.
      response.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      createReadStream(file).pipe(response);
      return;
    }

    // SPA fallback: any unknown path is a client route, not a missing asset.
    const indexHtml = join(rootDir, 'index.html');
    if (!existsSync(indexHtml)) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Web bundle is missing. Run `nx build @org/web` first.');
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    createReadStream(indexHtml).pipe(response);
  });

  for (let offset = 0; offset < PORT_RANGE_LENGTH; offset += 1) {
    const port = PORT_RANGE_START + offset;
    if (await listen(server, port)) {
      return {
        origin: `http://localhost:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      };
    }
  }

  throw new Error(
    `No free port in ${PORT_RANGE_START}–${PORT_RANGE_START + PORT_RANGE_LENGTH - 1} to serve the desktop UI.`,
  );
}
