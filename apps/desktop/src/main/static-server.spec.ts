import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isAllowedHost,
  startStaticServer,
  type StaticServer,
} from './static-server.js';

const MARKER = 'MARKER_DESKTOP_BUNDLE';

let root: string;
let server: StaticServer;

function get(path: string) {
  return fetch(server.origin + path);
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'onetab-web-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(
    join(root, 'index.html'),
    `<!doctype html><body>${MARKER}</body>`,
  );
  writeFileSync(join(root, 'assets', 'app.css'), 'body{}');
  writeFileSync(
    join(root, 'assets', 'crypto.wasm'),
    Buffer.from([0, 0x61, 0x73, 0x6d]),
  );

  server = await startStaticServer(root);
});

afterAll(async () => {
  await server?.close();
});

describe('isAllowedHost', () => {
  it('accepts only this server, addressed by name', () => {
    expect(isAllowedHost('localhost:4200', 4200)).toBe(true);
    expect(isAllowedHost('127.0.0.1:4200', 4200)).toBe(true);
    expect(isAllowedHost('evil.example:4200', 4200)).toBe(false);
    expect(isAllowedHost('localhost:4201', 4200)).toBe(false);
    expect(isAllowedHost(undefined, 4200)).toBe(false);
  });
});

/** `fetch` refuses to set Host, so these go through `http.request`. */
function raw(options: { path?: string; host?: string; method?: string }) {
  const { port } = new URL(server.origin);
  return new Promise<number>((resolve, reject) => {
    const req = request(
      {
        host: 'localhost',
        port,
        path: options.path ?? '/',
        method: options.method ?? 'GET',
        headers: options.host ? { Host: options.host } : {},
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('startStaticServer hardening', () => {
  it('rejects a DNS-rebinding Host header', async () => {
    expect(await raw({ host: 'evil.example' })).toBe(403);
  });

  it('rejects anything but reads', async () => {
    expect(await raw({ method: 'POST' })).toBe(403);
  });

  it('survives a malformed escape instead of crashing the main process', async () => {
    expect(await raw({ path: '/%E0%A4%A' })).toBe(200);
    expect((await get('/')).status).toBe(200);
  });

  it('sends the security headers on every response', async () => {
    for (const path of ['/', '/assets/app.css']) {
      const { headers } = await get(path);
      expect(headers.get('x-content-type-options')).toBe('nosniff');
      expect(headers.get('x-frame-options')).toBe('DENY');
      expect(headers.get('content-security-policy')).toContain(
        "frame-ancestors 'none'",
      );
    }
  });
});

describe('startStaticServer', () => {
  it('serves index.html at the root', async () => {
    const response = await get('/');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain(MARKER);
  });

  it('falls back to index.html for client routes', async () => {
    // History-mode routing means every route below is a real URL the user can
    // reload on; returning 404 here is what breaks `file://` builds.
    const response = await get('/w/acme/inbox');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(MARKER);
  });

  it('serves wasm with the type the Matrix crypto module needs', async () => {
    // `WebAssembly.instantiateStreaming` rejects anything but application/wasm.
    const response = await get('/assets/crypto.wasm');
    expect(response.headers.get('content-type')).toBe('application/wasm');
  });

  it('serves css with its own type rather than octet-stream', async () => {
    const response = await get('/assets/app.css');
    expect(response.headers.get('content-type')).toContain('text/css');
  });

  it('does not serve files outside the bundle root', async () => {
    const response = await get('/../../../../package.json');
    expect(await response.text()).toContain(MARKER);
  });

  it('moves to the next port when one is already taken', async () => {
    /*
     * The suite's own server already holds a port, so a second one has to land
     * elsewhere. This is the case that bit us in development: probing on a
     * different address family than the bind reports an occupied port as free,
     * and the renderer then loads whatever is really listening there.
     *
     * Deliberately not hardcoding 4200 — a dev server on the machine running
     * the suite would take it and make the test lie.
     */
    const second = await startStaticServer(root);
    try {
      expect(second.origin).not.toBe(server.origin);
      expect(await (await fetch(`${second.origin}/`)).text()).toContain(MARKER);
    } finally {
      await second.close();
    }
  });
});
