import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';
import { StorageService } from './storage.service.js';

/** Leave a freshly written blob alone this long before the sweep may touch it,
 *  so an upload still mid-flight (bytes written, row not yet committed) is safe. */
const MIN_ORPHAN_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Nightly reconciliation of the object store against `Upload` rows.
 *
 * A crash between `storage.put` and `upload.create`, or a failed multi-version
 * transaction, can leave bytes on disk that no row points at. Nothing reads
 * them; they only cost space. Deletes are bounded and best-effort — a failed
 * sweep just runs again tomorrow. (On a real object store this becomes a
 * lifecycle rule or a paginated `ListObjectsV2` + `DeleteObjects`.)
 */
@Injectable()
export class UploadCleanupService {
  private readonly logger = new Logger(UploadCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'upload-orphan-sweep' })
  async sweep(): Promise<void> {
    try {
      const [keys, rows] = await Promise.all([
        this.storage.listKeys(),
        this.prisma.upload.findMany({ select: { storageKey: true } }),
      ]);
      const live = new Set(rows.map((r) => r.storageKey));
      const cutoff = Date.now() - MIN_ORPHAN_AGE_MS;

      let removed = 0;
      for (const key of keys) {
        if (live.has(key)) continue;
        const mtime = await this.storage.modifiedAt(key);
        if (mtime !== null && mtime > cutoff) continue; // too new — may be in flight
        if (await this.storage.delete(key)) removed += 1;
      }

      if (removed) {
        this.logger.log(`Orphan sweep removed ${removed} unreferenced blob(s).`);
      }
    } catch (err) {
      this.logger.warn(
        `Orphan sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
