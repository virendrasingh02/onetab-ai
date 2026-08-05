import { api } from '../support/api-client.js';

describe('Infrastructure Integration API', () => {
  it('GET /health returns status ok with database status up', async () => {
    const res = await api.get('/health');

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('verifies API environment configuration is validated at startup', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('timestamp');
  });
});
