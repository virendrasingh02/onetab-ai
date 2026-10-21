import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import axios from 'axios';
import {
  JwksCache,
  verifyIdToken,
  type IdTokenClaims,
} from '@org/api-auth';

export interface OpenIdConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
}

export interface BuildOidcAuthUrlOptions {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  scopes?: string[];
  authorizationEndpoint?: string;
}

export interface ExchangeOidcCodeOptions {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  nonce: string;
  tokenEndpoint?: string;
  jwksUri?: string;
}

export interface OidcIdentityClaims {
  sub: string;
  email: string;
  displayName?: string;
  groups: string[];
  idTokenClaims: IdTokenClaims;
}

interface DiscoveryCacheEntry {
  config: OpenIdConfiguration;
  expiresAt: number;
}

@Injectable()
export class OidcSsoService {
  private readonly logger = new Logger(OidcSsoService.name);
  private readonly discoveryCache = new Map<string, DiscoveryCacheEntry>();
  private readonly jwksCaches = new Map<string, JwksCache>();

  /**
   * Fetches OpenID Connect discovery document (`.well-known/openid-configuration`) with 1-hour in-memory cache.
   */
  async discover(issuer: string): Promise<OpenIdConfiguration> {
    const normalizedIssuer = issuer.replace(/\/+$/, '');
    const cached = this.discoveryCache.get(normalizedIssuer);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
    try {
      const response = await axios.get<OpenIdConfiguration>(discoveryUrl, { timeout: 8000 });
      const config = response.data;
      if (!config.authorization_endpoint || !config.token_endpoint || !config.jwks_uri) {
        throw new Error('Discovery document missing required endpoints.');
      }

      this.discoveryCache.set(normalizedIssuer, {
        config,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      return config;
    } catch (err) {
      this.logger.error(`OIDC discovery failed for ${discoveryUrl}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        `Could not connect to OIDC Identity Provider at ${normalizedIssuer}. Verify the Issuer URL.`,
      );
    }
  }

  /**
   * Generates authorization URL with PKCE (RFC 7636).
   */
  async buildAuthorizationUrl(options: BuildOidcAuthUrlOptions): Promise<{ url: string; codeVerifier: string }> {
    let authEndpoint = options.authorizationEndpoint;
    if (!authEndpoint) {
      const discovery = await this.discover(options.issuer);
      authEndpoint = discovery.authorization_endpoint;
    }

    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const scopes = options.scopes?.length
      ? options.scopes.join(' ')
      : 'openid profile email';

    const params = new URLSearchParams({
      client_id: options.clientId,
      redirect_uri: options.redirectUri,
      response_type: 'code',
      scope: scopes,
      state: options.state,
      nonce: options.nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const separator = authEndpoint.includes('?') ? '&' : '?';
    return {
      url: `${authEndpoint}${separator}${params.toString()}`,
      codeVerifier,
    };
  }

  /**
   * Exchanges authorization code for tokens and validates ID token signature, issuer, audience, and nonce.
   */
  async exchangeCode(options: ExchangeOidcCodeOptions): Promise<OidcIdentityClaims> {
    let tokenEndpoint = options.tokenEndpoint;
    let jwksUri = options.jwksUri;
    let userinfoEndpoint: string | undefined;

    if (!tokenEndpoint || !jwksUri) {
      const discovery = await this.discover(options.issuer);
      tokenEndpoint = tokenEndpoint || discovery.token_endpoint;
      jwksUri = jwksUri || discovery.jwks_uri;
      userinfoEndpoint = discovery.userinfo_endpoint;
    }

    // 1. Exchange authorization code at token endpoint
    const postBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
      client_id: options.clientId,
      code_verifier: options.codeVerifier,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (options.clientSecret) {
      // Basic Auth or post body
      const credentials = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      postBody.set('client_secret', options.clientSecret);
    }

    let tokenResponseData: { id_token?: string; access_token?: string; token_type?: string };
    try {
      const res = await axios.post(tokenEndpoint, postBody.toString(), {
        headers,
        timeout: 10_000,
      });
      tokenResponseData = res.data;
    } catch (err: any) {
      const detail = err.response?.data?.error_description || err.response?.data?.error || err.message;
      this.logger.error(`OIDC token exchange error: ${detail}`);
      throw new BadRequestException(`Failed to exchange authorization code with IdP: ${detail}`);
    }

    if (!tokenResponseData.id_token) {
      throw new BadRequestException('IdP token response did not contain an id_token.');
    }

    // 2. Validate ID Token against JWKS
    let jwks = this.jwksCaches.get(jwksUri);
    if (!jwks) {
      jwks = new JwksCache(jwksUri);
      this.jwksCaches.set(jwksUri, jwks);
    }

    const cleanIssuer = options.issuer.replace(/\/+$/, '');
    const validIssuers = [cleanIssuer, `${cleanIssuer}/`];

    let claims: IdTokenClaims;
    try {
      claims = await verifyIdToken(tokenResponseData.id_token, {
        jwks,
        issuers: validIssuers,
        audience: options.clientId,
        nonce: options.nonce,
      });
    } catch (err) {
      this.logger.error(`ID token verification failed: ${(err as Error).message}`);
      throw new BadRequestException(`Invalid ID token: ${(err as Error).message}`);
    }

    // 3. Resolve user details (email, displayName, groups)
    let email = claims.email;
    let displayName = claims.name;
    const groups: string[] = [];

    // Check custom claims
    const rawClaims = claims as unknown as Record<string, unknown>;
    if (Array.isArray(rawClaims['groups'])) {
      groups.push(...(rawClaims['groups'] as string[]));
    } else if (Array.isArray(rawClaims['roles'])) {
      groups.push(...(rawClaims['roles'] as string[]));
    }

    // If email is missing, query UserInfo endpoint with access token
    if (!email && tokenResponseData.access_token && userinfoEndpoint) {
      try {
        const userinfoRes = await axios.get<Record<string, unknown>>(userinfoEndpoint, {
          headers: { Authorization: `Bearer ${tokenResponseData.access_token}` },
          timeout: 5000,
        });
        email = (userinfoRes.data['email'] as string) || email;
        displayName = (userinfoRes.data['name'] as string) || displayName;
      } catch (err) {
        this.logger.warn(`Could not fetch userinfo: ${(err as Error).message}`);
      }
    }

    if (!email) {
      throw new BadRequestException('IdP did not provide an email address claim.');
    }

    return {
      sub: claims.sub,
      email: email.toLowerCase(),
      displayName: displayName || email.split('@')[0],
      groups: Array.from(new Set(groups)),
      idTokenClaims: claims,
    };
  }
}
