import { authApi, isTwoFactorChallenge, setAccessToken } from '@org/api-client';
import { Button, Field, Input } from '@org/ui';
import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface StudioSignInProps {
  /** Called once the API has set the session; the guard then loads the user. */
  onSignedIn: () => void;
}

/**
 * Studio's own sign-in, so it works without the main web app running. Same
 * endpoints as the web app's form: password, then the authenticator code when
 * the account has two-factor on. Magic link / SSO stay in the main app.
 */
export function StudioSignIn({ onSignedIn }: StudioSignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challengeToken) {
        const data = await authApi.completeTwoFactorLogin({ challengeToken, code });
        setAccessToken(data.accessToken);
        onSignedIn();
        return;
      }
      const data = await authApi.login({ email, password, rememberMe: true });
      if (isTwoFactorChallenge(data)) {
        setChallengeToken(data.challengeToken);
        return;
      }
      setAccessToken(data.accessToken);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="mb-6 inline-flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted shadow-xs">
          <Sparkles className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">OneTab AI</span>
        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Studio
        </span>
      </div>

      <form onSubmit={submit} className="w-full max-w-[380px] space-y-4" aria-label="Sign in">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {challengeToken ? 'Two-factor code' : 'Sign in to Agent Studio'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {challengeToken
              ? 'Enter the code from your authenticator app.'
              : 'Use your OneTab AI account.'}
          </p>
        </div>

        {challengeToken ? (
          <Field label="Code" error={error ?? undefined}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
            />
          </Field>
        ) : (
          <>
            <Field label="Work email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </Field>
            <Field label="Password" error={error ?? undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
          </>
        )}

        <Button type="submit" className="w-full" disabled={busy || (challengeToken ? !code : !email || !password)}>
          {busy ? 'Signing in…' : challengeToken ? 'Verify' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
