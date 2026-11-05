import { describe, expect, it } from 'vitest';
import { checkContent } from '@org/types';
import {
  AI_CONSENT_VERSION,
  hasAiConsent,
  REPORT_REASONS,
  withoutBlockedSenders,
} from './safety-core';

describe('withoutBlockedSenders', () => {
  const items = [
    { id: '1', sender: '@me:hs' },
    { id: '2', sender: '@bad:hs' },
    { id: '3', sender: '@ok:hs' },
  ];

  it('hides blocked senders and keeps everyone else', () => {
    const ids = withoutBlockedSenders(items, new Set(['@bad:hs']), '@me:hs');
    expect(ids.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('never hides your own messages', () => {
    const ids = withoutBlockedSenders(items, new Set(['@me:hs']), '@me:hs');
    expect(ids).toHaveLength(3);
  });

  it('passes everything through when nobody is blocked', () => {
    expect(withoutBlockedSenders(items, new Set(), '@me:hs')).toHaveLength(3);
  });
});

describe('hasAiConsent', () => {
  it('needs the current version, not just any stored value', () => {
    expect(hasAiConsent(AI_CONSENT_VERSION)).toBe(true);
    expect(hasAiConsent(null)).toBe(false);
    expect(hasAiConsent('0')).toBe(false);
  });
});

describe('REPORT_REASONS', () => {
  it('has unique values and always offers a catch-all', () => {
    const values = REPORT_REASONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain('OTHER');
  });
});

describe('content filter on mobile', () => {
  it('resolves from @org/types and blocks severe text', () => {
    expect(checkContent('kill yourself').allowed).toBe(false);
    expect(checkContent('kill the process').allowed).toBe(true);
  });
});
