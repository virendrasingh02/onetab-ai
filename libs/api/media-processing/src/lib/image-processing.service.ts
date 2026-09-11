import { Injectable, Logger } from '@nestjs/common';
import { availableParallelism, cpus } from 'node:os';
import sharp from 'sharp';
import {
  AVATAR_STANDARD_SIZES,
  FORMAT_MIME_MAP,
  IMAGE_SECURITY_LIMITS,
  STANDARD_IMAGE_PRESETS,
  SupportedOutputFormat,
  type ImageVariantPreset,
} from './image-processing.constants.js';
import {
  InvalidCropException,
  InvalidDimensionsException,
  InvalidImageException,
  ProcessingFailedException,
  UnsupportedFormatException,
} from './image-processing.errors.js';
import { ImageSecurityService } from './image-security.service.js';

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?:
    | 'top'
    | 'right top'
    | 'right'
    | 'right bottom'
    | 'bottom'
    | 'left bottom'
    | 'left'
    | 'left top'
    | 'center'
    | 'centre'
    | 'entropy'
    | 'attention';
  withoutEnlargement?: boolean;
  background?: { r: number; g: number; b: number; alpha?: number } | string;
}

export interface CropOptions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FormatOptions {
  format: SupportedOutputFormat;
  quality?: number;
  lossless?: boolean;
  effort?: number;
  keepMetadata?: boolean;
  animated?: boolean;
}

export interface CompositeLayer {
  input: Buffer | string;
  top?: number;
  left?: number;
  gravity?:
    | 'center'
    | 'centre'
    | 'north'
    | 'northeast'
    | 'east'
    | 'southeast'
    | 'south'
    | 'southwest'
    | 'west'
    | 'northwest';
  blend?:
    | 'clear'
    | 'source'
    | 'over'
    | 'in'
    | 'out'
    | 'atop'
    | 'dest'
    | 'dest-over'
    | 'dest-in'
    | 'dest-out'
    | 'dest-atop'
    | 'xor'
    | 'add'
    | 'saturate'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion';
  tile?: boolean;
  opacity?: number;
}

export interface ImageMetadataResult {
  width?: number;
  height?: number;
  format?: string;
  mimeType?: string;
  size: number;
  channels?: number;
  hasAlpha?: boolean;
  isAnimated?: boolean;
  pageCount?: number;
  orientation?: number;
  aspectRatio?: number;
  exif?: Record<string, unknown> | null;
  icc?: boolean;
  xmp?: boolean;
  iptc?: boolean;
}

export interface ImageStatisticsResult {
  channels: Array<{
    min: number;
    max: number;
    mean: number;
    stdev: number;
  }>;
  isOpaque: boolean;
  dominant?: { r: number; g: number; b: number };
}

export interface ProcessPipelineOptions {
  resize?: ResizeOptions;
  crop?: CropOptions;
  rotate?: number;
  autoOrient?: boolean;
  flip?: boolean;
  flop?: boolean;
  trim?: boolean | number;
  flatten?: boolean | { background: string | { r: number; g: number; b: number } };
  /** A bare number is the sharpen sigma directly — what `processImageSchema` sends. */
  sharpen?: boolean | number | { sigma?: number; m1?: number; m2?: number };
  blur?: boolean | number;
  grayscale?: boolean;
  tint?: string | { r: number; g: number; b: number };
  normalize?: boolean;
  modulate?: {
    brightness?: number;
    saturation?: number;
    hue?: number;
    lightness?: number;
  };
  format?: SupportedOutputFormat;
  quality?: number;
  stripMetadata?: boolean;
  keepMetadata?: boolean;
  animated?: boolean;
}

export interface ProcessedOutput {
  buffer: Buffer;
  format: SupportedOutputFormat;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  durationMs: number;
}

/**
 * Sharp's cache and concurrency limits are process-wide (libvips) settings,
 * not state that belongs to any one `ImageProcessingService` instance — Nest
 * constructs a fresh instance per testing module (and would per request, were
 * this ever made request-scoped), so applying them from the constructor
 * re-ran the same global mutation on every instantiation. Module load runs
 * exactly once per process, which is what this setting actually needs.
 *
 * `os.availableParallelism()` (Node 18.15+/19.4+) is the correct source for
 * this — unlike `navigator.hardwareConcurrency`, which is a browser API only
 * incidentally present in modern Node and not guaranteed across runtimes.
 */
