import { describe, expect, it } from 'vitest';
import { evaluate, evaluateAll, evaluateFeature } from './feature-manager.js';
import type { FeatureDefinition, PlatformSnapshot } from './types.js';

function snapshot(overrides: Partial<PlatformSnapshot> = {}): PlatformSnapshot {
  return {
    platform: 'windows',
    runtime: 'electron',
    distribution: 'direct',
    capabilities: {
      authentication: true,
      notifications: true,
      deepLinks: true,
      appUpdates: true,
      autoLaunch: true,
      filesystem: true,
      clipboard: true,
      screenshots: false,
      windowControls: true,
    },
    ...overrides,
  };
}

describe('evaluateFeature', () => {
  it('returns AVAILABLE when every requirement is met', () => {
    const result = evaluate('deepLinks', snapshot());
    expect(result).toEqual({
      id: 'deepLinks',
      state: 'AVAILABLE',
      available: true,
      reason: null,
      fallback: { type: 'web', url: '/', label: 'Open in browser' },
      platform: 'windows',
      distribution: 'direct',
    });
  });

  it('flags an unknown OS as OS_UNSUPPORTED before anything else', () => {
    const result = evaluate('deepLinks', snapshot({ platform: 'web', distribution: 'web' }));
    expect(result.state).toBe('OS_UNSUPPORTED');
    expect(result.available).toBe(false);
  });

  it('degrades to the declared strategy when a required capability is missing', () => {
    const result = evaluate('deepLinks', snapshot({ capabilities: { deepLinks: false } }));
    expect(result.state).toBe('WEB_ONLY');
    expect(result.fallback?.url).toBe('/');
  });

  it('defaults an undeclared degrade strategy to DISABLED', () => {
    const result = evaluate('autoLaunch', snapshot({ capabilities: { autoLaunch: false } }));
    expect(result.state).toBe('DISABLED');
  });

  it('hides windowControls when the capability is missing', () => {
    const result = evaluate('windowControls', snapshot({ capabilities: { windowControls: false } }));
    expect(result.state).toBe('HIDDEN');
  });

  it('reports REQUIRES_PERMISSION for a missing permission capability, distinct from a missing plain one', () => {
    const result = evaluate('nativeNotifications', snapshot({ capabilities: { notifications: false } }));
    expect(result.state).toBe('REQUIRES_PERMISSION');
  });

  it('restricts appUpdates under the Mac App Store even though the capability is technically true', () => {
    const result = evaluate(
      'appUpdates',
      snapshot({ platform: 'macos', distribution: 'mac-app-store', capabilities: { appUpdates: true } }),
    );
    expect(result.state).toBe('STORE_RESTRICTED');
    expect(result.reason).toContain('store');
  });

  it('restricts appUpdates under the Microsoft Store the same way', () => {
    const result = evaluate(
      'appUpdates',
      snapshot({ platform: 'windows', distribution: 'microsoft-store', capabilities: { appUpdates: true } }),
    );
    expect(result.state).toBe('STORE_RESTRICTED');
  });

  it('does not restrict appUpdates on a direct build', () => {
    const result = evaluate('appUpdates', snapshot({ platform: 'macos', distribution: 'direct' }));
    expect(result.state).toBe('AVAILABLE');
  });

  it('reports autoLaunch as OS_UNSUPPORTED on Linux — it is not in the feature\'s platforms list', () => {
    const result = evaluate(
      'autoLaunch',
      snapshot({ platform: 'linux', capabilities: { autoLaunch: true } }),
    );
    expect(result.state).toBe('OS_UNSUPPORTED');
  });

  it('checks store policy before the plain capability gap, so policy wins', () => {
    // appUpdates capability is false AND the distribution restricts it — the
    // reason should reflect the store restriction, not a generic "unsupported".
    const result = evaluate(
      'appUpdates',
      snapshot({ platform: 'macos', distribution: 'mac-app-store', capabilities: { appUpdates: false } }),
    );
    expect(result.state).toBe('STORE_RESTRICTED');
  });

  it('marks a comingSoon feature as COMING_SOON regardless of everything else', () => {
    const def: FeatureDefinition = {
      id: 'future-thing',
      name: 'Future Thing',
      description: 'test',
      platforms: ['windows'],
      comingSoon: true,
    };
    const result = evaluateFeature(def, snapshot());
    expect(result.state).toBe('COMING_SOON');
  });

  it('treats requiredPlan as always satisfied — there is no real billing backend yet', () => {
    const def: FeatureDefinition = {
      id: 'pro-thing',
      name: 'Pro Thing',
      description: 'test',
      platforms: ['windows'],
      requiredPlan: 'pro',
    };
    const result = evaluateFeature(def, snapshot());
    expect(result.state).toBe('AVAILABLE');
  });

  it('returns HIDDEN with a clear reason for an unknown feature id', () => {
    const result = evaluate('does-not-exist', snapshot());
    expect(result.state).toBe('HIDDEN');
    expect(result.reason).toContain('does-not-exist');
  });

  it('evaluateAll returns one evaluation per registered feature', () => {
    const results = evaluateAll(snapshot());
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => typeof r.state === 'string')).toBe(true);
  });
});
