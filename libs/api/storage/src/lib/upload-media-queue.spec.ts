import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import sharp from 'sharp';
import {
  ImageProcessingService,
  ImageSecurityService,
  type MediaJobHandler,
  type MediaJobPayload,
  type MediaQueueService,
} from '@org/api-media-processing';
import type { PrismaService } from '@org/database';
import { StorageService } from './storage.service.js';
import { UploadService } from './upload.service.js';

/**
 * The queue-integration methods this suite exercises directly —
 * `UploadService.create`/`replaceVersion` need a real Prisma client to reach
 * them, well out of scope for a unit test of just the queue wiring they now
 * go through instead of the old fire-and-forget call.
 */
interface UploadServiceQueueInternals {
  enqueueVariantJob(
    workspaceId: string,
    uploadId: string,
    storageKey: string,
    file: { originalname: string; mimetype: string },
  ): Promise<void>;
}

/** A test double standing in for the real Redis/in-memory `MediaQueueService`
 *  — this suite cares that `UploadService` calls it correctly and that the
 *  handler it registers does the right thing when invoked, not that the
 *  queue itself works (that's `media-queue.service.ts`'s own concern). */
function createFakeMediaQueue() {
  let handler: MediaJobHandler | null = null;
  return {
    registerHandler: vi.fn((h: MediaJobHandler) => {
      handler = h;
    }),
    enqueue: vi.fn(async (_job: MediaJobPayload) => undefined),
    run: (job: MediaJobPayload) => {
      if (!handler) throw new Error('No handler registered');
      return handler(job);
    },
  };
}

describe('UploadService media queue wiring', () => {
  let root: string;
  let storage: StorageService;
  let mediaQueue: ReturnType<typeof createFakeMediaQueue>;
  let service: UploadService;

  async function testImage(): Promise<Buffer> {
    return sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 10, g: 200, b: 90 },
      },
    })
      .png()
      .toBuffer();
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'upload-media-queue-test-'));
    const config = new ConfigService({
      STORAGE_DRIVER: 'local',
      STORAGE_ROOT: root,
      JWT_SECRET: 'test-secret-key-12345',
    });
    storage = new StorageService(config);
    await storage.onModuleInit();

    mediaQueue = createFakeMediaQueue();
    const security = new ImageSecurityService();
    const imageProcessing = new ImageProcessingService(security);

    service = new UploadService(
      {} as unknown as PrismaService, // untouched by the methods under test
      storage,
      { emit: vi.fn() } as unknown as EventEmitter2,
      imageProcessing,
      security,
      mediaQueue as unknown as MediaQueueService,
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('enqueues a variant job for an image upload, with every default preset', async () => {
    await (service as unknown as UploadServiceQueueInternals).enqueueVariantJob(
      'ws1',
      'upload_1',
      'ws1/aa/photo.png',
      { originalname: 'photo.png', mimetype: 'image/png' },
    );

    expect(mediaQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(mediaQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        uploadId: 'upload_1',
        storageKey: 'ws1/aa/photo.png',
        filename: 'photo.png',
        mimeType: 'image/png',
        variants: ['thumbnail', 'small', 'medium', 'large'],
      }),
    );
  });

  it('does not enqueue anything for a non-image upload', async () => {
    await (service as unknown as UploadServiceQueueInternals).enqueueVariantJob(
      'ws1',
      'upload_2',
      'ws1/aa/doc.pdf',
      { originalname: 'doc.pdf', mimetype: 'application/pdf' },
    );

    expect(mediaQueue.enqueue).not.toHaveBeenCalled();
  });

  it('registers itself as the queue worker, and the handler generates every variant on the actual bytes', async () => {
    service.onModuleInit();
    expect(mediaQueue.registerHandler).toHaveBeenCalledTimes(1);

    const storageKey = 'ws1/bb/photo.png';
    await storage.put(storageKey, await testImage());

    await mediaQueue.run({
      jobId: 'job_1',
      workspaceId: 'ws1',
      uploadId: 'upload_1',
      storageKey,
      filename: 'photo.png',
      mimeType: 'image/png',
      variants: ['thumbnail', 'small', 'medium', 'large'],
      createdAt: Date.now(),
    });

    for (const variant of ['thumbnail', 'small', 'medium', 'large']) {
      const variantKey = storage.buildVariantKey(storageKey, variant, 'webp');
      expect(await storage.exists(variantKey)).toBe(true);
    }
  });

  it('skips a job whose original file was deleted before it was picked up', async () => {
    service.onModuleInit();

    const storageKey = 'ws1/cc/missing.png';
    await expect(
      mediaQueue.run({
        jobId: 'job_2',
        workspaceId: 'ws1',
        uploadId: 'upload_2',
        storageKey,
        filename: 'missing.png',
        mimeType: 'image/png',
        variants: ['thumbnail'],
        createdAt: Date.now(),
      }),
    ).resolves.toBeUndefined();

    expect(
      await storage.exists(storage.buildVariantKey(storageKey, 'thumbnail', 'webp')),
    ).toBe(false);
  });
});
