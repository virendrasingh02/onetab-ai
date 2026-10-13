import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';
import { StorageService } from './storage.service.js';

/** Leave a freshly written blob alone this long before the sweep may touch it,
 *  so an upload still mid-flight (bytes written, row not yet committed) is safe. */
const MIN_ORPHAN_AGE_MS = 6 * 60 * 60 * 1000;

/** User avatars (`UserService.uploadAvatar`) are served by user id, so no row
 *  holds their key — the whole prefix belongs to that service, not to the sweep. */
const USER_AVATAR_PREFIX = 'avatars/';

/** `<original sans extension>.<variant>.<format>` — the resized renditions
 *  `StorageService.buildVariantKey` writes beside an original upload. */
const VARIANT_SUFFIX =
  /\.(?:thumbnail|small|medium|large|avatar)\.(?:webp|jpeg|png|avif)$/;

function withoutExtension(key: string): string {
  const dot = key.lastIndexOf('.');
  return dot >= 0 ? key.slice(0, dot) : key;
}

/**
 * The stored keys nothing refers to.
 *
 * `liveKeys` must be every key some row points at. Renditions are not rows of
 * their own — they stay alive as long as their original does.
 */
export function findOrphanKeys(
  storedKeys: readonly string[],
  liveKeys: Iterable<string>,
): string[] {
  const live = new Set(liveKeys);
  const liveBases = new Set([...live].map(withoutExtension));

  return storedKeys.filter((key) => {
    if (key.startsWith(USER_AVATAR_PREFIX) || live.has(key)) return false;
    return !(
      VARIANT_SUFFIX.test(key) &&
      liveBases.has(key.replace(VARIANT_SUFFIX, ''))
    );
  });
}

/**
 * Nightly reconciliation of the object store against the rows that own bytes.
 *
 * A crash between `storage.put` and `upload.create`, or a failed multi-version
 * transaction, can leave bytes on disk that no row points at. Nothing reads
 * them; they only cost space. Deletes are bounded and best-effort — a failed
 * sweep just runs again tomorrow. (On a real object store this becomes a
 * lifecycle rule or a paginated `ListObjectsV2` + `DeleteObjects`.)
 *
 * The store is shared: `Upload` rows are not the only owners. Anything else that
 * writes here and keeps its key in a column (workspace logos) must be counted
 * live below, or the sweep deletes it a few hours after it was uploaded.
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
      const [keys, uploads, logos] = await Promise.all([
        this.storage.listKeys(),
        this.prisma.upload.findMany({ select: { storageKey: true } }),
        this.prisma.workspace.findMany({
          where: { avatarKey: { not: null } },
          select: { avatarKey: true },
        }),
      ]);
      const live = [
        ...uploads.map((row) => row.storageKey),
        ...logos.flatMap((row) => (row.avatarKey ? [row.avatarKey] : [])),
      ];
      const cutoff = Date.now() - MIN_ORPHAN_AGE_MS;

      let removed = 0;
      for (const key of findOrphanKeys(keys, live)) {
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
