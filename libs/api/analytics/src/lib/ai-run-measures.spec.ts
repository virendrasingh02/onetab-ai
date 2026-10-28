import { describe, expect, it } from 'vitest';
import { deriveRunMeasures, latencyBuckets, meanOf, pctChange, readToolCall, type RunRow } from './ai-run-measures.js';

const at = (ms: number) => new Date(1_700_000_000_000 + ms);
const run = (over: Partial<RunRow> = {}): RunRow => ({
  startedAt: at(0),
  status: 'COMPLETED',
  latencyMs: 1_000,
  tokensUsed: 1_000,
  ...over,
});

describe('readToolCall', () => {
  it('reads the lowercase status and durationMs the runtime writes', () => {
    expect(readToolCall({ name: 'search', status: 'failed', durationMs: 120 })).toEqual({
      name: 'search',
      failed: true,
      durationMs: 120,
    });
  });

  it('reports no duration instead of inventing one', () => {
    expect(readToolCall({ name: 'search', status: 'success' }).durationMs).toBeNull();
  });
});

describe('deriveRunMeasures', () => {
  it('uses the measured token split and timings when the runtime stored them', () => {
    const m = deriveRunMeasures(
      run({ stateJson: { metrics: { inputTokens: 700, outputTokens: 300, modelMs: 800, toolMs: 150 } } }),
    );
    expect(m).toMatchObject({ inputTokens: 700, outputTokens: 300, splitMeasured: true, modelMs: 800, toolMs: 150 });
  });

  it('flags the split as estimated for runs recorded before measurement', () => {
    const m = deriveRunMeasures(run());
    expect(m.splitMeasured).toBe(false);
    expect(m.inputTokens + m.outputTokens).toBe(1_000);
    expect(m.modelMs).toBeNull();
  });

  it('measures queue wait from the first node, ignoring the agent turn step', () => {
    const m = deriveRunMeasures(
      run({
        steps: [
          { stepId: 'turn', nodeType: 'AGENT', latencyMs: 900, startedAt: at(5_000) },
          { stepId: 'a', nodeType: 'LLM', latencyMs: 400, startedAt: at(250) },
          { stepId: 'b', nodeType: 'HTTP_REQUEST', latencyMs: 90, startedAt: at(700) },
        ],
      }),
    );
    expect(m.queueMs).toBe(250);
    expect(m.modelMs).toBe(400);
    expect(m.toolMs).toBe(90);
  });
});

describe('aggregates', () => {
  it('averages only runs that have the measure', () => {
    expect(meanOf([100, null, 300])).toBe(200);
    expect(meanOf([null, null])).toBe(0);
  });

  it('returns null change against an empty previous window', () => {
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(15, 10)).toBe(50);
  });

  it('buckets durations into bands', () => {
    const buckets = latencyBuckets([200, 900, 2_000, 70_000]);
    expect(buckets.find((b) => b.label === '< 1s')?.count).toBe(2);
    expect(buckets.find((b) => b.label === '1–5s')?.count).toBe(1);
    expect(buckets.find((b) => b.label === '> 60s')?.count).toBe(1);
  });
});
