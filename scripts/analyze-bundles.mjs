#!/usr/bin/env node
/**
 * Measures the production output of the web apps and the API, so size claims
 * come from the build rather than from memory.
 *
 *   node scripts/analyze-bundles.mjs                 # table for every built app
 *   node scripts/analyze-bundles.mjs --json out.json # plus the full chunk list
 *   node scripts/analyze-bundles.mjs --budget        # exit 1 if a budget is broken
 *
 * "Initial" is what a browser must fetch before the app can run: the scripts and
 * stylesheets in index.html plus everything they statically import, walked with
 * a real ES module lexer. Dynamic imports stop the walk, so a lazy chunk is never
 * counted as an initial download. Run after `nx build`; apps with no `dist` are
 * skipped.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { init, parse } from 'es-module-lexer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_APPS = ['web', 'admin', 'ai-agent-studio'];
const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

/** Brotli budget for a web app's initial JavaScript, in bytes. */
const INITIAL_JS_BROTLI_BUDGET = 1_200_000;
/** Libraries that must never be reachable from an app's entry without a dynamic import. */
const FORBIDDEN_INITIAL_CHUNKS = /^vendor-(charts|pdf|editor|syntax)-/;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

async function compressed(buffer) {
  const [gz, br] = await Promise.all([
    gzipAsync(buffer, { level: 9 }),
    brotliAsync(buffer, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    }),
  ]);
  return { raw: buffer.length, gzip: gz.length, brotli: br.length };
}

/** Reuses the build's own `.br`/`.gz`, so a precompressed dist measures in seconds. */
async function sizesOf(file) {
  if (existsSync(`${file}.br`) && existsSync(`${file}.gz`)) {
    return {
      raw: statSync(file).size,
      gzip: statSync(`${file}.gz`).size,
      brotli: statSync(`${file}.br`).size,
    };
  }
  return compressed(readFileSync(file));
}

function htmlEntries(html) {
  const refs = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/g)) {
    const tag = match[0];
    const url = /\b(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (!url || /^(https?:)?\/\//.test(url)) continue;
    const rel = /\brel="([^"]+)"/.exec(tag)?.[1];
    if (match[1] === 'link' && rel !== 'stylesheet' && rel !== 'modulepreload')
      continue;
    refs.push(url.replace(/^\.?\//, ''));
  }
  return refs;
}

/** Every file reachable from index.html without crossing a dynamic import. */
function initialFiles(dist) {
  const seen = new Set();
  const queue = htmlEntries(readFileSync(join(dist, 'index.html'), 'utf8'));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(join(dist, file))) continue;
    seen.add(file);
    if (extname(file) !== '.js') continue;
    const [imports] = parse(readFileSync(join(dist, file), 'utf8'));
    for (const specifier of imports) {
      // `d === -1` is a static import; dynamic imports and import.meta are skipped.
      if (specifier.d !== -1 || !specifier.n?.startsWith('.')) continue;
      queue.push(posix.normalize(posix.join(posix.dirname(file), specifier.n)));
    }
  }
  return seen;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

async function analyzeWebApp(app) {
  const dist = join(ROOT, 'apps', app, 'dist');
  if (!existsSync(join(dist, 'index.html'))) return null;
  const files = walk(dist);
  const initial = initialFiles(dist);
  const rows = [];
  for (const file of files) {
    const ext = extname(file);
    if (ext !== '.js' && ext !== '.css') continue;
    const name = relative(dist, file).replaceAll('\\', '/');
    rows.push({
      name,
      ext,
      initial: initial.has(name),
      ...(await sizesOf(file)),
    });
  }
  rows.sort((a, b) => b.raw - a.raw);
  const pick = (ext, onlyInitial) =>
    rows.filter((row) => row.ext === ext && (!onlyInitial || row.initial));
  const totals = (list) => ({
    files: list.length,
    raw: sum(list, 'raw'),
    gzip: sum(list, 'gzip'),
    brotli: sum(list, 'brotli'),
  });
  return {
    app,
    distBytes: files.reduce((total, file) => total + statSync(file).size, 0),
    distFiles: files.length,
    sourcemaps: files.filter((file) => file.endsWith('.map')).length,
    sourcemapBytes: files
      .filter((file) => file.endsWith('.map'))
      .reduce((total, file) => total + statSync(file).size, 0),
    precompressed: files.filter((file) => /\.(br|gz)$/.test(file)).length,
    js: totals(pick('.js', false)),
    css: totals(pick('.css', false)),
    initialJs: totals(pick('.js', true)),
    initialCss: totals(pick('.css', true)),
    chunks: rows,
  };
}

