import { api } from '../support/api-client.js';

describe('GET /health', () => {
  it('reports the process and database as healthy', async () => {
    const res = await api.get('/health');

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof res.data.uptime).toBe('number');
  });

  it('is public — no bearer token required', async () => {
    const res = await api.get('/health', {
      headers: { Authorization: '' },
    });
    expect(res.status).toBe(200);
  });
});

describe('authentication is required by default', () => {
  it('rejects an unauthenticated request to a protected route', async () => {
    const res = await api.get('/workspaces');

    expect(res.status).toBe(401);
    expect(res.data.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed bearer token', async () => {
    const res = await api.get('/workspaces', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });
});
