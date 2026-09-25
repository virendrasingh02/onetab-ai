import { Button } from '@org/ui';
import { useBrowserSignIn, type DesktopBrowserAuthIntent } from '@org/web-desktop';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AuthLayout } from '../auth-layout.js';

export interface DesktopBrowserSignInProps {
  /** `sign-up` opens the browser on the registration page instead. */
  intent?: DesktopBrowserAuthIntent;
  /** Offers the existing phone-pairing (QR) sign-in as a secondary path. */
  onUseMobile?: () => void;
}

const FAILURE_TITLE: Record<string, string> = {
  cancelled: 'Sign-in cancelled',
  expired: 'Sign-in link expired',
  timeout: 'Sign-in timed out',
  error: 'Sign-in didn’t complete',
};

/**
 * The desktop app's entire sign-in screen. Authentication happens in the
 * user's default browser — the one surface that already supports every
 * method (password, magic link, SSO, 2FA, passkeys) and already holds their
 * session — and comes back to the app over the `onetab://` callback. The
 * shell deliberately has no password form of its own.
 */
export function DesktopBrowserSignIn({ intent = 'sign-in', onUseMobile }: DesktopBrowserSignInProps) {
  const signIn = useBrowserSignIn();
  // The footer can switch between sign-in and sign-up; "Open browser again"
  // must reopen whichever page was opened last.
  const [activeIntent, setActiveIntent] = useState(intent);
  const begin = (next: DesktopBrowserAuthIntent) => {
    setActiveIntent(next);
    void signIn.start(next);
  };
  const isSignUp = activeIntent === 'sign-up';
  const waiting = signIn.state === 'opening' || signIn.state === 'waiting';
  const failed = signIn.state in FAILURE_TITLE;

  let title = isSignUp ? 'Create your OneTab AI account' : 'Welcome to OneTab AI';
  let subtitle = isSignUp
    ? 'Sign up securely in your browser, then come straight back here.'
    : 'Sign in securely using your browser.';
  let body: ReactNode;

  if (waiting) {
    title = 'Continue in your browser';
    subtitle = 'Finish signing in on the page that just opened. This window updates automatically.';
    body = (
      <div className="space-y-3">
        <div
          role="status"
          className="gap-2 py-3 text-xs flex items-center justify-center text-muted-foreground"
        >
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Waiting for your browser…
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          leadingIcon={<ExternalLink />}
          onClick={() => begin(activeIntent)}
        >
          Open browser again
        </Button>
        <Button type="button" variant="ghost" size="md" className="w-full" onClick={() => void signIn.cancel()}>
          Cancel
        </Button>
      </div>
    );
  } else if (signIn.state === 'success') {
    title = 'You’re signed in';
    subtitle = 'Opening your workspace…';
    body = (
      <div role="status" className="py-4 flex justify-center">
        <CheckCircle2 aria-hidden className="size-8 text-success-text" />
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        {failed ? (
          <div
            role="alert"
            className="gap-2 p-3 text-xs flex items-start rounded-lg border border-warning/30 bg-warning/10 text-warning-text"
          >
            <AlertTriangle aria-hidden className="size-4 mt-px shrink-0" />
            <div>
              <p className="font-semibold">{FAILURE_TITLE[signIn.state]}</p>
              {signIn.message ? <p className="mt-0.5">{signIn.message}</p> : null}
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          leadingIcon={<Globe />}
          onClick={() => begin(activeIntent)}
        >
          {failed ? 'Try again in browser' : isSignUp ? 'Sign up in browser' : 'Continue in Browser'}
        </Button>

        {onUseMobile ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            leadingIcon={<Smartphone className="text-muted-foreground" />}
            onClick={onUseMobile}
          >
            Sign in with your phone
          </Button>
        ) : null}

        <p className="gap-1.5 pt-1 text-[11px] flex items-center justify-center text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5" />
          Your password is never entered in this app.
        </p>
      </div>
    );
  }

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      footer={
        waiting || signIn.state === 'success' ? undefined : isSignUp ? (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => begin('sign-in')}
              className="font-medium text-foreground hover:underline"
            >
              Sign in with browser
            </button>
          </>
        ) : (
          <>
            New to OneTab AI?{' '}
            <button
              type="button"
              onClick={() => begin('sign-up')}
              className="font-medium text-foreground hover:underline"
            >
              Create an account
            </button>
          </>
        )
      }
    >
      {body}
    </AuthLayout>
  );
}
