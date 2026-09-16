import { cn } from '@org/utils';
import { Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Extracts the domain from a URL string and builds a high-resolution Google favicon URL.
 * Returns null if the URL is invalid or has no valid hostname.
 */
export function getFaviconUrl(urlStr?: string): string | null {
  if (!urlStr) return null;
  const raw = urlStr.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = parsed.hostname;
    // Basic validation: ensure host contains a dot or is valid domain/ip
    if (!host || host.length < 3 || (!host.includes('.') && host !== 'localhost')) {
      return null;
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

export interface BookmarkFaviconProps {
  href?: string;
  iconUrl?: string;
  emoji?: string;
  className?: string;
  fallbackIconClassName?: string;
}

/**
 * Auto-fetches favicon from the link URL, falling back to an optional custom emoji,
 * or the default Link icon if unavailable/unreachable.
 */
export function BookmarkFavicon({
  href,
  iconUrl,
  emoji,
  className = 'size-4 shrink-0',
  fallbackIconClassName = 'size-3.5 text-muted-foreground',
}: BookmarkFaviconProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const targetUrl = iconUrl || (href ? getFaviconUrl(href) : null);

  useEffect(() => {
    setLoadFailed(false);
  }, [targetUrl]);

  if (targetUrl && !loadFailed) {
    return (
      <img
        src={targetUrl}
        alt=""
        aria-hidden
        onError={() => setLoadFailed(true)}
        className={cn('rounded-xs object-contain shrink-0', className)}
        loading="lazy"
      />
    );
  }

  if (emoji) {
    return (
      <span aria-hidden className="text-xs shrink-0 select-none">
        {emoji}
      </span>
    );
  }

  return <Link2 className={fallbackIconClassName} aria-hidden />;
}
