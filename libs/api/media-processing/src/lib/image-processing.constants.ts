export const SUPPORTED_INPUT_FORMATS = [
  'jpeg',
  'jpg',
  'png',
  'webp',
  'gif',
  'avif',
  'tiff',
  'tif',
  'svg',
] as const;

export type SupportedInputFormat = (typeof SUPPORTED_INPUT_FORMATS)[number];

export const SUPPORTED_OUTPUT_FORMATS = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
] as const;

export type SupportedOutputFormat = (typeof SUPPORTED_OUTPUT_FORMATS)[number];

export const FORMAT_MIME_MAP: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  svg: 'image/svg+xml',
};

export const MIME_FORMAT_MAP: Record<string, SupportedOutputFormat> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
};

export const IMAGE_SECURITY_LIMITS = {
  MAX_WIDTH: 8192,
  MAX_HEIGHT: 8192,
  MAX_PIXELS: 40_000_000, // 40 Megapixels
  MAX_FILE_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_ANIMATION_PAGES: 100,
  MAX_SVG_BYTES: 5 * 1024 * 1024, // 5 MB
} as const;

export interface ImageVariantPreset {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: SupportedOutputFormat;
  quality?: number;
  withoutEnlargement?: boolean;
}

export const AVATAR_STANDARD_SIZES = [32, 48, 64, 96, 128, 256, 512] as const;

export const STANDARD_IMAGE_PRESETS: Record<string, ImageVariantPreset> = {
  thumbnail: {
    width: 320,
    height: 320,
    fit: 'cover',
    format: 'webp',
    quality: 80,
    withoutEnlargement: true,
  },
  small: {
    width: 480,
    fit: 'inside',
    format: 'webp',
    quality: 82,
    withoutEnlargement: true,
  },
  medium: {
    width: 1024,
    fit: 'inside',
    format: 'webp',
    quality: 85,
    withoutEnlargement: true,
  },
  large: {
    width: 1920,
    fit: 'inside',
    format: 'webp',
    quality: 88,
    withoutEnlargement: true,
  },
  avatar: {
    width: 256,
    height: 256,
    fit: 'cover',
    format: 'webp',
    quality: 90,
    withoutEnlargement: false,
  },
  chatPreview: {
    width: 800,
    height: 600,
    fit: 'inside',
    format: 'webp',
    quality: 85,
    withoutEnlargement: true,
  },
  filePreview: {
    width: 1024,
    height: 768,
    fit: 'inside',
    format: 'webp',
    quality: 85,
    withoutEnlargement: true,
  },
  workspaceLogo: {
    width: 256,
    height: 256,
    fit: 'contain',
    format: 'webp',
    quality: 90,
    withoutEnlargement: true,
  },
  appIcon: {
    width: 128,
    height: 128,
    fit: 'cover',
    format: 'webp',
    quality: 90,
    withoutEnlargement: true,
  },
  agentIcon: {
    width: 128,
    height: 128,
    fit: 'cover',
    format: 'webp',
    quality: 90,
    withoutEnlargement: true,
  },
  coverImage: {
    width: 1920,
    height: 720,
    fit: 'cover',
    format: 'webp',
    quality: 85,
    withoutEnlargement: true,
  },
  socialPreview: {
    width: 1200,
    height: 630,
    fit: 'cover',
    format: 'jpeg',
    quality: 85,
    withoutEnlargement: true,
  },
};
