import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorHttpError, connectorRequest, retryAfterMs } from './connector-http.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const noWait = async () => undefined;

const reply = (status: number, data: unknown = {}, headers: Record<string, string> = {}) => ({ status, data, headers });

afterEach(() => request.mockReset());

describe('connectorRequest', () => {
  it('returns the body of a successful call', async () => {
    request.mockResolvedValueOnce(reply(200, { ok: true }));
    const res = await connectorRequest('Shopify', { method: 'GET', url: 'https://x' }, noWait);
    expect(res.data).toEqual({ ok: true });
  });

  it('waits as long as the app asks and repeats a rate-limited request, even a POST', async () => {
    const wait = vi.fn(async () => undefined);
    request.mockResolvedValueOnce(reply(429, {}, { 'retry-after': '2' })).mockResolvedValueOnce(reply(200, { sent: 1 }));
    const res = await connectorRequest('WhatsApp', { method: 'POST', url: 'https://x' }, wait);
    expect(res.data).toEqual({ sent: 1 });
    expect(wait).toHaveBeenCalledWith(2000);
  });

  it('retries a failing read but never repeats a POST that may have landed', async () => {
    request.mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(200, { n: 1 }));
    await expect(connectorRequest('App', { method: 'GET', url: 'https://x' }, noWait)).resolves.toMatchObject({ data: { n: 1 } });

    request.mockReset();
    request.mockResolvedValueOnce(reply(503));
    await expect(connectorRequest('App', { method: 'POST', url: 'https://x' }, noWait)).rejects.toBeInstanceOf(ConnectorHttpError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget and names the app without echoing request headers', async () => {
    request.mockResolvedValue(reply(500, { message: 'boom' }));
    const error = await connectorRequest('Shopify', { method: 'GET', url: 'https://x', headers: { Authorization: 'Bearer secret' }, retries: 1 }, noWait).catch(
      (e) => e as ConnectorHttpError,
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(error.message).toContain('Shopify');
    expect(error.message).not.toContain('secret');
  });

  it('explains rejected credentials and carries the app’s own error code', async () => {
    request.mockResolvedValueOnce(reply(401, { error: { code: 190, message: 'Invalid OAuth access token' } }));
    const error = await connectorRequest('WhatsApp', { method: 'GET', url: 'https://x' }, noWait).catch((e) => e as ConnectorHttpError);
    expect(error.status).toBe(401);
    expect(error.providerCode).toBe(190);
    expect(error.message).toMatch(/Reconnect WhatsApp/);
  });
});

describe('retryAfterMs', () => {
  it('reads seconds and dates, ignoring junk', () => {
    expect(retryAfterMs('3')).toBe(3000);
    expect(retryAfterMs('Wed, 14 Oct 2026 10:00:05 GMT', Date.parse('Wed, 14 Oct 2026 10:00:00 GMT'))).toBe(5000);
    expect(retryAfterMs('soon')).toBeUndefined();
    expect(retryAfterMs(undefined)).toBeUndefined();
  });
});
