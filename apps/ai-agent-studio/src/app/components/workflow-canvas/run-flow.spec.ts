import { describe, expect, it } from 'vitest';
import {
  edgeRunStatus,
  planTransitions,
  playbackDelay,
  revealResults,
  stepOwner,
  WIRE_TRAVEL_MS,
} from './run-flow';

describe('planTransitions', () => {
  it('walks a run that finished between polls through every step in order', () => {
    const { events } = planTransitions(
      {},
      { start: 'success', agent: 'success', end: 'success' },
    );
    expect(events.map((e) => `${e.id}:${e.status}`)).toEqual([
      'start:running',
      'start:success',
      'agent:entering',
      'agent:running',
      'agent:success',
      'end:entering',
      'end:running',
      'end:success',
    ]);
  });

  it('only adds what changed since the last poll', () => {
    const first = planTransitions({}, { start: 'success', agent: 'running' });
    const second = planTransitions(first.planned, {
      start: 'success',
      agent: 'failed',
    });
    expect(second.events).toEqual([{ id: 'agent', status: 'failed' }]);
  });

  it('lets a step finish after waiting on a person', () => {
    const { events } = planTransitions(
      { start: 'success', review: 'waiting' },
      { start: 'success', review: 'success' },
    );
    expect(events).toEqual([{ id: 'review', status: 'success' }]);
  });

  it('marks a skipped step without running it', () => {
    const { events } = planTransitions({ a: 'success' }, { b: 'skipped' });
    expect(events).toEqual([{ id: 'b', status: 'skipped' }]);
  });

  it('ignores idle steps', () => {
    expect(planTransitions({}, { a: 'idle' }).events).toEqual([]);
  });
});

describe('playbackDelay', () => {
  it('gives a wire its full travel time when little is queued', () => {
    expect(playbackDelay({ id: 'a', status: 'entering' }, [])).toBe(
      WIRE_TRAVEL_MS,
    );
  });

  it('speeds up when a long run has to catch up', () => {
    const queue = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      status: 'entering' as const,
    }));
    expect(playbackDelay({ id: 'a', status: 'entering' }, queue)).toBeLessThan(
      WIRE_TRAVEL_MS / 2,
    );
  });
});

describe('edgeRunStatus', () => {
  const edge = (from?: string, to?: string, attachment = false) =>
    edgeRunStatus(
      { ...(from ? { a: from } : {}), ...(to ? { b: to } : {}) } as never,
      'a',
      'b',
      attachment,
    );

  it('has no state with no run on the canvas', () => {
    expect(edgeRunStatus(null, 'a', 'b', false)).toBeUndefined();
  });

  it('waits until the step before it has finished', () => {
    expect(edge('running')).toBe('pending');
    expect(edge('success')).toBe('pending');
  });

  it('carries the pulse, then stays lit', () => {
    expect(edge('success', 'entering')).toBe('flowing');
    expect(edge('success', 'running')).toBe('done');
    expect(edge('success', 'success')).toBe('done');
  });

  it('shows how the next step ended', () => {
    expect(edge('success', 'failed')).toBe('failed');
    expect(edge('success', 'waiting')).toBe('waiting');
    expect(edge('success', 'skipped')).toBe('skipped');
  });

  it('carries on past a skipped step', () => {
    expect(edge('skipped', 'entering')).toBe('flowing');
    expect(edge('skipped', 'success')).toBe('done');
  });

  it('keeps attachments out of the run order', () => {
    expect(edge('running', undefined, true)).toBe('running');
    expect(edge('success', undefined, true)).toBeUndefined();
  });
});

describe('revealResults', () => {
  const result = {
    status: 'success' as const,
    output: 'done',
    tokens: 9,
    latencyMs: 5,
  };

  it('passes results through with no run on the canvas', () => {
    expect(revealResults({ a: result }, null)).toEqual({ a: result });
  });

  it('holds output back until the canvas has played that far', () => {
    expect(revealResults({ a: result }, {})).toEqual({});
    expect(revealResults({ a: result }, { a: 'entering' })).toEqual({});
    expect(revealResults({ a: result }, { a: 'running' }).a).toMatchObject({
      status: 'running',
      output: '',
    });
    expect(revealResults({ a: result }, { a: 'success' }).a?.output).toBe(
      'done',
    );
  });

  it('keeps an output the person cleared', () => {
    const cleared = {
      ...result,
      status: 'idle' as const,
      output: '',
      cleared: true,
    };
    expect(revealResults({ a: cleared }, {}).a).toEqual(cleared);
  });
});

describe('stepOwner', () => {
  it('folds helper steps onto their card', () => {
    expect(stepOwner('gmail-1__input')).toBe('gmail-1');
    expect(stepOwner('gmail-1__approval')).toBe('gmail-1');
    expect(stepOwner('agent-1')).toBe('agent-1');
  });
});
