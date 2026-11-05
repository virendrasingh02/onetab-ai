/**
 * Production build settings shared by the Vite apps (web, admin, Studio; the
 * desktop renderer is the web build). One place, so the three apps cannot drift
 * on what ships to a browser.
 */
import {
  existsSync,
  mkdirSync,
  promises as fs,
  renameSync,
  statSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/**
 * Sourcemaps are off unless `GENERATE_SOURCEMAP=true`, and then they are
 * `hidden`: written out, but with no `sourceMappingURL` comment in the bundle.
 * `precompressAndGuardPlugin` moves them out of `dist` so a deploy of that folder
 * cannot publish them. Vite's dev server keeps its own maps regardless.
 */
export function productionSourcemap(): false | 'hidden' {
  return process.env['GENERATE_SOURCEMAP'] === 'true' ? 'hidden' : false;
}

/**
 * Packages that get a named chunk. Everything else is left to the bundler, which
 * places it next to the dynamic imports that use it.
 *
 * Do not add a catch-all `vendor` here. A named chunk is one file, so anything
 * in it loads whenever anything else in it does: a catch-all turned every
 * `import()` behind Shiki's language map into a static part of the entry, and
 * browsers downloaded 240 grammars to show a login form.
 *
 * Only list a package in a lazy group if the entry does not need it, or the
 * group stops being lazy. `@shikijs/langs` and `@shikijs/themes` must stay out:
 * each grammar is its own on-demand chunk.
 */
const VENDOR_CHUNKS: ReadonlyArray<readonly [name: string, packages: RegExp]> =
  [
    [
      'vendor-react',
      /^(react|react-dom|react-router|react-router-dom|@remix-run\/router|scheduler)$/,
    ],
    [
      'vendor-data',
      /^(@tanstack\/.+|axios|zustand|@reduxjs\/toolkit|react-redux)$/,
    ],
    ['vendor-forms', /^(react-hook-form|@hookform\/.+|zod)$/],
    ['vendor-ui', /^(@radix-ui\/.+|lucide-react|framer-motion|sonner)$/],
    [
      'vendor-matrix',
      /^(matrix-js-sdk|matrix-widget-api|matrix-events-sdk|@matrix-org\/.+)$/,
    ],
    [
      'vendor-charts',
      /^(recharts|victory-vendor|d3-(array|format|path|scale|shape|time|time-format)|internmap|decimal\.js-light)$/,
    ],
    // The canvas's d3 packages are not Recharts': opening one must not load the other.
    [
      'vendor-flow',
      /^(@xyflow\/.+|d3-(dispatch|drag|ease|selection|timer|transition|zoom))$/,
    ],
    ['vendor-pdf', /^pdfjs-dist$/],
    ['vendor-editor', /^(lexical|@lexical\/.+)$/],
    [
      'vendor-syntax',
      /^(shiki|@shikijs\/(core|engine-oniguruma|primitive|types|vscode-textmate)|oniguruma-.+|hast-util-.+)$/,
    ],
  ];

/** The package a module belongs to, from the last `node_modules` in its path. */
function packageOf(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const start = normalized.lastIndexOf(marker);
  if (start === -1) return undefined;
  const [scope, name] = normalized.slice(start + marker.length).split('/');
  return scope?.startsWith('@') ? `${scope}/${name}` : scope;
}

function isInPackage(id: string, packages: RegExp): boolean {
  const name = packageOf(id);
  // `@org/*` resolves through `node_modules` (preserveSymlinks) but is app source.
  return !!name && !name.startsWith('@org/') && packages.test(name);
}

/**
 * The `build` block all three apps share.
 *
 * `includeDependenciesRecursively` must stay off. On, a group swallows what its
 * packages import: `vendor-charts` took `react` and `vendor-syntax` took Vite's
 * preload helper, so the entry statically imported both "lazy" chunks. Rolldown
 * asks for `strictExecutionOrder` and loose entry signatures alongside that.
 *
 * `strictExecutionOrder` is needed regardless once there is no catch-all chunk:
 * Prism's grammar files are side-effect scripts needing a `Prism` global, and
 * without it they get hoisted into shared chunks ahead of Prism core ("Prism is
 * not defined" at boot). See the Lexical and media-preview code highlighters.
 */
export function productionBuild() {
  return {
    outDir: './dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: productionSourcemap(),
    // Gzipping every chunk just to print a number measurably slows CI builds;
    // `scripts/analyze-bundles.mjs` reports the real sizes.
    reportCompressedSize: false,
    cssCodeSplit: true,
    // An inlined asset is re-downloaded with every chunk that embeds it.
    assetsInlineLimit: 2048,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rolldownOptions: {
      preserveEntrySignatures: false as const,
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: VENDOR_CHUNKS.map(([name, packages]) => ({
            name,
            test: (id: string) => isInPackage(id, packages),
          })),
        },
      },
    },
  };
}

