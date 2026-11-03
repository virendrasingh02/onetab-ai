import { createHash } from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discoverMCPTools, MCPAuthRequiredError } from './mcp-client.js';
import {
  buildAuthorizeUrl,
  canonicalResource,
  createPkce,
  discoverOAuthServer,
  exchangeCode,
  parseWwwAuthenticate,
  refreshAccessToken,
  registerClient,
} from './mcp-oauth.js';

/** An MCP server at /mcp guarded by an RFC 9728 + RFC 8414 authorization server. */
function createFakeAuthServer() {
  let base = '';
  const issued: {
    challenge?: string;
    registrations: number;
    tokenForms: URLSearchParams[];
  } = {
    registrations: 0,
    tokenForms: [],
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const json = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      switch (req.url) {
        case '/mcp':
          if (
            req.headers['authorization'] !== 'Bearer at-1' &&
            req.headers['authorization'] !== 'Bearer at-2'
          ) {
            res.writeHead(401, {
              'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="tasks:read"`,
            });
            res.end();
            return;
          }
          {
            const msg = JSON.parse(raw) as { id?: number; method: string };
            if (msg.method === 'notifications/initialized') {
              res.writeHead(202);
              res.end();
              return;
            }
            json(200, {
              jsonrpc: '2.0',
              id: msg.id,
              result:
                msg.method === 'initialize'
                  ? { protocolVersion: '2025-06-18' }
                  : { tools: [{ name: 'list_tasks' }] },
            });
          }
          return;
        case '/.well-known/oauth-protected-resource/mcp':
          json(200, {
            resource: `${base}/mcp`,
            authorization_servers: [`${base}/auth`],
          });
          return;
        case '/.well-known/oauth-authorization-server/auth':
          json(200, {
            issuer: `${base}/auth`,
            authorization_endpoint: `${base}/auth/authorize`,
            token_endpoint: `${base}/auth/token`,
            registration_endpoint: `${base}/auth/register`,
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: [
              'none',
              'client_secret_post',
            ],
          });
          return;
        case '/auth/register':
          issued.registrations++;
          json(201, { client_id: 'dyn-client', ...JSON.parse(raw) });
          return;
        case '/auth/token': {
          const form = new URLSearchParams(raw);
          issued.tokenForms.push(form);
          if (form.get('grant_type') === 'authorization_code') {
            const ok =
              form.get('code') === 'code-1' &&
              createHash('sha256')
                .update(form.get('code_verifier') ?? '')
                .digest('base64url') === issued.challenge;
            if (!ok)
              return json(400, {
                error: 'invalid_grant',
                error_description: 'bad verifier',
              });
            return json(200, {
              access_token: 'at-1',
              refresh_token: 'rt-1',
              expires_in: 3600,
            });
          }
          if (
            form.get('grant_type') === 'refresh_token' &&
            form.get('refresh_token') === 'rt-1'
          ) {
            return json(200, { access_token: 'at-2', expires_in: 3600 });
          }
          return json(400, { error: 'invalid_grant' });
        }
        default:
          res.writeHead(404);
          res.end();
      }
    });
  });
  return {
    server,
    issued,
    setBase: (b: string) => {
      base = b;
    },
  };
}

describe('MCP OAuth', () => {
  const fake = createFakeAuthServer();
  let base = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      fake.server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
    fake.setBase(base);
  });
  afterAll(
    () => new Promise<void>((resolve) => fake.server.close(() => resolve())),
  );

  it('parses a WWW-Authenticate challenge', () => {
    expect(
      parseWwwAuthenticate(
        'Bearer realm="x", resource_metadata="https://a.example/.well-known/oauth-protected-resource", scope="a b"',
      ),
    ).toEqual({
      resourceMetadataUrl:
        'https://a.example/.well-known/oauth-protected-resource',
      scope: 'a b',
    });
    expect(parseWwwAuthenticate(undefined)).toEqual({});
  });

  it('canonicalises the resource URI', () => {
    expect(canonicalResource('https://mcp.example.com/')).toBe(
      'https://mcp.example.com',
    );
    expect(canonicalResource('https://mcp.example.com/v2/mcp#x')).toBe(
      'https://mcp.example.com/v2/mcp',
    );
  });

  it('surfaces a 401 as auth-required with the server hint', async () => {
    const err = await discoverMCPTools({
      url: `${base}/mcp`,
      allowPrivateNetwork: true,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(MCPAuthRequiredError);
    expect((err as MCPAuthRequiredError).hint).toEqual({
      resourceMetadataUrl: `${base}/.well-known/oauth-protected-resource/mcp`,
      scope: 'tasks:read',
    });
  });

  it('discovers, registers, authorizes with PKCE, exchanges, and refreshes', async () => {
    const hint = parseWwwAuthenticate(
      `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="tasks:read"`,
    );
    const as = await discoverOAuthServer(`${base}/mcp`, hint, true);
    expect(as).toMatchObject({
      authorizationEndpoint: `${base}/auth/authorize`,
      tokenEndpoint: `${base}/auth/token`,
      resource: `${base}/mcp`,
      scope: 'tasks:read',
    });

    const redirect = 'http://localhost:3000/api/v1/mcp-oauth/callback';
    const client = await registerClient(as, redirect, true);
    expect(client.clientId).toBe('dyn-client');

    const pkce = createPkce();
    fake.issued.challenge = pkce.challenge;
    const url = new URL(
      buildAuthorizeUrl(as, client, redirect, 'conn.nonce', pkce.challenge),
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'dyn-client',
      code_challenge_method: 'S256',
      resource: `${base}/mcp`,
      state: 'conn.nonce',
      scope: 'tasks:read',
    });

    await expect(
      exchangeCode(as, client, 'code-1', 'wrong', redirect, true),
    ).rejects.toThrow(/bad verifier/);
    const tokens = await exchangeCode(
      as,
      client,
      'code-1',
      pkce.verifier,
      redirect,
      true,
    );
    expect(tokens).toMatchObject({ accessToken: 'at-1', refreshToken: 'rt-1' });
    expect(fake.issued.tokenForms.at(-1)?.get('resource')).toBe(`${base}/mcp`);

    const ok = await discoverMCPTools({
      url: `${base}/mcp`,
      token: tokens.accessToken,
      allowPrivateNetwork: true,
    });
    expect(ok.tools.map((t) => t.name)).toEqual(['list_tasks']);

    const refreshed = await refreshAccessToken(as, client, 'rt-1', true);
    expect(refreshed.accessToken).toBe('at-2');
  });
});
