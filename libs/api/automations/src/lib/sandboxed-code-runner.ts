import { Worker } from 'node:worker_threads';

export interface SandboxExecutionOptions {
  timeoutMs?: number;
  maxLogs?: number;
}

export interface SandboxExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  logs: string[];
  durationMs: number;
}

const MAX_OUTPUT_BYTES = 256 * 1024;

/**
 * Runs inside a throwaway worker. The member's code gets a fresh V8 context
 * that holds NO host objects — handing it even `console` or `JSON` from this
 * realm lets `x.constructor.constructor('return process')()` reach the host.
 * Inputs cross as a JSON string and the result comes back as one, string
 * code generation (`eval`/`Function`) is off, and microtasks run inside the
 * timeout. The worker itself caps heap/stack and is killed from outside if it
 * outlives the deadline, so a memory bomb takes down the worker, not the API.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const { code, input, timeoutMs, maxLogs, maxOutput } = workerData;

let expression = true;
try { new vm.Script('(' + code + '\\n)'); } catch { expression = false; }
const body = expression ? 'return (' + code + '\\n);' : code;

const program = [
  '(() => {',
  '"use strict";',
  'const __stringify = JSON.stringify, __parse = JSON.parse, __keys = Object.keys;',
  'const __logs = [];',
  'const __fmt = (a) => { if (typeof a === "string") return a; try { return __stringify(a); } catch (e) { return String(a); } };',
  'const __log = (...a) => { if (__logs.length < ' + Number(maxLogs) + ') __logs.push(a.map(__fmt).join(" ")); };',
  'const console = { log: __log, info: __log, warn: __log, error: __log, debug: __log };',
  'const input = __parse(__input);',
  'const context = input;',
  'for (const k of __keys(input)) { if (!(k in globalThis)) globalThis[k] = input[k]; }',
  'let __result, __error;',
  'try { __result = (function () {',
  body,
  '\\n})(); } catch (e) { __error = (e && typeof e.message === "string") ? e.message : String(e); }',
  'if (__result && typeof __result.then === "function") __error = __error || "Code steps run synchronously; return a value, not a Promise.";',
  'let __out;',
  'try { __out = __stringify({ ok: !__error, result: __result === undefined ? null : __result, error: __error, logs: __logs }); }',
  'catch (e) { __out = __stringify({ ok: false, error: "The result could not be converted to JSON: " + String(e && e.message), logs: __logs }); }',
  'return __out;',
  '})()',
].join('\\n');

let out;
try {
  const sandbox = Object.create(null);
  sandbox.__input = input;
  const ctx = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: 'afterEvaluate',
  });
  const raw = new vm.Script(program, { filename: 'code-step.js' }).runInContext(ctx, { timeout: timeoutMs });
  const text = typeof raw === 'string' ? raw : '{"ok":false,"error":"The code step returned nothing usable.","logs":[]}';
  out = text.length > maxOutput
    ? { ok: false, error: 'The code step produced more than ' + Math.round(maxOutput / 1024) + ' KB of output.', logs: [] }
    : JSON.parse(text);
} catch (e) {
  out = { ok: false, error: e && e.message ? String(e.message) : String(e), logs: [] };
}
parentPort.postMessage(out);
`;

/**
 * Runs a member-authored JavaScript snippet for a workflow `CODE` step.
 *
 * The snippet is either an expression (`price * 0.9`) or a function body that
 * `return`s its result. Inputs are available as `input`/`context` and as
 * top-level names; `console.*` is captured into the run log. There is no
 * `require`, `process`, network, file system, timers, `eval` or `Function` —
 * only the language's own built-ins.
 */
export function executeSandboxedCode(
  code: string,
  variables: Record<string, unknown> = {},
  options: SandboxExecutionOptions = {},
): Promise<SandboxExecutionResult> {
  const startedAt = Date.now();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 2000, 100), 10_000);
  const maxLogs = Math.min(Math.max(options.maxLogs ?? 100, 0), 1000);

  let input: string;
  try {
    input = JSON.stringify(variables ?? {}) ?? '{}';
  } catch {
    input = '{}';
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: Omit<SandboxExecutionResult, 'durationMs'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      void worker.terminate();
      resolve({ ...r, durationMs: Date.now() - startedAt });
    };

    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { code, input, timeoutMs, maxLogs, maxOutput: MAX_OUTPUT_BYTES },
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      env: {},
      stdout: true,
      stderr: true,
    });
    // vm's timeout covers the script itself; this covers everything else
    // (worker start-up, a wedged isolate, GC thrash near the heap cap).
    const killTimer = setTimeout(
      () => finish({ success: false, error: `Code step timed out after ${timeoutMs}ms.`, logs: [] }),
      timeoutMs + 3000,
    );

    worker.once('message', (msg: { ok?: boolean; result?: unknown; error?: string; logs?: string[] }) => {
      finish({
        success: msg?.ok === true,
        ...(msg?.ok === true ? { result: msg.result } : { error: msg?.error ?? 'The code step failed.' }),
        logs: Array.isArray(msg?.logs) ? msg.logs : [],
      });
    });
    worker.once('error', (err: Error & { code?: string }) => {
      finish({
        success: false,
        error:
          err?.code === 'ERR_WORKER_OUT_OF_MEMORY'
            ? 'Code step ran out of memory (64 MB limit).'
            : (err?.message ?? 'The code step crashed.'),
        logs: [],
      });
    });
    worker.once('exit', () => finish({ success: false, error: 'The code step stopped before returning.', logs: [] }));
  });
}
