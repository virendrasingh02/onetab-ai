import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { ExternalLink, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { isDesktop, openExternal } from './desktop-api.js';

export interface PlatformNoticeProps {
  /** Where this feature does *not* work. */
  unsupportedOn: 'desktop' | 'web';
  /** What is unavailable, in one sentence. */
  message: ReactNode;
  /**
   * Absolute URL of the browser equivalent. Renders an "Open in browser"
   * button, which on desktop hands the URL to the system browser.
   */
  browserUrl?: string;
  className?: string;
  /** Rendered instead of the notice on platforms where the feature works. */
  children?: ReactNode;
}

/**
 * Explains a capability gap instead of letting the UI fail silently.
 *
 * A handful of things behave differently inside the Electron shell — see
 * `docs/desktop-app.md` for the current list. Where the difference is visible
 * to the user, this states it plainly and offers the way around it, rather than
 * leaving a button that quietly does nothing.
 */
export function PlatformNotice({
  unsupportedOn,
  message,
  browserUrl,
  className,
  children,
}: PlatformNoticeProps) {
  const affected = unsupportedOn === 'desktop' ? isDesktop : !isDesktop;

  if (!affected) return <>{children}</>;

  return (
    <div
      role="note"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5',
        'text-xs text-muted-foreground',
        className,
      )}
    >
      <Info className="size-4 shrink-0 text-[#FFB224]" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>

      {browserUrl ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openExternal(browserUrl)}
          trailingIcon={<ExternalLink className="size-3.5" />}
        >
          Open in browser
        </Button>
      ) : null}
    </div>
  );
}
