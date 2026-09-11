import { HttpException, HttpStatus } from '@nestjs/common';

export type MediaErrorCode =
  | 'INVALID_IMAGE'
  | 'UNSUPPORTED_FORMAT'
  | 'IMAGE_TOO_LARGE'
  | 'PIXEL_LIMIT_EXCEEDED'
  | 'PROCESSING_FAILED'
  | 'INVALID_DIMENSIONS'
  | 'INVALID_CROP'
  | 'STORAGE_FAILED'
  | 'VARIANT_GENERATION_FAILED'
  | 'UNAUTHORIZED_MEDIA';

export class MediaProcessingException extends HttpException {
  constructor(
    public readonly code: MediaErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    super(
      {
        statusCode: status,
        error: code,
        message,
        details,
      },
      status,
    );
  }
}

export class InvalidImageException extends MediaProcessingException {
  constructor(message = 'The provided file is not a valid image or is corrupted.', details?: Record<string, unknown>) {
    super('INVALID_IMAGE', message, HttpStatus.BAD_REQUEST, details);
  }
}

export class UnsupportedFormatException extends MediaProcessingException {
  constructor(format: string) {
    super(
      'UNSUPPORTED_FORMAT',
      `Image format "${format}" is not supported. Supported formats: JPEG, PNG, WebP, AVIF, GIF, TIFF, SVG.`,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      { format },
    );
  }
}

export class ImageTooLargeException extends MediaProcessingException {
  constructor(bytes: number, maxBytes: number) {
    super(
      'IMAGE_TOO_LARGE',
      `Image file size (${(bytes / (1024 * 1024)).toFixed(1)} MB) exceeds the allowed limit of ${(maxBytes / (1024 * 1024)).toFixed(1)} MB.`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      { bytes, maxBytes },
    );
  }
}

export class PixelLimitExceededException extends MediaProcessingException {
  constructor(width: number, height: number, maxPixels: number) {
    super(
      'PIXEL_LIMIT_EXCEEDED',
      `Image resolution (${width}x${height} = ${width * height} pixels) exceeds the maximum allowed ${maxPixels} pixels.`,
      HttpStatus.BAD_REQUEST,
      { width, height, maxPixels },
    );
  }
}

export class InvalidDimensionsException extends MediaProcessingException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_DIMENSIONS', message, HttpStatus.BAD_REQUEST, details);
  }
}

export class InvalidCropException extends MediaProcessingException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_CROP', message, HttpStatus.BAD_REQUEST, details);
  }
}

export class ProcessingFailedException extends MediaProcessingException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'PROCESSING_FAILED',
      message || 'Failed to process the image.',
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

export class VariantGenerationFailedException extends MediaProcessingException {
  constructor(variant: string, reason?: string) {
    super(
      'VARIANT_GENERATION_FAILED',
      `Failed to generate image variant "${variant}"${reason ? `: ${reason}` : '.'}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { variant, reason },
    );
  }
}

export class UnauthorizedMediaException extends MediaProcessingException {
  constructor(message = 'You are not authorized to access or modify this media.') {
    super('UNAUTHORIZED_MEDIA', message, HttpStatus.FORBIDDEN);
  }
}
