import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

export interface StoredObject {
  /** Opaque key recorded on the `Upload` row. Never caller-supplied. */
  key: string;
  size: number;
  /** SHA-256 of the bytes, for integrity checks and de-duplication. */
  checksum: string;
}

/**
 * Object storage on the local filesystem.
 *
 * MinIO is the intended backend in a deployed environment, but nothing in the
 * app should care which one is in use — so the contract here is put/get/delete
 * over an opaque key, and swapping in an S3 client later is a change to this
 * file alone.
 *
 * Keys are generated here rather than taken from callers: a filename that
 * arrived over HTTP must never decide where bytes land on disk.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(
      this.config.get<string>('STORAGE_ROOT') ?? '.storage',
    );
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    this.logger.log(`StorageService initialized (root: ${this.root})`);
  }

  /**
   * Resolves a key to an absolute path, refusing anything that escapes the root.
   *
   * Keys are server-generated, so traversal should be impossible — this is the
   * backstop that keeps it impossible if that ever stops being true.
   */
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error('Resolved storage path escapes the storage root.');
    }
    return full;
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
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);

    return {
      key,
      size: content.byteLength,
      checksum: createHash('sha256').update(content).digest('hex'),
    };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.pathFor(key));
  }

  async size(key: string): Promise<number> {
    return (await stat(this.pathFor(key))).size;
  }

  /** Epoch-ms of last modification, or null when the object is gone. */
  async modifiedAt(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathFor(key))).mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Deletes the object. A key with no file behind it is not an error — the row
   * is going away either way, and refusing would strand it.
   */
  async delete(key: string): Promise<boolean> {
    try {
      await rm(this.pathFor(key), { force: true });
      return true;
    } catch (error) {
      this.logger.warn(`Could not delete ${key}: ${String(error)}`);
      return false;
    }
  }

  /**
   * Every object key currently in the store. Used by the orphan sweep; on a
   * real object store this becomes a paginated `ListObjectsV2`.
   */
  async listKeys(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else out.push(relative(this.root, full).replace(/\\/g, '/'));
      }
    };
    await walk(this.root);
    return out;
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

  /** `<base64url payload>.<base64url sig>` — payload is `{ u, e, d }`. */
  signContentToken(
    uploadId: string,
    opts: { ttlSeconds?: number; download?: boolean } = {},
  ): string {
    const payload = {
      u: uploadId,
      e: Date.now() + (opts.ttlSeconds ?? 3600) * 1000,
      d: opts.download ? 1 : 0,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.urlSecret)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  /** Returns the upload id + disposition, or null when invalid/expired. */
  verifyContentToken(
    token: string,
  ): { uploadId: string; download: boolean } | null {
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
      return { uploadId: payload.u, download: payload.d === 1 };
    } catch {
      return null;
    }
  }
}
