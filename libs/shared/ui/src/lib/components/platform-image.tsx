import { useAuthenticatedMediaSrc } from '@org/hooks';
import { cn } from '@org/utils';
import { ImageOff, Loader2 } from 'lucide-react';
import React, {
  useState,
  useMemo,
  type ImgHTMLAttributes,
  type ReactNode,
} from 'react';

export type PlatformImageVariant =
  | 'thumbnail'
  | 'small'
  | 'medium'
  | 'large'
  | 'original';

export interface MediaAssetSource {
  contentUrl?: string | null;
  thumbnailUrl?: string | null;
  downloadUrl?: string | null;
  variants?: Record<string, string> | null;
}

export interface PlatformImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading' | 'decoding'> {
  src: string | MediaAssetSource | null | undefined;
  alt: string;
  variant?: PlatformImageVariant;
  fallback?: ReactNode;
  blurDataUrl?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  aspectRatio?: string;
  responsive?: boolean;
}

export function PlatformImage({
  src,
  alt,
  variant = 'medium',
  fallback,
  blurDataUrl,
  loading = 'lazy',
  decoding = 'async',
  fit = 'cover',
  aspectRatio,
  responsive = true,
  className,
  onLoad,
  onError,
  style,
  ...props
}: PlatformImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Resolve target URL from object or raw string
  const targetUrl = useMemo<string | undefined>(() => {
    if (!src) return undefined;
    if (typeof src === 'string') {
      if (variant !== 'original' && src.startsWith('/files/')) {
        const hasQuery = src.includes('?');
        return `${src}${hasQuery ? '&' : '?'}variant=${variant}`;
      }
      return src;
    }

    // MediaAssetSource object
    if (variant === 'thumbnail' && src.thumbnailUrl) {
      return src.thumbnailUrl;
    }
    if (src.variants && src.variants[variant]) {
      return src.variants[variant];
    }
    if (variant === 'thumbnail' && src.variants?.['thumbnail']) {
      return src.variants['thumbnail'];
    }
    if (src.contentUrl) {
      if (variant !== 'original') {
        const hasQuery = src.contentUrl.includes('?');
        return `${src.contentUrl}${hasQuery ? '&' : '?'}variant=${variant}`;
      }
      return src.contentUrl;
    }
    return undefined;
  }, [src, variant]);

  // Authenticated Matrix media resolver if URL is mxc:// or authenticated media
  const resolvedSrc = useAuthenticatedMediaSrc(targetUrl);

  // Build responsive srcSet if variants are available
  const srcSet = useMemo<string | undefined>(() => {
    if (!responsive || typeof src === 'string' || !src?.variants) return undefined;

    const entries: string[] = [];
    if (src.variants['thumbnail']) entries.push(`${src.variants['thumbnail']} 320w`);
    if (src.variants['small']) entries.push(`${src.variants['small']} 480w`);
    if (src.variants['medium']) entries.push(`${src.variants['medium']} 1024w`);
    if (src.variants['large']) entries.push(`${src.variants['large']} 1920w`);

    return entries.length > 1 ? entries.join(', ') : undefined;
  }, [src, responsive]);

  const fitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down',
  }[fit];

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoaded(false);
    onError?.(e);
  };

  if (!resolvedSrc || hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-surface-muted border border-border/60 text-muted-foreground p-3 select-none',
          className,
        )}
        style={{ aspectRatio, ...style }}
        role="img"
        aria-label={alt}
      >
        {fallback || (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <ImageOff className="size-5 text-muted-foreground/60" />
            <span className="text-[11px] font-medium text-muted-foreground/80">
              Image unavailable
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg inline-block', className)}
      style={{ aspectRatio, ...style }}
    >
      {/* Skeleton loading shimmer */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-surface-muted animate-pulse flex items-center justify-center">
          {blurDataUrl ? (
            <img
              src={blurDataUrl}
              alt=""
              aria-hidden="true"
              className="size-full object-cover filter blur-lg scale-110"
            />
          ) : (
            <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
          )}
        </div>
      )}

      <img
        src={resolvedSrc}
        srcSet={srcSet}
        sizes={srcSet ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw' : undefined}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'size-full transition-opacity duration-200',
          fitClass,
          isLoaded ? 'opacity-100' : 'opacity-0',
        )}
        {...props}
      />
    </div>
  );
}
