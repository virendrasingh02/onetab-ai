import { Button } from '@org/ui';
import { AlertTriangle, CheckCircle2, Laptop, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';

export interface DesktopHandoffPanelProps {
  /** `onetab://auth/callback?code=…` once minted; `null` while minting. */
  callbackUrl: string | null;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * The browser tab's final screen in a desktop sign-in: it launches the
 * `onetab://` callback once, and keeps a button that re-sends the *same*
 * callback in case the browser's "Open OneTab AI?" prompt was dismissed.
 *
 * The previous copies of this screen (one in `LoginPage`, one in
 * `DesktopAuthCallbackPage`) disagreed: one re-sent the callback, the other
 * only opened `onetab://open`, which focuses the app without the code — so
 * dismissing the prompt there left the app waiting forever.
 */
export function DesktopHandoffPanel({ callbackUrl, error, onRetry }: DesktopHandoffPanelProps) {
  const launched = useRef<string | null>(null);

  useEffect(() => {
    if (callbackUrl && launched.current !== callbackUrl) {
      launched.current = callbackUrl;
      window.location.href = callbackUrl;
    }
  }, [callbackUrl]);

  if (error) {
    return (
      <AuthLayout title="Couldn't connect to the desktop app" subtitle={error}>
        <div className="space-y-3 text-center">
          <AlertTriangle aria-hidden className="size-8 mx-auto text-destructive" />
          {onRetry ? (
            <Button type="button" size="lg" className="w-full" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Or start again from the desktop app with “Continue in browser”.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={callbackUrl ? 'You are signed in' : 'Connecting to the desktop app'}
      subtitle={
        callbackUrl
          ? 'Return to OneTab AI Desktop — it has been signed in. You can close this tab.'
          : 'Handing your session to OneTab AI Desktop…'
      }
      footer={
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          Continue in this browser instead
        </Link>
      }
    >
      <div className="space-y-4 text-center" aria-live="polite">
        <div className="size-12 mx-auto flex items-center justify-center rounded-full border border-border bg-surface-raised">
          {callbackUrl ? (
            <CheckCircle2 aria-hidden className="size-6 text-success-text" />
          ) : (
            <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
          )}
        </div>
        {callbackUrl ? (
          <>
            <p className="text-xs text-muted-foreground">
              If the app didn’t open, your browser may have blocked the prompt.
            </p>
            <Button
              type="button"
              size="lg"
              className="w-full"
              leadingIcon={<Laptop />}
              onClick={() => {
                window.location.href = callbackUrl;
              }}
            >
              Open OneTab AI Desktop
            </Button>
          </>
        ) : null}
      </div>
    </AuthLayout>
  );
}
