import { createVerify, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OAuthAuthService } from './oauth-auth.service.js';
import type { AuthService } from './auth.service.js';

vi.mock('axios');

/* --- Fake identity provider ------------------------------------------------ */

function rsaKey(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}

const googleKey = rsaKey('google-1');
const appleKey = rsaKey('apple-1');
const attackerKey = rsaKey('google-1'); // same kid, different key

const appleTeamKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const APPLE_PRIVATE_KEY_PEM = appleTeamKey.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

function signIdToken(
  claims: Record<string, unknown>,
  { key, kid, alg = 'RS256' }: { key: KeyObject; kid: string; alg?: string },
): string {
  const header = Buffer.from(JSON.stringify({ alg, kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

const now = () => Math.floor(Date.now() / 1000);

function googleClaims(nonce: string, overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    sub: 'google-sub-1',
    email: 'Alex@Example.com',
    email_verified: true,
    name: 'Alex Mercer',
    picture: 'https://example.com/a.png',
    iat: now(),
    exp: now() + 3600,
    nonce,
    ...overrides,
  };
}

/* --- Harness --------------------------------------------------------------- */

const config: Record<string, string> = {
  NODE_ENV: 'test',
  WEB_APP_URL: 'http://localhost:4200',
  API_URL: 'http://localhost:3000/api/v1',
  JWT_ACCESS_SECRET: 'test-access-secret',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  APPLE_CLIENT_ID: 'com.onetab.web',
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: APPLE_PRIVATE_KEY_PEM,
};

const session = { tokens: { accessToken: 'at' }, refreshToken: 'rt', refreshExpiresAt: new Date() };

let prisma: any;
let auth: { signInWithFederatedIdentity: ReturnType<typeof vi.fn> };
let service: OAuthAuthService;
let configValues: Record<string, string>;

function makeService() {
  const configService = {
    get: vi.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback),
    getOrThrow: vi.fn((key: string) => {
      if (!configValues[key]) throw new Error(`missing ${key}`);
      return configValues[key];
    }),
  } as unknown as ConfigService;
  return new OAuthAuthService(prisma, configService, auth as unknown as AuthService);
}

/** Starts a flow and reads back its state + nonce the way the provider would see them. */
function begin(provider: 'google' | 'apple', options: Record<string, string> = {}, linkUserId?: string) {
  const { url, flowCookie } = service.start(provider, options, linkUserId);
  const params = new URL(url).searchParams;
  return { url, flowCookie, state: params.get('state')!, nonce: params.get('nonce')! };
}

/** Makes the token endpoint return `idToken`. */
function providerReturns(idToken: string) {
  vi.mocked(axios.post).mockResolvedValue({ data: { id_token: idToken } });
}

beforeEach(() => {
  vi.clearAllMocks();
  configValues = { ...config };

  vi.mocked(axios.get).mockImplementation(async (url: string) => ({
    data: { keys: url.includes('apple') ? [appleKey.jwk] : [googleKey.jwk] },
  }));

  prisma = {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    userIdentity: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  auth = {
    signInWithFederatedIdentity: vi.fn().mockResolvedValue({ user: { id: 'u1' }, session }),
  };
  service = makeService();
});

/* --- Tests ----------------------------------------------------------------- */

describe('OAuthAuthService.start', () => {
  it('builds a Google URL with PKCE + nonce and keeps the verifier out of the URL', () => {
    const { url, flowCookie, state, nonce } = begin('google', { returnTo: '/w/acme' });
    const params = new URL(url).searchParams;

    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBeTruthy();
    expect(params.get('access_type')).toBeNull();
    expect(state).toHaveLength(43);
    expect(nonce).toHaveLength(43);

    const flow = service.openFlow(flowCookie)!;
    expect(flow.state).toBe(state);
    expect(flow.returnTo).toBe('/w/acme');
    expect(url).not.toContain(flow.pkceVerifier!);
    expect(flowCookie).not.toContain(state); // sealed, not merely encoded
  });

  it('asks Apple for a code only, via form_post', () => {
    const params = new URL(begin('apple').url).searchParams;
    expect(params.get('response_type')).toBe('code');
    expect(params.get('response_mode')).toBe('form_post');
  });

  it('refuses a provider without credentials', () => {
    delete configValues['GOOGLE_CLIENT_SECRET'];
    expect(() => service.start('google', {})).toThrow(ServiceUnavailableException);
    expect(service.isConfigured('google')).toBe(false);
    expect(service.isConfigured('apple')).toBe(true);
  });

  it('drops off-site returnTo values', () => {
    expect(service.sanitizeReturnTo('//evil.com/x')).toBeUndefined();
    expect(service.sanitizeReturnTo('/\\evil.com')).toBeUndefined();
    expect(service.sanitizeReturnTo('https://evil.com/x')).toBeUndefined();
    expect(service.sanitizeReturnTo('javascript:alert(1)')).toBeUndefined();
    expect(service.sanitizeReturnTo('http://localhost:4200/w/a?b=1')).toBe('/w/a?b=1');
  });

  it('rejects a tampered or expired flow cookie', () => {
    const { flowCookie } = begin('google');
    const tampered = flowCookie.slice(0, -2) + (flowCookie.endsWith('A') ? 'BB' : 'AA');
    expect(service.openFlow(tampered)).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(service.openFlow(flowCookie)).toBeNull();
    vi.useRealTimers();
  });
});

describe('OAuthAuthService.handleCallback — security', () => {
  it('rejects a callback whose browser never started the flow (login CSRF)', async () => {
    const { state } = begin('google');
    const out = await service.handleCallback('google', { code: 'c', state }, undefined, {});
    expect(out.redirectTo).toBe('http://localhost:4200/login?error=oauth_state_mismatch');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects a state that does not match the flow cookie', async () => {
    const { flowCookie } = begin('google');
    const out = await service.handleCallback('google', { code: 'c', state: 'x'.repeat(43) }, flowCookie, {});
    expect(out.redirectTo).toContain('error=oauth_state_mismatch');
  });

  it('rejects a Google flow cookie replayed at the Apple callback', async () => {
    const { flowCookie, state } = begin('google');
    const out = await service.handleCallback('apple', { code: 'c', state }, flowCookie, {});
    expect(out.redirectTo).toContain('error=oauth_state_mismatch');
  });

  it('rejects an ID token signed by anyone but the provider', async () => {
    const { flowCookie, state, nonce } = begin('google');
    providerReturns(signIdToken(googleClaims(nonce), { key: attackerKey.privateKey, kid: 'google-1' }));

    const out = await service.handleCallback('google', { code: 'c', state }, flowCookie, {});
    expect(out.redirectTo).toContain('error=oauth_invalid_token');
    expect(out.session).toBeUndefined();
    expect(auth.signInWithFederatedIdentity).not.toHaveBeenCalled();
  });

  it('rejects an ID token with an unknown key id', async () => {
    const { flowCookie, state, nonce } = begin('google');
    providerReturns(signIdToken(googleClaims(nonce), { key: googleKey.privateKey, kid: 'nope' }));
    const out = await service.handleCallback('google', { code: 'c', state }, flowCookie, {});
    expect(out.redirectTo).toContain('error=oauth_invalid_token');
  });

  it.each([
    ['nonce', { nonce: 'other' }],
    ['audience', { aud: 'someone-else' }],
    ['issuer', { iss: 'https://evil.example' }],
    ['expiry', { exp: now() - 3600 }],
  ])('rejects an ID token with the wrong %s', async (_label, overrides) => {
    const { flowCookie, state, nonce } = begin('google');
    providerReturns(signIdToken(googleClaims(nonce, overrides), { key: googleKey.privateKey, kid: 'google-1' }));
    const out = await service.handleCallback('google', { code: 'c', state }, flowCookie, {});
    expect(out.redirectTo).toContain('error=oauth_invalid_token');
  });

  it('refuses to match an account by an email the provider has not verified', async () => {
    const { flowCookie, state, nonce } = begin('google');
    providerReturns(
      signIdToken(googleClaims(nonce, { email_verified: false }), { key: googleKey.privateKey, kid: 'google-1' }),
    );
    prisma.userIdentity.findUnique.mockResolvedValue(null);

    const out = await service.handleCallback('google', { code: 'c', state }, flowCookie, {});
    expect(out.redirectTo).toContain('error=oauth_email_unverified');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('maps a provider cancel to oauth_cancelled and keeps the desktop handoff', async () => {
    const { flowCookie } = begin('google', { desktop: 'true', state: 'ds', code_challenge: 'dc' });
    const out = await service.handleCallback('google', { error: 'access_denied' }, flowCookie, {});
    const url = new URL(out.redirectTo);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('error')).toBe('oauth_cancelled');
    expect(url.searchParams.get('desktop')).toBe('true');
    expect(url.searchParams.get('state')).toBe('ds');
  });
});

describe('OAuthAuthService.handleCallback — sign-in', () => {
  async function googleSignIn(options: Record<string, string> = {}, claimOverrides = {}) {
    const { flowCookie, state, nonce } = begin('google', options);
    providerReturns(signIdToken(googleClaims(nonce, claimOverrides), { key: googleKey.privateKey, kid: 'google-1' }));
    return service.handleCallback('google', { code: 'auth-code', state }, flowCookie, { ipAddress: '1.2.3.4' });
  }

  it('signs in a user whose identity is already linked', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue({ id: 'i1', userId: 'u1', email: 'alex@example.com' });

    const out = await googleSignIn({ returnTo: '/w/acme/chat' });

    expect(out).toEqual({ redirectTo: 'http://localhost:4200/w/acme/chat', session });
    expect(auth.signInWithFederatedIdentity).toHaveBeenCalledWith('u1', 'google', { ipAddress: '1.2.3.4' });
    const body = vi.mocked(axios.post).mock.calls[0]![1] as URLSearchParams;
    expect(body.get('code_verifier')).toBeTruthy();
    expect(prisma.userIdentity.update).not.toHaveBeenCalled();
  });

  it('links to a verified account with the same email and keeps its password', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u2',
      emailVerifiedAt: new Date(),
      avatarUrl: null,
      passwordHash: 'hash',
    });

    await googleSignIn();

    expect(prisma.userIdentity.create).toHaveBeenCalledWith({
      data: { userId: 'u2', provider: 'google', providerUserId: 'google-sub-1', email: 'alex@example.com' },
    });
    const update = prisma.user.update.mock.calls[0][0];
    expect(update.data.passwordHash).toBeUndefined();
    expect(update.data.avatarUrl).toBe('https://example.com/a.png');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(auth.signInWithFederatedIdentity).toHaveBeenCalledWith('u2', 'google', expect.anything());
  });

  it('wipes credentials of an unverified squatter account before linking it', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({
      id: 'u3',
      emailVerifiedAt: null,
      avatarUrl: null,
      passwordHash: 'attacker-chosen',
    });

    await googleSignIn();

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u3', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const update = prisma.user.update.mock.calls[0][0];
    expect(update.data.passwordHash).toBeNull();
    expect(update.data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('creates a passwordless, verified account for a new email', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u4' });

    const out = await googleSignIn();

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'alex@example.com',
      name: 'Alex Mercer',
      passwordHash: null,
      identities: { create: { provider: 'google', providerUserId: 'google-sub-1' } },
    });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(out.session).toBe(session);
  });

  it('resolves to the winner when a concurrent callback created the identity first', async () => {
    prisma.userIdentity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'u-winner' });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    await googleSignIn();
    expect(auth.signInWithFederatedIdentity).toHaveBeenCalledWith('u-winner', 'google', expect.anything());
  });

  it('hands a two-factor account to the code step without issuing a session', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue({ id: 'i1', userId: 'u1', email: 'alex@example.com' });
    auth.signInWithFederatedIdentity.mockResolvedValue({
      twoFactor: { requiresTwoFactor: true, challengeToken: 'chal', expiresAt: '2030-01-01T00:00:00.000Z' },
    });

    const out = await googleSignIn({ returnTo: '/w/acme' });

    expect(out.session).toBeUndefined();
    const url = new URL(out.redirectTo);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('returnTo')).toBe('/w/acme');
    expect(url.search).not.toContain('chal');
    expect(new URLSearchParams(url.hash.slice(1)).get('two_factor')).toBe('chal');
  });

  it('sends a desktop handoff back through the login page', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue({ id: 'i1', userId: 'u1', email: 'alex@example.com' });

    const out = await googleSignIn({ desktop: 'true', state: 'ds', code_challenge: 'dc' });

    expect(out.session).toBe(session);
    expect(out.redirectTo).toBe('http://localhost:4200/login?desktop=true&state=ds&code_challenge=dc');
  });

  it('lands an invitation sign-in on the invite page', async () => {
    prisma.userIdentity.findUnique.mockResolvedValue({ id: 'i1', userId: 'u1', email: 'alex@example.com' });
    const out = await googleSignIn({ invitationToken: 'inv/1' });
    expect(out.redirectTo).toBe('http://localhost:4200/invite/inv%2F1');
  });

  it('signs in with Apple using a team-signed client secret and the first-login name', async () => {
    const { flowCookie, state, nonce } = begin('apple');
    providerReturns(
      signIdToken(
        {
          iss: 'https://appleid.apple.com',
          aud: 'com.onetab.web',
          sub: 'apple-sub-1',
          email: 'x1@privaterelay.appleid.com',
          email_verified: 'true',
          iat: now(),
          exp: now() + 600,
          nonce,
        },
        { key: appleKey.privateKey, kid: 'apple-1' },
      ),
    );
    prisma.userIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u5' });

    const user = JSON.stringify({ name: { firstName: 'Jane', lastName: 'Doe' } });
    const out = await service.handleCallback('apple', { code: 'c', state, user }, flowCookie, {});

    expect(out.session).toBe(session);
    expect(prisma.user.create.mock.calls[0][0].data.name).toBe('Jane Doe');

    const clientSecret = (vi.mocked(axios.post).mock.calls[0]![1] as URLSearchParams).get('client_secret')!;
    const [h, p, s] = clientSecret.split('.');
    const verifier = createVerify('SHA256').update(`${h}.${p}`);
    expect(verifier.verify({ key: appleTeamKey.publicKey, dsaEncoding: 'ieee-p1363' }, s!, 'base64url')).toBe(true);
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toMatchObject({
      iss: 'TEAM123456',
      sub: 'com.onetab.web',
      aud: 'https://appleid.apple.com',
    });
  });
});

