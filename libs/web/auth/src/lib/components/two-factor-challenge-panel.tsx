import { ApiError, type AuthResponse } from '@org/api-client';
import { ApiErrorCode, type TwoFactorChallengeResponse } from '@org/types';
import { Button, FormError, Input } from '@org/ui';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAddAccountTwoFactor } from '../use-account-switcher.js';
import { useCompleteTwoFactorLogin } from '../use-auth.js';

const TOTP_LENGTH = 6;

export interface TwoFactorChallengePanelProps {
  challenge: TwoFactorChallengeResponse;
  /**
   * `session` (default) signs this browser in. `add-account` adds the account
   * next to the one already signed in and switches to it.
   */
  mode?: 'session' | 'add-account';
  /** Runs once the session exists — navigate, finish a desktop handoff… */
  onSignedIn?: (data: AuthResponse & { usedRecoveryCode?: boolean }) => void;
  /** Back to the first step (password / new link). */
  onCancel: () => void;
  /** What "back" returns to, e.g. "Back to sign in". */
  cancelLabel?: string;
}

/**
 * The code step of a sign-in for an account with two-factor on. Takes a 6-digit
 * authenticator code (submits itself once complete) or, on request, a one-time
 * recovery code. A timed-out or locked challenge sends the user back to start.
 */
export function TwoFactorChallengePanel({
  challenge,
  mode = 'session',
  onSignedIn,
  onCancel,
  cancelLabel = 'Back to sign in',
}: TwoFactorChallengePanelProps) {
  const signIn = useCompleteTwoFactorLogin();
  const addAccount = useAddAccountTwoFactor();
  const mutation = mode === 'add-account' ? addAccount : signIn;

  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoSubmitted = useRef<string | null>(null);

  const error = mutation.error;
  const expired =
    error instanceof ApiError && error.code === ApiErrorCode.TOKEN_EXPIRED;
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : 'Something went wrong. Please try again.'
    : null;

  const submit = async (value: string) => {
    if (mutation.isPending || expired) return;
    try {
      const data = await mutation.mutateAsync({
        challengeToken: challenge.challengeToken,
        code: value,
      });
      onSignedIn?.(data);
    } catch {
      // A wrong code clears the box for the next try; the error says why.
      setCode('');
    }
  };

  // The box is disabled while a code is checked; hand focus back after a miss.
  const failed = mutation.isError;
  useEffect(() => {
    if (failed) inputRef.current?.focus();
  }, [failed, mutation.error]);

  // Authenticator codes submit themselves the moment the sixth digit lands.
  useEffect(() => {
    if (useRecovery || code.length !== TOTP_LENGTH) return;
    if (lastAutoSubmitted.current === code) return;
    lastAutoSubmitted.current = code;
    void submit(code);
    // `submit` is recreated each render; the code is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, useRecovery]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    lastAutoSubmitted.current = value;
    void submit(value);
  };

  const toggleRecovery = () => {
    setUseRecovery((current) => !current);
    setCode('');
    lastAutoSubmitted.current = null;
    mutation.reset();
    inputRef.current?.focus();
  };

  const back = (
    <button
      type="button"
      onClick={onCancel}
      className="text-xs gap-1.5 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      <span>{cancelLabel}</span>
    </button>
  );

  if (expired) {
    return (
      <div
        className="gap-4 flex flex-col items-center text-center"
        aria-live="polite"
      >
        <div className="size-12 flex items-center justify-center rounded-full border border-border bg-surface-raised text-warning-text">
          <ShieldCheck className="size-6" />
        </div>
        <p className="text-sm max-w-xs text-muted-foreground">{errorMessage}</p>
        <Button type="button" size="md" className="w-full" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="gap-4 flex flex-col items-center text-center"
      noValidate
    >
      <div className="size-12 flex items-center justify-center rounded-full border border-border bg-surface-raised text-info-text">
        <ShieldCheck className="size-6" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Two-factor authentication
        </p>
        <p className="text-xs leading-relaxed max-w-xs text-muted-foreground">
          {useRecovery
            ? 'Enter one of the recovery codes you saved when you turned on two-factor. Each code works once.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>

      <div className="space-y-3 w-full text-left">
        <FormError error={errorMessage} />
        <Input
          ref={inputRef}
          aria-label={useRecovery ? 'Recovery code' : 'Authentication code'}
          value={code}
          onChange={(event) =>
            setCode(
              useRecovery
                ? event.target.value.toUpperCase().slice(0, 16)
                : event.target.value.replace(/\D/g, '').slice(0, TOTP_LENGTH),
            )
          }
          autoFocus
          autoComplete="one-time-code"
          inputMode={useRecovery ? 'text' : 'numeric'}
          spellCheck={false}
          placeholder={useRecovery ? 'XXXX-XXXX' : '123456'}
          className="text-center font-mono tracking-[0.3em]"
          leadingIcon={useRecovery ? <KeyRound /> : <ShieldCheck />}
          disabled={mutation.isPending}
        />
        <Button
          type="submit"
          size="md"
          className="w-full"
          loading={mutation.isPending}
          disabled={
            useRecovery ? code.trim().length < 8 : code.length !== TOTP_LENGTH
          }
        >
          Verify and sign in
        </Button>
      </div>

      <button
        type="button"
        onClick={toggleRecovery}
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {useRecovery
          ? 'Use your authenticator app instead'
          : 'Lost your device? Use a recovery code'}
      </button>

      <div className="pt-3 w-full border-t border-border">{back}</div>
    </form>
  );
}
