import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageDriver } from './storage-driver.js';

describe('LocalStorageDriver', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'storage-drv-'));
    driver = new LocalStorageDriver(root);
    await driver.init();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes and reports size + mtime', async () => {
    await driver.put('ws1/ab/file.bin', Buffer.from('payload'));

    expect((await driver.get('ws1/ab/file.bin')).toString()).toBe('payload');
    expect(await driver.exists('ws1/ab/file.bin')).toBe(true);
    expect(await driver.size('ws1/ab/file.bin')).toBe(7);
    expect(await driver.modifiedAt('ws1/ab/file.bin')).toBeGreaterThan(0);
  });

  it('listKeys returns forward-slash keys relative to the root', async () => {
    await driver.put('ws1/aa/one.txt', Buffer.from('1'));
    await driver.put('ws2/bb/two.txt', Buffer.from('2'));

    const keys = (await driver.listKeys()).sort();
    expect(keys).toEqual(['ws1/aa/one.txt', 'ws2/bb/two.txt']);
  });

  it('delete is idempotent and modifiedAt goes null once gone', async () => {
    await driver.put('k', Buffer.from('x'));
    expect(await driver.delete('k')).toBe(true);
    expect(await driver.delete('k')).toBe(true);
    expect(await driver.exists('k')).toBe(false);
    expect(await driver.modifiedAt('k')).toBeNull();
  });

  it('refuses a key that escapes the storage root', async () => {
    await expect(
      driver.put('../escape.txt', Buffer.from('nope')),
    ).rejects.toThrow(/escapes the storage root/);
    // and nothing was written outside
    await expect(readFile(join(root, '..', 'escape.txt'))).rejects.toThrow();
  });
});