describe('OAuthAuthService.handleCallback — linking from Settings', () => {
  async function link(identityOwner: string | null) {
    const { flowCookie, state, nonce } = begin('google', { returnTo: '/w/acme/settings/security' }, 'me');
    providerReturns(signIdToken(googleClaims(nonce), { key: googleKey.privateKey, kid: 'google-1' }));
    prisma.userIdentity.findUnique.mockResolvedValue(identityOwner ? { userId: identityOwner } : null);
    return service.handleCallback('google', { code: 'c', state }, flowCookie, {});
  }

  it('links the identity to the signed-in user without issuing a session', async () => {
    const out = await link(null);
    expect(prisma.userIdentity.create).toHaveBeenCalledWith({
      data: { userId: 'me', provider: 'google', providerUserId: 'google-sub-1', email: 'alex@example.com' },
    });
    expect(out).toEqual({ redirectTo: 'http://localhost:4200/w/acme/settings/security?linked=google' });
    expect(auth.signInWithFederatedIdentity).not.toHaveBeenCalled();
  });

  it('refuses an identity that belongs to another user', async () => {
    const out = await link('someone-else');
    expect(prisma.userIdentity.create).not.toHaveBeenCalled();
    expect(out.redirectTo).toBe(
      'http://localhost:4200/w/acme/settings/security?oauth_error=oauth_account_linked_to_other',
    );
  });
});

describe('OAuthAuthService.disconnectIdentity', () => {
  it('disconnects when a password remains', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: 'h', identities: [{ id: 'i1', provider: 'google' }] });
    await expect(service.disconnectIdentity('u1', 'google')).resolves.toEqual({ success: true });
    expect(prisma.userIdentity.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
  });

  it('disconnects when another provider remains', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash: null,
      identities: [
        { id: 'i1', provider: 'google' },
        { id: 'i2', provider: 'apple' },
      ],
    });
    await expect(service.disconnectIdentity('u1', 'google')).resolves.toEqual({ success: true });
  });

  it('refuses to remove the only sign-in method', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: null, identities: [{ id: 'i1', provider: 'google' }] });
    await expect(service.disconnectIdentity('u1', 'google')).rejects.toThrow(BadRequestException);
    expect(prisma.userIdentity.delete).not.toHaveBeenCalled();
  });

  it('rejects unknown providers and missing identities', async () => {
    await expect(service.disconnectIdentity('u1', 'github')).rejects.toThrow(BadRequestException);
    prisma.user.findUnique.mockResolvedValue({ passwordHash: 'h', identities: [] });
    await expect(service.disconnectIdentity('u1', 'apple')).rejects.toThrow(NotFoundException);
  });
});