sharp.cache({ memory: 128, files: 50, items: 200 });
sharp.concurrency(
  Math.max(1, Math.min(4, availableParallelism?.() ?? cpus().length ?? 2)),
);

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  constructor(private readonly security: ImageSecurityService) {}

  /**
   * Fast metadata extraction without decoding the entire image into memory.
   */
  async getMetadata(input: Buffer): Promise<ImageMetadataResult> {
    this.security.assertFileSize(input);
    const sniffed = this.security.sniffFormat(input);

    if (sniffed?.format === 'svg') {
      this.security.validateSvg(input);
    }

    try {
      const instance = sharp(input, { failOn: 'none', animated: true });
      const meta = await instance.metadata();

      this.security.assertDimensions(meta.width, meta.height);

      const mimeType =
        (meta.format && FORMAT_MIME_MAP[meta.format]) ||
        sniffed?.mimeType ||
        'application/octet-stream';

      const width = meta.width;
      const height = meta.height;
      const aspectRatio = width && height ? +(width / height).toFixed(4) : undefined;
      const isAnimated = (meta.pages ?? 1) > 1;

      return {
        width,
        height,
        format: meta.format || sniffed?.format,
        mimeType,
        size: input.byteLength,
        channels: meta.channels,
        hasAlpha: meta.hasAlpha,
        isAnimated,
        pageCount: meta.pages,
        orientation: meta.orientation,
        aspectRatio,
        exif: meta.exif ? { present: true } : null,
        icc: Boolean(meta.icc),
        xmp: Boolean(meta.xmp),
        iptc: Boolean(meta.iptc),
      };
    } catch (err) {
      if (err instanceof InvalidImageException) throw err;
      throw new InvalidImageException(
        `Failed to parse image metadata: ${err instanceof Error ? err.message : 'corrupt image'}`,
      );
    }
  }

  /**
   * Retrieves statistical analysis (colors, opacity, channel distributions).
   */
  async getStatistics(input: Buffer): Promise<ImageStatisticsResult> {
    this.security.assertFileSize(input);
    try {
      const stats = await sharp(input, { failOn: 'none' }).stats();
      return {
        channels: stats.channels.map((c) => ({
          min: c.min,
          max: c.max,
          mean: +c.mean.toFixed(2),
          stdev: +c.stdev.toFixed(2),
        })),
        isOpaque: stats.isOpaque,
        dominant: stats.dominant,
      };
    } catch (err) {
      throw new ProcessingFailedException(
        `Failed to compute image statistics: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  /**
   * Resizes an image using specified dimensions and fit strategy.
   */
  async resize(input: Buffer, options: ResizeOptions): Promise<ProcessedOutput> {
    return this.process(input, { resize: options });
  }

  /**
   * Crops a region from the image with boundary validation.
   */
  async crop(input: Buffer, options: CropOptions): Promise<ProcessedOutput> {
    return this.process(input, { crop: options });
  }

  /**
   * Extracts a region from the image (equivalent to crop).
   */
  async extract(input: Buffer, options: CropOptions): Promise<ProcessedOutput> {
    return this.crop(input, options);
  }

  /**
   * Rotates an image by specified angle or auto-orients based on EXIF.
   */
  async rotate(input: Buffer, angle?: number): Promise<ProcessedOutput> {
    return this.process(input, { rotate: angle, autoOrient: angle === undefined });
  }

  /**
   * Normalizes EXIF orientation so mobile photos display upright.
   */
  async autoOrient(input: Buffer): Promise<ProcessedOutput> {
    return this.process(input, { autoOrient: true });
  }

  /**
   * Flips image vertically (over x axis).
   */
  async flip(input: Buffer): Promise<ProcessedOutput> {
    return this.process(input, { flip: true });
  }

  /**
   * Flops image horizontally (over y axis).
   */
  async flop(input: Buffer): Promise<ProcessedOutput> {
    return this.process(input, { flop: true });
  }

  /**
   * Converts image to a different target format with quality/compression controls.
   */
  async convert(input: Buffer, options: FormatOptions): Promise<ProcessedOutput> {
    return this.process(input, {
      format: options.format,
      quality: options.quality,
      keepMetadata: options.keepMetadata,
      animated: options.animated,
    });
  }

  /**
   * Standardized thumbnail generation.
   */
  async generateThumbnail(
    input: Buffer,
    options?: Partial<ImageVariantPreset>,
  ): Promise<ProcessedOutput> {
    const preset = { ...STANDARD_IMAGE_PRESETS['thumbnail'], ...options };
    return this.process(input, {
      resize: {
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        withoutEnlargement: preset.withoutEnlargement,
      },
      format: preset.format ?? 'webp',
      quality: preset.quality ?? 80,
      autoOrient: true,
      stripMetadata: true,
    });
  }

  /**
   * Generates multiple optimized variants in parallel (e.g. thumbnail, small, medium, large, webp).
   */
  async generateVariants(
    input: Buffer,
    presetNames: string[] = ['thumbnail', 'small', 'medium', 'large'],
  ): Promise<Record<string, ProcessedOutput>> {
    const results: Record<string, ProcessedOutput> = {};

    await Promise.all(
      presetNames.map(async (name) => {
        const preset = STANDARD_IMAGE_PRESETS[name];
        if (!preset) return;
        try {
          results[name] = await this.process(input, {
            resize: {
              width: preset.width,
              height: preset.height,
              fit: preset.fit,
              withoutEnlargement: preset.withoutEnlargement,
            },
            format: preset.format ?? 'webp',
            quality: preset.quality,
            autoOrient: true,
            stripMetadata: true,
          });
        } catch (err) {
          this.logger.warn(
            `Variant generation for "${name}" skipped or failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );

    return results;
  }

  /**
   * Specialized avatar processing:
   * Auto-orients, crops to square, resizes to target avatar sizes, strips private EXIF.
   */
  async processAvatar(
    input: Buffer,
    size = 256,
  ): Promise<{
    main: ProcessedOutput;
    variants: Record<number, ProcessedOutput>;
  }> {
    const main = await this.process(input, {
      resize: {
        width: size,
        height: size,
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: false,
      },
      format: 'webp',
      quality: 90,
      autoOrient: true,
      stripMetadata: true,
    });

    const variants: Record<number, ProcessedOutput> = {};
    const otherSizes = AVATAR_STANDARD_SIZES.filter((s) => s !== size);

    await Promise.all(
      otherSizes.map(async (s) => {
        try {
          variants[s] = await this.process(input, {
            resize: {
              width: s,
              height: s,
              fit: 'cover',
              position: 'attention',
              withoutEnlargement: false,
            },
            format: 'webp',
            quality: 88,
            autoOrient: true,
            stripMetadata: true,
          });
        } catch (err) {
          this.logger.warn(`Avatar size ${s} variant failed: ${err}`);
        }
      }),
    );

    return { main, variants };
  }

  /**
   * Multi-layer image compositing (badges, watermarks, overlays).
   */
  async composite(
    input: Buffer,
    layers: CompositeLayer[],
    outputFormat?: SupportedOutputFormat,
  ): Promise<ProcessedOutput> {
    const start = Date.now();
    this.security.assertFileSize(input);

    const safeLayers = layers.map((layer) => {
      let layerInput: Buffer;
      if (typeof layer.input === 'string') {
        // Base64 string
        if (layer.input.startsWith('data:')) {
          const comma = layer.input.indexOf(',');
          layerInput = Buffer.from(layer.input.slice(comma + 1), 'base64');
        } else {
          layerInput = Buffer.from(layer.input, 'base64');
        }
      } else {
        layerInput = layer.input;
      }
      this.security.assertFileSize(layerInput);

      return {
        input: layerInput,
        top: layer.top,
        left: layer.left,
        gravity: layer.gravity,
        blend: layer.blend ?? 'over',
        tile: layer.tile,
        opacity: layer.opacity,
      };
    });

    try {
      let pipeline = sharp(input, { failOn: 'none' }).composite(safeLayers);

      const targetFormat = outputFormat || 'webp';
      pipeline = this.applyFormat(pipeline, targetFormat, { quality: 88 });

      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      const durationMs = Date.now() - start;

      this.logMetrics('composite', input.byteLength, data.byteLength, durationMs, targetFormat);

      return {
        buffer: data,
        format: targetFormat,
        mimeType: FORMAT_MIME_MAP[targetFormat] || 'image/webp',
        width: info.width,
        height: info.height,
        size: data.byteLength,
        durationMs,
      };
    } catch (err) {
      throw new ProcessingFailedException(
        `Compositing failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  /**
   * Unified, high-performance image processing pipeline.
   * Runs all operations in a single sharp pipeline pass to avoid multiple encode/decode cycles.
   */
  async process(
    input: Buffer,
    options: ProcessPipelineOptions = {},
  ): Promise<ProcessedOutput> {
    const start = Date.now();
    this.security.assertFileSize(input);

    const sniffed = this.security.sniffFormat(input);
    if (sniffed?.format === 'svg') {
      this.security.validateSvg(input);
    }

    try {
      const isAnimated = Boolean(options.animated);
      let pipeline = sharp(input, {
        failOn: 'none',
        animated: isAnimated,
        limitInputPixels: IMAGE_SECURITY_LIMITS.MAX_PIXELS,
      });

      // 1. Auto-orient or rotate
      if (options.autoOrient !== false) {
        pipeline = pipeline.rotate(options.rotate ?? undefined);
      } else if (options.rotate !== undefined) {
        pipeline = pipeline.rotate(options.rotate);
      }

      // 2. Flip / Flop
      if (options.flip) pipeline = pipeline.flip();
      if (options.flop) pipeline = pipeline.flop();

      // 3. Crop / Extract
      if (options.crop) {
        const { left, top, width, height } = options.crop;
        if (left < 0 || top < 0 || width <= 0 || height <= 0) {
          throw new InvalidCropException('Crop coordinates must be positive.');
        }
        pipeline = pipeline.extract({ left, top, width, height });
      }

      // 4. Resize
      if (options.resize) {
        const r = options.resize;
        if (r.width !== undefined && r.width <= 0) {
          throw new InvalidDimensionsException('Width must be greater than 0.');
        }
        if (r.height !== undefined && r.height <= 0) {
          throw new InvalidDimensionsException('Height must be greater than 0.');
        }
        // `limitInputPixels` below only bounds the *source* decode — nothing
        // stops a caller asking for e.g. a 50000x50000 *output*, which is its
        // own decompression-bomb vector (2.5 billion pixels from a tiny
        // input). The one route that exposes `resize` to a workspace member
        // also validates with `processImageSchema`, but the bound belongs
        // here too so every caller of this service is covered.
        if (r.width !== undefined && r.width > IMAGE_SECURITY_LIMITS.MAX_WIDTH) {
          throw new InvalidDimensionsException(
            `Width ${r.width}px exceeds the maximum allowed ${IMAGE_SECURITY_LIMITS.MAX_WIDTH}px.`,
          );
        }
        if (r.height !== undefined && r.height > IMAGE_SECURITY_LIMITS.MAX_HEIGHT) {
          throw new InvalidDimensionsException(
            `Height ${r.height}px exceeds the maximum allowed ${IMAGE_SECURITY_LIMITS.MAX_HEIGHT}px.`,
          );
        }
        pipeline = pipeline.resize({
          width: r.width,
          height: r.height,
          fit: r.fit ?? 'cover',
          position: r.position,
          withoutEnlargement: r.withoutEnlargement ?? false,
          background: r.background,
        });
      }

      // 5. Trim
      if (options.trim) {
        if (typeof options.trim === 'number') {
          pipeline = pipeline.trim({ threshold: options.trim });
        } else if (typeof options.trim === 'object') {
          pipeline = pipeline.trim(options.trim);
        } else {
          pipeline = pipeline.trim();
        }
      }

      // 6. Flatten
      if (options.flatten) {
        pipeline = pipeline.flatten(
          typeof options.flatten === 'object' ? options.flatten : { background: '#ffffff' },
        );
      }

      // 7. Adjustments & Filters
      if (options.sharpen) {
        if (typeof options.sharpen === 'number') {
          pipeline = pipeline.sharpen({ sigma: options.sharpen });
        } else if (typeof options.sharpen === 'object') {
          pipeline = pipeline.sharpen({
            sigma: options.sharpen.sigma ?? 1,
            m1: options.sharpen.m1,
            m2: options.sharpen.m2,
          });
        } else {
          pipeline = pipeline.sharpen();
        }
      }

      if (options.blur) {
        pipeline = typeof options.blur === 'number'
          ? pipeline.blur(options.blur)
          : pipeline.blur(1);
      }

      if (options.grayscale) {
        pipeline = pipeline.grayscale();
      }

      if (options.tint) {
        pipeline = pipeline.tint(options.tint);
      }

      if (options.normalize) {
        pipeline = pipeline.normalize();
      }

      if (options.modulate) {
        pipeline = pipeline.modulate(options.modulate);
      }

      // 8. Metadata stripping vs preservation
      if (options.keepMetadata) {
        pipeline = pipeline.withMetadata();
      }

      // 9. Format & Compression
      const targetFormat =
        options.format || (sniffed?.format && sniffed.format !== 'svg' ? (sniffed.format as SupportedOutputFormat) : 'webp');

      pipeline = this.applyFormat(pipeline, targetFormat, {
        quality: options.quality,
      });

      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      const durationMs = Date.now() - start;

      this.logMetrics('process', input.byteLength, data.byteLength, durationMs, targetFormat);

      return {
        buffer: data,
        format: targetFormat,
        mimeType: FORMAT_MIME_MAP[targetFormat] || 'image/webp',
        width: info.width,
        height: info.height,
        size: data.byteLength,
        durationMs,
      };
    } catch (err) {
      if (err instanceof InvalidCropException || err instanceof InvalidDimensionsException) {
        throw err;
      }
      throw new ProcessingFailedException(
        `Image processing operation failed: ${err instanceof Error ? err.message : 'corrupt input'}`,
      );
    }
  }

  /**
   * Applies format and encoding options to the Sharp pipeline.
   */
  private applyFormat(
    pipeline: sharp.Sharp,
    format: SupportedOutputFormat,
    options: { quality?: number; lossless?: boolean; effort?: number } = {},
  ): sharp.Sharp {
    const quality = options.quality ?? 85;

    switch (format) {
      case 'webp':
        return pipeline.webp({
          quality,
          lossless: options.lossless ?? false,
          effort: options.effort ?? 4,
          smartSubsample: true,
        });
      case 'avif':
        return pipeline.avif({
          quality,
          lossless: options.lossless ?? false,
          effort: options.effort ?? 4,
        });
      case 'jpeg':
        return pipeline.jpeg({
          quality,
          mozjpeg: true,
          progressive: true,
        });
      case 'png':
        return pipeline.png({
          compressionLevel: 8,
          progressive: true,
          palette: false,
        });
      case 'gif':
        return pipeline.gif({
          effort: options.effort ?? 7,
        });
      case 'tiff':
        return pipeline.tiff({
          quality,
          compression: 'deflate',
        });
      default:
        throw new UnsupportedFormatException(format);
    }
  }

  /**
   * Observability metrics logging without logging private image contents.
   */
  private logMetrics(
    operation: string,
    inBytes: number,
    outBytes: number,
    durationMs: number,
    format: string,
  ): void {
    const ratio = inBytes > 0 ? ((outBytes / inBytes) * 100).toFixed(1) : '100';
    this.logger.debug(
      `[ImageProcessing] op=${operation} format=${format} in=${(inBytes / 1024).toFixed(
        1,
      )}KB out=${(outBytes / 1024).toFixed(1)}KB ratio=${ratio}% time=${durationMs}ms`,
    );
  }
}