const COMPRESSIBLE = new Set([
  '.js',
  '.mjs',
  '.css',
  '.svg',
  '.json',
  '.wasm',
  '.html',
  '.txt',
]);
/** Below this, a compressed copy saves less than the response headers cost. */
const COMPRESS_MIN_BYTES = 1024;

async function filesIn(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? filesIn(full) : Promise.resolve([full]);
    }),
  );
  return nested.flat();
}

async function precompress(file: string): Promise<void> {
  const source = await fs.readFile(file);
  if (source.length < COMPRESS_MIN_BYTES) return;
  const [br, gz] = await Promise.all([
    brotliAsync(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    }),
    gzipAsync(source, { level: constants.Z_BEST_COMPRESSION }),
  ]);
  // A copy that is not smaller only costs disk and a wasted decode.
  if (br.length < source.length) await fs.writeFile(`${file}.br`, br);
  if (gz.length < source.length) await fs.writeFile(`${file}.gz`, gz);
}

/** `index.html` must always revalidate; only hashed assets can be cached forever. */
function cacheControlFor(pathname: string): string {
  return pathname.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** The encoding to serve, preferring brotli, honouring `q=0` refusals. */
export function pickEncoding(
  acceptEncoding: string | undefined,
): 'br' | 'gzip' | undefined {
  const accepted = new Set(
    (acceptEncoding ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => !/;\s*q=0(\.0*)?$/.test(part))
      .map((part) => part.split(';')[0]),
  );
  if (accepted.has('br')) return 'br';
  return accepted.has('gzip') ? 'gzip' : undefined;
}

/**
 * Serves the same responses `docs/static-hosting.md` asks of a production host,
 * so `vite preview` (and `npm run share`, which is built on it) behaves like one:
 * the precompressed file when the client takes it, `Vary` either way, and
 * immutable caching for hashed assets only.
 */
function serveBuild(outDir: string) {
  return (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const ext = extname(pathname);
    const contentType = CONTENT_TYPES[ext];
    const file = resolve(outDir, `.${pathname}`);
    const insideOutDir = !relative(outDir, file).startsWith('..');
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!contentType || !insideOutDir || !existsSync(file)) return next();

    res.setHeader('Cache-Control', cacheControlFor(pathname));
    res.setHeader('Vary', 'Accept-Encoding');
    const encoding = pickEncoding(req.headers['accept-encoding']);
    const suffix = encoding === 'br' ? '.br' : '.gz';
    if (!encoding || !existsSync(file + suffix)) return next();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', statSync(file + suffix).size);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    void fs.readFile(file + suffix).then(
      (body) => res.end(body),
      () => {
        res.statusCode = 500;
        res.end();
      },
    );
  };
}

/**
 * Writes `.br` and `.gz` next to each compressible file (originals stay, for
 * clients that accept neither) and moves any sourcemaps out of `dist`.
 */
export function precompressAndGuardPlugin() {
  let outDir = '';
  return {
    name: 'onetab-precompress',
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configurePreviewServer(server: {
      middlewares: { use: (handler: unknown) => void };
    }) {
      server.middlewares.use(serveBuild(outDir));
    },
    async closeBundle() {
      if (!existsSync(outDir)) return;
      const files = await filesIn(outDir);
      const maps = files.filter((file) => file.endsWith('.map'));
      for (const map of maps) {
        const target = join(`${outDir}-sourcemaps`, relative(outDir, map));
        mkdirSync(dirname(target), { recursive: true });
        renameSync(map, target);
      }
      await Promise.all(
        files
          .filter((file) => COMPRESSIBLE.has(extname(file)))
          .map((file) => precompress(file)),
      );
    },
  };
}
