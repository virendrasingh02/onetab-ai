import { describe, expect, it } from 'vitest';
import { resolveSafeHandoff } from './safe-handoff-redirect';

describe('resolveSafeHandoff', () => {
  it('allows sibling subdomains of the app domain', () => {
    const handoff = resolveSafeHandoff(
      'https://studio.onetab.ai/agents',
      'https://app.onetab.ai',
      'app.onetab.ai',
    );
    expect(handoff?.crossOrigin).toBe(true);
  });

  it('rejects other tunnels on a shared tunnel domain', () => {
    expect(
      resolveSafeHandoff(
        'https://evil-tunnel.trycloudflare.com/',
        'https://web-tunnel.trycloudflare.com',
        'web-tunnel.trycloudflare.com',
      ),
    ).toBeNull();
  });

  it('allows the configured Studio origin on a shared tunnel domain', () => {
    const handoff = resolveSafeHandoff(
      'https://studio-tunnel.trycloudflare.com/agents',
      'https://web-tunnel.trycloudflare.com',
      'web-tunnel.trycloudflare.com',
      'https://studio-tunnel.trycloudflare.com',
    );
    expect(handoff?.crossOrigin).toBe(true);
  });
});
