import { api } from '../support/api-client.js';

/** Unique per run so repeated runs do not collide on the email unique index. */
const suffix = Date.now();
const user = {
  name: 'E2E Tester',
  email: `e2e-${suffix}@example.com`,
  password: 'Correct1HorseBattery',
};

describe('POST /auth/register', () => {
  it('creates an account and returns a user with an access token', async () => {
    const res = await api.post('/auth/register', {
      ...user,
      confirmPassword: user.password,
      acceptTerms: true,
    });

    expect(res.status).toBe(201);
    expect(res.data.user.email).toBe(user.email);
    expect(res.data.accessToken).toEqual(expect.any(String));
    expect(res.data.tokenType).toBe('Bearer');
  });

  it('never returns the password hash', async () => {
    const res = await api.post('/auth/register', {
      name: 'Hash Check',
      email: `hash-${suffix}@example.com`,
      password: user.password,
      confirmPassword: user.password,
      acceptTerms: true,
    });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.data)).not.toContain('passwordHash');
    expect(res.data.user.passwordHash).toBeUndefined();
  });

  it('sets the refresh token as an httpOnly cookie and also returns it in the body', async () => {
    const res = await api.post('/auth/register', {
      name: 'Cookie Check',
      email: `cookie-${suffix}@example.com`,
      password: user.password,
      confirmPassword: user.password,
      acceptTerms: true,
    });

    const cookies = res.headers['set-cookie'] ?? [];
    const refresh = cookies.find((c: string) => c.startsWith('onetab_rt='));

    expect(refresh).toBeDefined();
    expect(refresh).toContain('HttpOnly');
    // The body copy exists for clients that cannot use the cookie — the desktop
    // shell, and a browser holding this as a background account in a
    // multi-account session (a browser has only one refresh cookie).
    expect(res.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a weak password with field-level errors', async () => {
    const res = await api.post('/auth/register', {
      name: 'Weak',
      email: `weak-${suffix}@example.com`,
      password: 'short',
      confirmPassword: 'short',
      acceptTerms: true,
    });

    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_FAILED');
    expect(res.data.errors.password.length).toBeGreaterThan(0);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await api.post('/auth/register', {
      ...user,
      confirmPassword: user.password,
      acceptTerms: true,
    });

    expect(res.status).toBe(409);
    expect(res.data.code).toBe('CONFLICT');
  });
});

describe('POST /auth/login', () => {
  it('signs in with valid credentials', async () => {
    const res = await api.post('/auth/login', {
      email: user.email,
      password: user.password,
      rememberMe: false,
    });

    expect(res.status).toBe(200);
    expect(res.data.user.email).toBe(user.email);
  });

  it('gives the same generic error for a wrong password', async () => {
    const res = await api.post('/auth/login', {
      email: user.email,
      password: 'WrongPassword1X',
      rememberMe: false,
    });

    expect(res.status).toBe(401);
    expect(res.data.code).toBe('INVALID_CREDENTIALS');
  });

  it('does not reveal whether an account exists', async () => {
    const unknown = await api.post('/auth/login', {
      email: `nobody-${suffix}@example.com`,
      password: 'WrongPassword1X',
      rememberMe: false,
    });

    // Identical status and code to the wrong-password case above.
    expect(unknown.status).toBe(401);
    expect(unknown.data.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('multi-account refresh & logout (body refresh token)', () => {
  async function freshAccount(label: string) {
    const res = await api.post('/auth/register', {
      name: label,
      email: `multi-${label}-${suffix}@example.com`,
      password: user.password,
      confirmPassword: user.password,
      acceptTerms: true,
    });
    return res.data as { accessToken: string; refreshToken: string };
  }

  it('rotates a session from a refresh token in the request body (no cookie)', async () => {
    const account = await freshAccount('rotate');

    const refreshed = await api.post('/auth/refresh', {
      refreshToken: account.refreshToken,
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.data.accessToken).toEqual(expect.any(String));
    // The rotated token comes back so the client can persist it.
    expect(refreshed.data.refreshToken).toEqual(expect.any(String));
    expect(refreshed.data.refreshToken).not.toBe(account.refreshToken);

    // The spent token is dead — replaying it revokes the family.
    const replay = await api.post('/auth/refresh', {
      refreshToken: account.refreshToken,
    });
    expect(replay.status).toBe(401);
  });

  it('a body-token refresh promotes that account into the refresh cookie', async () => {
    const account = await freshAccount('promote');

    const refreshed = await api.post('/auth/refresh', {
      refreshToken: account.refreshToken,
    });

    // The rotated token replaces the cookie, so the cookie always tracks the
    // account that was just refreshed — the one the client is switching to.
    const setCookie = refreshed.headers['set-cookie'] ?? [];
    const cookie = setCookie.find((c: string) => c.startsWith('onetab_rt='));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
  });

  it('logout with a body refresh token revokes just that background session', async () => {
    const account = await freshAccount('logout');

    // Removing a background account runs while another account is signed in, so
    // the call is authenticated — here, with the account's own still-valid token.
    const out = await api.post(
      '/auth/logout',
      { refreshToken: account.refreshToken },
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    expect(out.status).toBe(204);

    const afterLogout = await api.post('/auth/refresh', {
      refreshToken: account.refreshToken,
    });
    expect(afterLogout.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the caller profile for a valid token', async () => {
    const login = await api.post('/auth/login', {
      email: user.email,
      password: user.password,
      rememberMe: false,
    });

    const res = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${login.data.accessToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.email).toBe(user.email);
    expect(res.data.passwordHash).toBeUndefined();
  });
});

describe('POST /auth/forgot-password', () => {
  it('responds identically for known and unknown addresses', async () => {
    const known = await api.post('/auth/forgot-password', {
      email: user.email,
    });
    const unknown = await api.post('/auth/forgot-password', {
      email: `nobody-${suffix}@example.com`,
    });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.data.message).toBe(unknown.data.message);
  });
});
