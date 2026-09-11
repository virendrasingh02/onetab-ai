/**
 * Safe, resumable backfill script for generating missing Sharp image variants
 * across existing platform uploads.
 *
 * Usage:
 *   npx tsx scripts/backfill-image-variants.ts [--batch 25] [--limit 100] [--concurrency 4]
 */
import { PrismaClient } from '../libs/api/database/src/generated/index.js';
import { LocalStorageDriver } from '../libs/api/storage/src/lib/storage-driver.js';
import { S3StorageDriver } from '../libs/api/storage/src/lib/s3-driver.js';
import { ImageProcessingService } from '../libs/api/media-processing/src/lib/image-processing.service.js';
import { ImageSecurityService } from '../libs/api/media-processing/src/lib/image-security.service.js';
import { STANDARD_IMAGE_PRESETS } from '../libs/api/media-processing/src/lib/image-processing.constants.js';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const storageDriver = process.env['STORAGE_DRIVER'] === 's3'
  ? new S3StorageDriver({
      endpoint: process.env['S3_ENDPOINT']!,
      region: process.env['S3_REGION'] || 'us-east-1',
      bucket: process.env['S3_BUCKET']!,
      accessKeyId: process.env['S3_ACCESS_KEY_ID']!,
      secretAccessKey: process.env['S3_SECRET_ACCESS_KEY']!,
    })
  : new LocalStorageDriver(resolve(process.env['STORAGE_ROOT'] || '.storage'));

const securityService = new ImageSecurityService();
const processingService = new ImageProcessingService(securityService);

function buildVariantKey(storageKey: string, variant: string, format = 'webp'): string {
  const dot = storageKey.lastIndexOf('.');
  const base = dot >= 0 ? storageKey.slice(0, dot) : storageKey;
  return `${base}.${variant}.${format}`;
}

async function main() {
  await storageDriver.init();
  console.log('🚀 Starting image variant backfill...');

  const batchSize = 25;
  let cursor: string | undefined = undefined;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const targetVariants = ['thumbnail', 'small', 'medium', 'large'];

  while (true) {
    const uploads = await prisma.upload.findMany({
      where: {
        mimeType: { startsWith: 'image/' },
        isCurrent: true,
      },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (uploads.length === 0) break;

    for (const upload of uploads) {
      cursor = upload.id;
      const thumbnailKey = buildVariantKey(upload.storageKey, 'thumbnail', 'webp');
      const alreadyExists = await storageDriver.exists(thumbnailKey);

      if (alreadyExists) {
        totalSkipped++;
        continue;
      }

      if (!(await storageDriver.exists(upload.storageKey))) {
        console.warn(`⚠️ Original missing for upload ${upload.id} (${upload.filename})`);
        totalFailed++;
        continue;
      }

      try {
        const original = await storageDriver.get(upload.storageKey);
        const variants = await processingService.generateVariants(original, targetVariants);

        for (const [name, result] of Object.entries(variants)) {
          const variantKey = buildVariantKey(upload.storageKey, name, result.format);
          await storageDriver.put(variantKey, result.buffer);
        }

        totalProcessed++;
        console.log(`✅ Processed variants for ${upload.id} (${upload.filename})`);
      } catch (err) {
        totalFailed++;
        console.error(`❌ Failed to process variants for ${upload.id}:`, err);
      }
    }

    console.log(
      `📊 Progress: ${totalProcessed} generated, ${totalSkipped} skipped, ${totalFailed} failed`,
    );
  }

  console.log('\n🎉 Backfill complete!');
  console.log(`Summary: Generated=${totalProcessed} Skipped=${totalSkipped} Failed=${totalFailed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal backfill error:', err);
  process.exit(1);
});
