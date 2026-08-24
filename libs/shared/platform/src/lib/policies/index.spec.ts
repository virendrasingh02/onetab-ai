import { describe, expect, it } from 'vitest';
import {
  appleAppStorePolicy,
  appleDirectPolicy,
  linuxPolicy,
  microsoftDirectPolicy,
  microsoftStorePolicy,
  resolvePolicy,
  webPolicy,
} from './index.js';

describe('resolvePolicy', () => {
  it('pairs platform and distribution, since "direct" means something different per OS', () => {
    expect(resolvePolicy('macos', 'direct')).toBe(appleDirectPolicy);
    expect(resolvePolicy('macos', 'mac-app-store')).toBe(appleAppStorePolicy);
    expect(resolvePolicy('windows', 'direct')).toBe(microsoftDirectPolicy);
    expect(resolvePolicy('windows', 'microsoft-store')).toBe(microsoftStorePolicy);
    expect(resolvePolicy('linux', 'direct')).toBe(linuxPolicy);
    expect(resolvePolicy('web', 'web')).toBe(webPolicy);
  });

  it('fails safe to the web policy for a nonsensical combination', () => {
    expect(resolvePolicy('windows', 'mac-app-store')).toBe(webPolicy);
  });

  it('never forbids a capability without also restricting the feature that requires it', () => {
    for (const policy of [
      appleDirectPolicy,
      appleAppStorePolicy,
      microsoftDirectPolicy,
      microsoftStorePolicy,
      linuxPolicy,
      webPolicy,
    ]) {
      expect(Array.isArray(policy.restrictedFeatureIds)).toBe(true);
      expect(Array.isArray(policy.forbiddenCapabilities)).toBe(true);
      expect(policy.label.length).toBeGreaterThan(0);
      expect(policy.notes.length).toBeGreaterThan(0);
    }
  });
});
