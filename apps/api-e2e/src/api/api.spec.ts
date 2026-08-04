import { api } from '../support/api-client';

describe('GET /api', () => {
  it('should return a message', async () => {
    const res = await api.get('/api');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Hello API' });
  });
});
