import { describe, expect, it } from 'vitest';
import { executeSandboxedCode } from './sandboxed-code-runner.js';

describe('executeSandboxedCode', () => {
  it('evaluates a bare expression', async () => {
    const outcome = await executeSandboxedCode('2 + 2');
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe(4);
  });

  it('runs a function body, exposes inputs and captures console output', async () => {
    const code = `
      console.log('Calculating discount for', user.name);
      const discount = price * 0.15;
      return { finalPrice: price - discount, discount, same: input.price === price };
    `;
    const outcome = await executeSandboxedCode(code, { user: { name: 'Alice' }, price: 100 });
    expect(outcome.success).toBe(true);
    expect(outcome.result).toEqual({ finalPrice: 85, discount: 15, same: true });
    expect(outcome.logs).toContain('Calculating discount for Alice');
  });

  it('returns null — not a fake value — when the body returns nothing', async () => {
    const outcome = await executeSandboxedCode('const x = 1;');
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBeNull();
  });

  it('reports thrown errors as a failed step', async () => {
    const outcome = await executeSandboxedCode('throw new Error("bad input")');
    expect(outcome.success).toBe(false);
    expect(outcome.error).toBe('bad input');
  });

  it('times out on infinite loops', async () => {
    const outcome = await executeSandboxedCode('while (true) {}', {}, { timeoutMs: 200 });
    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/timed out/i);
  });

  it('has no host process, require or dynamic code generation', async () => {
    expect((await executeSandboxedCode('typeof process')).result).toBe('undefined');
    expect((await executeSandboxedCode('typeof require')).result).toBe('undefined');
    expect((await executeSandboxedCode('Function("return 1")()')).success).toBe(false);
    expect((await executeSandboxedCode('eval("1")')).success).toBe(false);
  });

  it('cannot climb constructors back to the host realm', async () => {
    for (const probe of [
      'console.log.constructor("return process")()',
      'this.constructor.constructor("return process")()',
      'input.constructor.constructor("return process")()',
      'JSON.constructor.constructor("return process")()',
    ]) {
      const outcome = await executeSandboxedCode(probe, { a: 1 });
      expect(outcome.success, probe).toBe(false);
    }
  });

  it('contains memory bombs to the worker', async () => {
    const outcome = await executeSandboxedCode(
      'const a = []; while (true) a.push(new Array(1e6).fill(1));',
      {},
      { timeoutMs: 5000 },
    );
    expect(outcome.success).toBe(false);
  }, 15_000);
});