async function analyzeApi() {
  const dist = join(ROOT, 'apps/api/dist');
  if (!existsSync(join(dist, 'main.js'))) return null;
  const files = walk(dist);
  const maps = files.filter((file) => file.endsWith('.map'));
  return {
    app: 'api',
    distBytes: files.reduce((total, file) => total + statSync(file).size, 0),
    distFiles: files.length,
    mainJsBytes: statSync(join(dist, 'main.js')).size,
    sourcemaps: maps.length,
    sourcemapBytes: maps.reduce(
      (total, file) => total + statSync(file).size,
      0,
    ),
  };
}

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(2)} MB`;

function printWebApp(result) {
  console.log(`\n${result.app}`);
  console.log(
    `  dist          ${mb(result.distBytes)} in ${result.distFiles} files`,
  );
  console.log(
    `  sourcemaps    ${result.sourcemaps} (${mb(result.sourcemapBytes)})`,
  );
  console.log(`  precompressed ${result.precompressed} files`);
  for (const [label, data] of [
    ['initial JS ', result.initialJs],
    ['initial CSS', result.initialCss],
    ['total JS   ', result.js],
    ['total CSS  ', result.css],
  ]) {
    console.log(
      `  ${label}   ${String(data.files).padStart(4)} files  raw ${mb(data.raw)}  gzip ${mb(data.gzip)}  br ${mb(data.brotli)}`,
    );
  }
  console.log('  largest initial chunks');
  for (const chunk of result.chunks.filter((row) => row.initial).slice(0, 8)) {
    console.log(
      `    ${mb(chunk.raw).padStart(10)}  br ${mb(chunk.brotli).padStart(9)}  ${chunk.name}`,
    );
  }
}

await init;
const args = process.argv.slice(2);
const jsonPath = args.includes('--json')
  ? args[args.indexOf('--json') + 1]
  : undefined;
const results = [];
for (const app of WEB_APPS) {
  const result = await analyzeWebApp(app);
  if (result) {
    results.push(result);
    printWebApp(result);
  }
}
const api = await analyzeApi();
if (api) {
  results.push(api);
  console.log(
    `\napi\n  dist ${mb(api.distBytes)} in ${api.distFiles} files, main.js ${mb(api.mainJsBytes)}, sourcemaps ${api.sourcemaps} (${mb(api.sourcemapBytes)})`,
  );
}
if (jsonPath) writeFileSync(jsonPath, JSON.stringify(results, null, 2));

if (args.includes('--budget')) {
  const failures = [];
  for (const result of results) {
    if (result.sourcemaps > 0 && !process.env['GENERATE_SOURCEMAP']) {
      failures.push(`${result.app}: ${result.sourcemaps} sourcemaps in dist`);
    }
    if (!result.chunks) continue;
    if (result.initialJs.brotli > INITIAL_JS_BROTLI_BUDGET) {
      failures.push(
        `${result.app}: initial JS ${mb(result.initialJs.brotli)} brotli is over budget`,
      );
    }
    for (const chunk of result.chunks) {
      if (
        chunk.initial &&
        FORBIDDEN_INITIAL_CHUNKS.test(posix.basename(chunk.name))
      ) {
        failures.push(
          `${result.app}: ${chunk.name} is reachable from the entry`,
        );
      }
    }
  }
  if (failures.length) {
    console.error(`\nBudget failures:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nAll budgets met.');
}
