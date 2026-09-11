import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { S3StorageDriver } from './s3-driver.js';
import { LocalStorageDriver, type StorageDriver } from './storage-driver.js';

export interface StoredObject {
  /** Opaque key recorded on the `Upload` row. Never caller-supplied. */
  key: string;
  size: number;
  /** SHA-256 of the bytes, for integrity checks and de-duplication. */
  checksum: string;
}

/**
 * Object storage.
 *
 * Key generation, path/traversal rules and signed URLs live here and are
 * transport-agnostic; the bytes go through a {@link StorageDriver} chosen by
 * `STORAGE_DRIVER` — `local` (default, filesystem) or `s3` (any S3-compatible
 * store: AWS S3, MinIO, R2, B2, Spaces, Wasabi).
 *
 * Keys are generated here rather than taken from callers: a filename that
 * arrived over HTTP must never decide where bytes land.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;

  constructor(private readonly config: ConfigService) {
    this.driver = this.buildDriver();
  }

  private buildDriver(): StorageDriver {
    if (this.config.get<string>('STORAGE_DRIVER') === 's3') {
      const require = (name: string): string => {
        const value = this.config.get<string>(name);
        if (!value) {
          throw new Error(`STORAGE_DRIVER=s3 requires ${name} to be set.`);
        }
        return value;
      };
      return new S3StorageDriver({
        endpoint: require('S3_ENDPOINT'),
        region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
        bucket: require('S3_BUCKET'),
        accessKeyId: require('S3_ACCESS_KEY_ID'),
        secretAccessKey: require('S3_SECRET_ACCESS_KEY'),
        forcePathStyle:
          this.config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
      });
    }
    return new LocalStorageDriver(
      resolve(this.config.get<string>('STORAGE_ROOT') ?? '.storage'),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.driver.init();
    this.logger.log(`StorageService ready (driver: ${this.driver.name})`);
  }

  /** Sharded by prefix so no directory accumulates every object. */
  buildKey(workspaceId: string, filename: string): string {
    const id = randomUUID();
    const extension = extname(filename).slice(0, 16);
    return join(workspaceId, id.slice(0, 2), `${id}${extension}`).replace(
      /\\/g,
      '/',
    );
  }

  async put(key: string, content: Buffer): Promise<StoredObject> {
    await this.driver.put(key, content);
    return {
      key,
      size: content.byteLength,
      checksum: createHash('sha256').update(content).digest('hex'),
    };
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }

  exists(key: string): Promise<boolean> {
    return this.driver.exists(key);
  }

  size(key: string): Promise<number> {
    return this.driver.size(key);
  }

  /** Epoch-ms of last modification, or null when the object is gone. */
  modifiedAt(key: string): Promise<number | null> {
    return this.driver.modifiedAt(key);
  }

  /**
   * Deletes the object. A key with nothing behind it is not an error — the row
   * is going away either way, and refusing would strand it.
   */
  delete(key: string): Promise<boolean> {
    return this.driver.delete(key);
  }

  /** Every object key currently in the store. Used by the orphan sweep. */
  listKeys(): Promise<string[]> {
    return this.driver.listKeys();
  }

  // --- signed URLs ---------------------------------------------------------
  //
  // A short-lived HMAC over the upload id lets a plain <img>/<a> reach the
  // bytes without the in-memory bearer token — the same job a pre-signed S3
  // URL does. The signature *is* the authorization, so the public route does
  // no workspace check; it is worthless once `exp` passes.

  private get urlSecret(): string {
    return (
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'insecure-dev-upload-secret'
    );
  }

  buildVariantKey(storageKey: string, variant: string, format = 'webp'): string {
    const dot = storageKey.lastIndexOf('.');
    const base = dot >= 0 ? storageKey.slice(0, dot) : storageKey;
    return `${base}.${variant}.${format}`;
  }

  async deleteVariants(
    key: string,
    variants = ['thumbnail', 'small', 'medium', 'large', 'avatar'],
  ): Promise<void> {
    const keysToDelete: string[] = [];
    for (const v of variants) {
      for (const fmt of ['webp', 'jpeg', 'png', 'avif']) {
        keysToDelete.push(this.buildVariantKey(key, v, fmt));
      }
    }
    await Promise.all(keysToDelete.map((k) => this.driver.delete(k).catch(() => false)));
  }

  /** `<base64url payload>.<base64url sig>` — payload is `{ u, e, d, v }`. */
  signContentToken(
    uploadId: string,
    opts: { ttlSeconds?: number; download?: boolean; variant?: string } = {},
  ): string {
    const payload = {
      u: uploadId,
      e: Date.now() + (opts.ttlSeconds ?? 3600) * 1000,
      d: opts.download ? 1 : 0,
      v: opts.variant || undefined,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.urlSecret)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  /** Returns the upload id, disposition and optional variant, or null when invalid/expired. */
  verifyContentToken(
    token: string,
  ): { uploadId: string; download: boolean; variant: string | null } | null {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = createHmac('sha256', this.urlSecret)
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (typeof payload.u !== 'string' || typeof payload.e !== 'number') {
        return null;
      }
      if (Date.now() > payload.e) return null;
      return {
        uploadId: payload.u,
        download: payload.d === 1,
        variant: typeof payload.v === 'string' ? payload.v : null,
      };
    } catch {
      return null;
    }
  }
}
