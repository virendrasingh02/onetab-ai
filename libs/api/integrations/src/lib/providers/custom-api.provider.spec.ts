import { describe, expect, it } from 'vitest';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import { CustomApiProvider } from './custom-api.provider.js';

describe('CustomApiProvider', () => {
  const ssrfGuard = new SSRFGuardService();
  const provider = new CustomApiProvider(ssrfGuard);

  it('exposes accurate custom API capabilities', () => {
    const caps = provider.getCapabilities();

    expect(caps.provider).toBe('CUSTOM_API');
    expect(caps.supportsCustomEndpoints).toBe(true);
    expect(caps.supportsSync).toBe(true);
  });

  it('blocks connection testing against private or loopback destinations (SSRF check)', async () => {
    const result = await provider.testConnection({
      baseUrl: 'http://127.0.0.1:8080/api',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('failed');
  });
});
