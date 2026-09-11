import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service.js';

describe('StorageService Image Variant & Token Delivery', () => {
  let root: string;
  let service: StorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'storage-media-test-'));
    const config = new ConfigService({
      STORAGE_DRIVER: 'local',
      STORAGE_ROOT: root,
      JWT_SECRET: 'test-secret-key-12345',
    });
    service = new StorageService(config);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('builds deterministic variant keys', () => {
    const original = 'ws1/ab/photo.jpg';
    const thumbKey = service.buildVariantKey(original, 'thumbnail', 'webp');
    const smallKey = service.buildVariantKey(original, 'small', 'webp');

    expect(thumbKey).toBe('ws1/ab/photo.thumbnail.webp');
    expect(smallKey).toBe('ws1/ab/photo.small.webp');
  });

  it('signs and verifies tokens with variant payload', () => {
    const uploadId = 'upload_123';
    const token = service.signContentToken(uploadId, {
      ttlSeconds: 1800,
      variant: 'thumbnail',
    });

    const verified = service.verifyContentToken(token);
    expect(verified).toBeDefined();
    expect(verified?.uploadId).toBe(uploadId);
    expect(verified?.variant).toBe('thumbnail');
    expect(verified?.download).toBe(false);
  });

  it('deletes variants deterministically', async () => {
    const originalKey = 'ws1/aa/avatar.png';
    const thumbKey = service.buildVariantKey(originalKey, 'thumbnail', 'webp');
    const smallKey = service.buildVariantKey(originalKey, 'small', 'webp');

    await service.put(originalKey, Buffer.from('orig'));
    await service.put(thumbKey, Buffer.from('thumb'));
    await service.put(smallKey, Buffer.from('small'));

    expect(await service.exists(thumbKey)).toBe(true);
    expect(await service.exists(smallKey)).toBe(true);

    await service.deleteVariants(originalKey, ['thumbnail', 'small']);

    expect(await service.exists(thumbKey)).toBe(false);
    expect(await service.exists(smallKey)).toBe(false);
    expect(await service.exists(originalKey)).toBe(true);
  });
});
