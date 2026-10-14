import type { CustomConnectorDefinition } from '@org/types';
import { describe, expect, it, vi } from 'vitest';
import type { IntegrationEncryptionService } from '../core/integration-encryption.service.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import { CustomApiProvider } from './custom-api.provider.js';
import { CUSTOM_CONNECTOR_KEY, CustomConnectorProvider } from './custom-connector.provider.js';

const definition: CustomConnectorDefinition = {
  name: 'Orders',
  description: 'Orders API',
  category: 'commerce',
  baseUrl: 'https://api.example.com',
  authType: 'BEARER',
  actions: [
    { id: 'list_orders', label: 'List orders', description: 'List.', method: 'GET', path: '/orders', params: [] },
    {
      id: 'cancel_order',
      label: 'Cancel order',
      description: 'Cancel.',
      method: 'DELETE',
      path: '/orders/{{id}}',
      params: [{ name: 'id', type: 'string', required: true }],
    },
  ],
  triggers: [{ id: 'new_order', label: 'New order', actionId: 'list_orders', itemsPath: 'orders', idField: 'id' }],
};

const credential = (): ResolvedCredential => ({
  id: 'cc_1',
  provider: 'CUSTOM_ORDERS_AAAAAAAA',
  scopeType: 'WORKSPACE',
  accessToken: '',
  scopes: [],
  metadata: { baseUrl: 'https://api.example.com', authType: 'BEARER', encryptedBearer: 'enc:tok', [CUSTOM_CONNECTOR_KEY]: definition },
});

describe('CustomConnectorProvider', () => {
  const encryption = { decrypt: (c: string) => c.replace(/^enc:/, '') } as unknown as IntegrationEncryptionService;
  const http = new CustomApiProvider(new SSRFGuardService(), encryption);
  const provider = new CustomConnectorProvider(http, encryption);

  it('exposes the connection’s own actions and events', () => {
    expect(provider.getActionsFor(credential()).map((a) => [a.id, a.permissionLevel, a.requiresConfirmation])).toEqual([
      ['list_orders', 'read', false],
      ['cancel_order', 'destructive', true],
    ]);
    expect(provider.getTriggersFor(credential())).toEqual([expect.objectContaining({ id: 'new_order', pollActionId: 'list_orders', itemsPath: 'orders' })]);
  });

  it('runs an action through the guarded request path with the decrypted secret', async () => {
    const spy = vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: { ok: true }, durationMs: 1 });
    const result = await provider.executeAction(credential(), 'cancel_order', { id: 'a b' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ bearerToken: 'tok', baseUrl: 'https://api.example.com' }), {
      method: 'DELETE',
      path: '/orders/a%20b',
      query: {},
    });
    expect(result).toMatchObject({ success: true, data: { ok: true } });
  });

  it('reports a failing status as a failed result, not a throw', async () => {
    vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status: 404, statusText: 'Not Found', headers: {}, data: null, durationMs: 1 });
    const result = await provider.executeAction(credential(), 'list_orders', {});
    expect(result.success).toBe(false);
    expect(result.message).toContain('404');
  });

  it('refuses an unknown action and a missing required input', async () => {
    await expect(provider.executeAction(credential(), 'nope', {})).rejects.toThrow("no action 'nope'");
    await expect(provider.executeAction(credential(), 'cancel_order', {})).rejects.toThrow('required');
  });

  it('treats a refused credential as a failed connection test', async () => {
    vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status: 401, statusText: 'Unauthorized', headers: {}, data: null, durationMs: 1 });
    await expect(provider.getAccount(credential())).rejects.toThrow('refused the saved sign-in');
    vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status: 404, statusText: 'Not Found', headers: {}, data: null, durationMs: 1 });
    await expect(provider.getAccount(credential())).resolves.toMatchObject({ name: 'Orders', status: 'CONNECTED' });
  });
});
