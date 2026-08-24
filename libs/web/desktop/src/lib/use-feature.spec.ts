import { describe, expect, it } from 'vitest';
import { featureManager } from './use-feature.js';

// jsdom has no `window.onetabDesktop`, so `desktop.capabilities.get()` — what
// `featureManager` reads outside of React — is the plain web defaults here.
// This is the non-hook path exercised outside the component tree (menu
// handlers, route loaders); `useFeature`/`usePlatform`/etc. are the same
// evaluation wired to live capability updates via React state instead.
describe('featureManager (non-hook entry point)', () => {
  it('evaluates a web-available feature as AVAILABLE', () => {
    const result = featureManager.evaluate('browserAuth');
    expect(result.state).toBe('AVAILABLE');
  });

  it('evaluates a desktop-only feature as OS_UNSUPPORTED in a browser', () => {
    const result = featureManager.evaluate('deepLinks');
    expect(result.state).toBe('OS_UNSUPPORTED');
    expect(result.fallback).toEqual({ type: 'web', url: '/', label: 'Open in browser' });
  });

  it('evaluateAll covers every registered feature', () => {
    const results = featureManager.evaluateAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.find((r) => r.id === 'appUpdates')?.state).toBe('OS_UNSUPPORTED');
  });
});
