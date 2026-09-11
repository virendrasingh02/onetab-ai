import { z } from 'zod';

export const imageFitSchema = z.enum([
  'cover',
  'contain',
  'fill',
  'inside',
  'outside',
]);

export const imagePositionSchema = z.enum([
  'top',
  'right top',
  'right',
  'right bottom',
  'bottom',
  'left bottom',
  'left',
  'left top',
  'center',
  'centre',
  'entropy',
  'attention',
]);

/**
 * `jpg` is accepted as the common spelling but normalized to `jpeg` — the
 * only one `SupportedOutputFormat` (and Sharp's own `.jpeg()` encoder) knows,
 * so every caller downstream of this schema can treat `format` as that exact
 * union without a second `jpg` case to remember.
 */
export const imageFormatSchema = z
  .enum(['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff'])
  .transform((format) => (format === 'jpg' ? 'jpeg' : format));

export const imageBlendModeSchema = z.enum([
  'clear',
  'source',
  'over',
  'in',
  'out',
  'atop',
  'dest',
  'dest-over',
  'dest-in',
  'dest-out',
  'dest-atop',
  'xor',
  'add',
  'saturate',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
]);

export const resizeImageSchema = z.object({
  width: z.number().int().positive().max(8192).optional(),
  height: z.number().int().positive().max(8192).optional(),
  fit: imageFitSchema.default('cover'),
  position: imagePositionSchema.optional(),
  withoutEnlargement: z.boolean().default(false),
  background: z
    .object({
      r: z.number().min(0).max(255).default(0),
      g: z.number().min(0).max(255).default(0),
      b: z.number().min(0).max(255).default(0),
      alpha: z.number().min(0).max(1).default(1),
    })
    .optional(),
});

export const cropImageSchema = z.object({
  left: z.number().int().min(0),
  top: z.number().int().min(0),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
});

export const convertImageSchema = z.object({
  format: imageFormatSchema,
  quality: z.number().int().min(1).max(100).optional(),
  lossless: z.boolean().optional(),
  effort: z.number().int().min(0).max(9).optional(),
  keepMetadata: z.boolean().default(false),
});

export const thumbnailSchema = z.object({
  width: z.number().int().positive().max(2048).default(320),
  height: z.number().int().positive().max(2048).default(320),
  fit: imageFitSchema.default('cover'),
  format: imageFormatSchema.default('webp'),
  quality: z.number().int().min(1).max(100).default(80),
});

export const compositeOverlaySchema = z.object({
  input: z.string().describe('Base64 string or public asset token'),
  top: z.number().int().optional(),
  left: z.number().int().optional(),
  gravity: imagePositionSchema.optional(),
  blend: imageBlendModeSchema.default('over'),
  tile: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

export const compositeImageSchema = z.object({
  overlays: z.array(compositeOverlaySchema).min(1).max(10),
});

export const processImageSchema = z.object({
  resize: resizeImageSchema.optional(),
  crop: cropImageSchema.optional(),
  rotate: z.number().min(-360).max(360).optional(),
  autoOrient: z.boolean().default(true),
  flip: z.boolean().optional(),
  flop: z.boolean().optional(),
  sharpen: z.union([z.boolean(), z.number().positive()]).optional(),
  blur: z.union([z.boolean(), z.number().positive()]).optional(),
  grayscale: z.boolean().optional(),
  tint: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  normalize: z.boolean().optional(),
  modulate: z
    .object({
      brightness: z.number().positive().optional(),
      saturation: z.number().positive().optional(),
      hue: z.number().optional(),
      lightness: z.number().optional(),
    })
    .optional(),
  format: imageFormatSchema.optional(),
  quality: z.number().int().min(1).max(100).optional(),
  stripMetadata: z.boolean().default(true),
});

export type ImageFit = z.infer<typeof imageFitSchema>;
export type ImagePosition = z.infer<typeof imagePositionSchema>;
export type ImageFormat = z.infer<typeof imageFormatSchema>;
export type ResizeImageInput = z.infer<typeof resizeImageSchema>;
export type CropImageInput = z.infer<typeof cropImageSchema>;
export type ConvertImageInput = z.infer<typeof convertImageSchema>;
export type ThumbnailInput = z.infer<typeof thumbnailSchema>;
export type CompositeOverlayInput = z.infer<typeof compositeOverlaySchema>;
export type CompositeImageInput = z.infer<typeof compositeImageSchema>;
export type ProcessImageInput = z.infer<typeof processImageSchema>;
