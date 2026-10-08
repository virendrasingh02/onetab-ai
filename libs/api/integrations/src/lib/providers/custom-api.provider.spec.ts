import { describe, expect, it, vi } from 'vitest';
import type { IntegrationEncryptionService } from '../core/integration-encryption.service.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import { CustomApiProvider, customApiConfigFromMetadata } from './custom-api.provider.js';

describe('CustomApiProvider', () => {
  const ssrfGuard = new SSRFGuardService();
  const encryption = { decrypt: (c: string) => c.replace(/^enc:/, '') } as unknown as IntegrationEncryptionService;
  const provider = new CustomApiProvider(ssrfGuard, encryption);

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

  it('offers a read and a confirmed write, so any custom API can be an agent tool', () => {
    expect(provider.getActions().map((a) => [a.id, a.permissionLevel, a.requiresConfirmation])).toEqual([
      ['get', 'read', false],
      ['send', 'write', true],
    ]);
  });

  it('can start an agent on new items from any list endpoint', () => {
    expect(provider.getTriggers()).toEqual([expect.objectContaining({ id: 'new_item', pollActionId: 'get', itemsPath: '' })]);
  });

  it('decrypts every stored secret only for the call', () => {
    const config = customApiConfigFromMetadata(
      {
        baseUrl: 'https://api.example.com',
        authType: 'BEARER',
        bearerToken: '••••',
        encryptedBearer: 'enc:tok',
        customHeaders: { 'X-Key': '••••' },
        encryptedCustomHeaders: 'enc:{"X-Key":"secret"}',
      },
      encryption.decrypt.bind(encryption),
    );
    expect(config).toMatchObject({ bearerToken: 'tok', customHeaders: { 'X-Key': 'secret' } });
  });

  it('runs a GET through the guarded request path and reports the status', async () => {
    const spy = vi.spyOn(provider, 'executeCustomRequest').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { orders: [] },
      durationMs: 5,
    });
    const res = await provider.executeAction(
      { id: 'i', provider: 'CUSTOM_API', scopeType: 'WORKSPACE', accessToken: '', metadata: { baseUrl: 'https://api.example.com' }, scopes: [] },
      'get',
      { path: '/orders', query: '{"status":"open"}' },
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://api.example.com' }), {
      method: 'GET',
      path: '/orders',
      query: { status: 'open' },
    });
    expect(res).toEqual({ success: true, message: 'GET /orders → 200 OK', data: { orders: [] } });
  });

  it('refuses a send without a write method', async () => {
    await expect(
      provider.executeAction(
        { id: 'i', provider: 'CUSTOM_API', scopeType: 'WORKSPACE', accessToken: '', metadata: { baseUrl: 'https://api.example.com' }, scopes: [] },
        'send',
        { method: 'TRACE', path: '/x' },
      ),
    ).rejects.toThrow(/Pick a method/);
  });
});
