import { Button } from '@org/ui';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { useVerifyEmail } from '../use-auth.js';

type VerificationStatus = 'verifying' | 'success' | 'error' | 'missing';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<VerificationStatus>(token ? 'verifying' : 'missing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifyMutation = useVerifyEmail();
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('missing');
      return;
    }

    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    verifyMutation.mutate(
      { token },
      {
        onSuccess: () => {
          setStatus('success');
        },
        onError: (err: any) => {
          setStatus('error');
          setErrorMessage(
            err?.message || 'This email verification link is invalid or has expired.',
          );
        },
      },
    );
  }, [token, verifyMutation]);

  return (
    <AuthLayout
      title={
        status === 'success'
          ? 'Email verified'
          : status === 'error'
          ? 'Verification failed'
          : status === 'missing'
          ? 'Missing token'
          : 'Verifying your email…'
      }
      subtitle={
        status === 'success'
          ? 'Your email address has been successfully verified.'
          : status === 'error'
          ? 'We could not verify your email address.'
          : status === 'missing'
          ? 'No verification token was provided.'
          : 'Please wait while we confirm your email address.'
      }
    >
      <div className="space-y-6 text-center">
        {status === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Confirming your email address with Mie…
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="py-4 flex flex-col items-center justify-center space-y-3">
              <div className="size-12 rounded-full bg-success/10 flex items-center justify-center text-success">
                <CheckCircle2 className="size-7" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Thank you for verifying your email. Your account is fully active and ready to use.
              </p>
            </div>

            <Button asChild className="w-full gap-2">
              <Link to="/login">
                Continue to sign in
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="py-4 flex flex-col items-center justify-center space-y-3">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertCircle className="size-7" />
              </div>
              <p className="text-sm text-destructive max-w-sm mx-auto">
                {errorMessage}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Verification links expire after 24 hours and can only be used once.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button asChild variant="default" className="w-full">
                <Link to="/login">Go to sign in</Link>
              </Button>
            </div>
          </div>
        )}

        {status === 'missing' && (
          <div className="space-y-6">
            <div className="py-4 flex flex-col items-center justify-center space-y-3">
              <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                <Mail className="size-7" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The verification link you clicked appears to be incomplete. Check your inbox and click the full link.
              </p>
            </div>

            <Button asChild variant="default" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
