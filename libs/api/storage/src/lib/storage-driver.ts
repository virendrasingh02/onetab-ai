import { Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * The byte-level object store behind {@link StorageService}. Everything above
 * this line — key generation, path/traversal rules, signed URLs — is
 * transport-agnostic and lives on the service; a driver only moves bytes for an
 * opaque, server-generated key.
 */
export interface StorageDriver {
  /** Human label for logs. */
  readonly name: string;
  init(): Promise<void>;
  put(key: string, content: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number>;
  /** Epoch-ms of last modification, or null when the object is gone. */
  modifiedAt(key: string): Promise<number | null>;
  delete(key: string): Promise<boolean>;
  /** Every object key currently in the store (used by the orphan sweep). */
  listKeys(): Promise<string[]>;
}

/** Local filesystem. The default; safe everywhere, not shared across replicas. */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly logger = new Logger('LocalStorageDriver');

  constructor(private readonly root: string) {}

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    this.logger.log(`root: ${this.root}`);
  }

  /** Refuses any key that resolves outside the root — server keys can't, but
   *  this is the backstop that keeps it true. */
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error('Resolved storage path escapes the storage root.');
    }
    return full;
  }

  async put(key: string, content: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.pathFor(key));
  }

  async size(key: string): Promise<number> {
    return (await stat(this.pathFor(key))).size;
  }

  async modifiedAt(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathFor(key))).mtimeMs;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await rm(this.pathFor(key), { force: true });
      return true;
    } catch (error) {
      this.logger.warn(`Could not delete ${key}: ${String(error)}`);
      return false;
    }
  }

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
}
