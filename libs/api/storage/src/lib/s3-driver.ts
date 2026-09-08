import { Logger } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import type { StorageDriver } from './storage-driver.js';

export interface S3DriverConfig {
  /** e.g. `https://s3.us-east-1.amazonaws.com`, `https://<acct>.r2.cloudflarestorage.com`, `http://minio:9000`. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `true` for MinIO and most S3-compatible stores; `false` for AWS virtual-hosted. */
  forcePathStyle: boolean;
}

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** RFC 3986 encoding as AWS SigV4 expects it (`~` kept, everything else escaped). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function encodeS3Path(key: string): string {
  return (
    '/' +
    key
      .split('/')
      .map((seg) => encodeRfc3986(seg))
      .join('/')
  );
}

/**
 * An S3-compatible object store driver: AWS Signature V4 over `fetch`, no SDK.
 *
 * Works against AWS S3, MinIO, Cloudflare R2, Backblaze B2, DigitalOcean
 * Spaces and Wasabi — anything that speaks the S3 REST API. Keys are the same
 * opaque, server-generated strings the local driver uses.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private readonly logger = new Logger('S3StorageDriver');
  private readonly host: string;
  private readonly scheme: string;

  constructor(private readonly cfg: S3DriverConfig) {
    const url = new URL(cfg.endpoint);
    this.scheme = url.protocol.replace(':', '');
    this.host = url.host;
  }

  async init(): Promise<void> {
    this.logger.log(
      `endpoint=${this.cfg.endpoint} bucket=${this.cfg.bucket} pathStyle=${this.cfg.forcePathStyle}`,
    );
  }

  /** `{ url, host }` for an object key or (key omitted) the bucket itself. */
  private target(key?: string, query = ''): { url: string; host: string } {
    const path = key ? encodeS3Path(key) : '';
    const qs = query ? `?${query}` : '';
    if (this.cfg.forcePathStyle) {
      return {
        url: `${this.scheme}://${this.host}/${this.cfg.bucket}${path}${qs}`,
        host: this.host,
      };
    }
    const vhost = `${this.cfg.bucket}.${this.host}`;
    return { url: `${this.scheme}://${vhost}${path}${qs}`, host: vhost };
  }

  private signedHeaders(
    method: string,
    target: { url: string; host: string },
    payloadHash: string,
    extra: Record<string, string> = {},
  ): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const url = new URL(target.url);

    const headers: Record<string, string> = {
      host: target.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...Object.fromEntries(
        Object.entries(extra).map(([k, v]) => [k.toLowerCase(), v]),
      ),
    };
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders =
      signedHeaderNames
        .map((h) => `${h}:${headers[h].trim().replace(/\s+/g, ' ')}`)
        .join('\n') + '\n';
    const signedHeaders = signedHeaderNames.join(';');

    // Canonical query string: params sorted by key, RFC-3986 encoded.
    const canonicalQuery = [...url.searchParams.entries()]
      .map(
        ([k, v]) =>
          [encodeRfc3986(k), encodeRfc3986(v)] as [string, string],
      )
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${this.cfg.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = hmac(
      hmac(
        hmac(hmac(`AWS4${this.cfg.secretAccessKey}`, dateStamp), this.cfg.region),
        's3',
      ),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign, 'utf8')
      .digest('hex');

    return {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${this.cfg.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private async request(
    method: string,
    target: { url: string; host: string },
    body?: Buffer,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;
    const headers = this.signedHeaders(
      method,
      target,
      payloadHash,
      extraHeaders,
    );
    return fetch(target.url, {
      method,
      headers,
      ...(body ? { body: new Uint8Array(body) } : {}),
    });
  }

  async put(key: string, content: Buffer): Promise<void> {
    const res = await this.request('PUT', this.target(key), content, {
      'content-type': 'application/octet-stream',
    });
    if (!res.ok) {
      throw new Error(
        `S3 PUT ${key} failed: HTTP ${res.status} ${await res.text()}`,
      );
    }
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request('GET', this.target(key));
    if (!res.ok) {
      throw new Error(`S3 GET ${key} failed: HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.request('HEAD', this.target(key));
    if (res.status === 404) return false;
    if (!res.ok) {
      throw new Error(`S3 HEAD ${key} failed: HTTP ${res.status}`);
    }
    return true;
  }

  async size(key: string): Promise<number> {
    const res = await this.request('HEAD', this.target(key));
    if (!res.ok) throw new Error(`S3 HEAD ${key} failed: HTTP ${res.status}`);
    return Number(res.headers.get('content-length') ?? 0);
  }

  async modifiedAt(key: string): Promise<number | null> {
    const res = await this.request('HEAD', this.target(key));
    if (!res.ok) return null;
    const lm = res.headers.get('last-modified');
    const ms = lm ? Date.parse(lm) : NaN;
    return Number.isNaN(ms) ? null : ms;
  }

  async delete(key: string): Promise<boolean> {
    const res = await this.request('DELETE', this.target(key));
    // 204 = deleted, 404 = already gone — both fine for our callers.
    if (res.status === 204 || res.status === 200 || res.status === 404) {
      return true;
    }
    this.logger.warn(`S3 DELETE ${key}: HTTP ${res.status}`);
    return false;
  }

  async listKeys(): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const params = new URLSearchParams({ 'list-type': '2' });
      if (token) params.set('continuation-token', token);
      const res = await this.request(
        'GET',
        this.target(undefined, params.toString()),
      );
      if (!res.ok) {
        throw new Error(`S3 ListObjectsV2 failed: HTTP ${res.status}`);
      }
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        keys.push(decodeXmlEntities(m[1]));
      }
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      token = truncated
        ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
        : undefined;
    } while (token);
    return keys;
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
