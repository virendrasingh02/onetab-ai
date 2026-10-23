import { Button } from '@org/ui';
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { WEB_APP_URL } from './auth-redirect.js';

interface SignedOutScreenProps {
  /**
   * True when this tab already went to sign in and came back without a
   * session — the usual causes are a blocked cookie or a sign-in that was
   * abandoned. Says so, instead of silently sending the visitor round again.
   */
  cameBackSignedOut: boolean;
  onSignIn: () => void;
  onRetry: () => void;
}

/**
 * The fallback when the automatic redirect to sign-in can't settle the
 * question. A first visit never sees this: it goes straight to the web app.
 */
export function SignedOutScreen({ cameBackSignedOut, onSignIn, onRetry }: SignedOutScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-background px-4 py-10 text-foreground selection:bg-primary/25">
      <header className="flex w-full max-w-4xl items-center justify-between pt-4">
        <div className="inline-flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground shadow-xs">
            <Sparkles className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Onetab AI</span>
          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Agent Studio
          </span>
        </div>

        <Button variant="ghost" size="sm" asChild>
          <a href={WEB_APP_URL} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <span>Main Platform</span>
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </header>

      <main className="my-auto flex w-full max-w-[420px] flex-col items-center text-center" role="main">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl border border-border bg-muted text-foreground shadow-lg shadow-black/5">
          <Sparkles className="size-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {cameBackSignedOut ? 'We couldn’t pick up your sign-in' : 'Sign in to continue'}
        </h1>
        <p className="mt-2 text-balance text-sm leading-relaxed text-muted-foreground">
          {cameBackSignedOut
            ? 'You went to sign in, but Agent Studio didn’t receive the session. Try again, and make sure this browser allows cookies for the platform.'
            : 'Agent Studio uses your Onetab AI account, workspaces, billing credits and model permissions.'}
        </p>

        <div className="mt-8 w-full space-y-3">
          <Button size="lg" className="w-full font-medium" onClick={onSignIn}>
            <span>Sign in with your platform account</span>
            <ExternalLink className="ml-1.5 size-4" />
          </Button>
          <Button variant="outline" size="md" className="w-full text-xs" onClick={onRetry}>
            <RefreshCw className="mr-1.5 size-3.5" />
            <span>Check again</span>
          </Button>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Onetab AI Platform.
      </footer>
    </div>
  );
}
