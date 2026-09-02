import { CheckCircle2, Laptop } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export function DesktopAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const [attempted, setAttempted] = useState(false);

  const desktopDeepLink =
    code && state
      ? `onetab://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      : 'onetab://open';

  useEffect(() => {
    if (code && state && !attempted) {
      setAttempted(true);
      window.location.href = desktopDeepLink;
    }
  }, [code, state, attempted, desktopDeepLink]);

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto size-12 rounded-full bg-surface-raised border border-border flex items-center justify-center text-success-text">
          <CheckCircle2 className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Authentication Successful</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Redirecting to OneTab AI Desktop application…
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          If your desktop app did not open automatically, click the button below to complete sign-in.
        </p>

        <button
          type="button"
          className="w-full h-10 rounded-btn bg-primary text-primary-foreground hover:bg-primary-hover font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
          onClick={() => {
            window.location.href = desktopDeepLink;
          }}
        >
          <Laptop className="size-4" />
          <span>Open Desktop App</span>
        </button>

        <div className="pt-1">
          <Link
            to="/"
            className="text-xs text-subtle hover:text-foreground transition-colors"
          >
            Continue in Web Browser instead
          </Link>
        </div>
      </div>
    </div>
  );
}

