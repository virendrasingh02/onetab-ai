import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';

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
}
