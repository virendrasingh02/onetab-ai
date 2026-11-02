import { userApi } from '@org/api-client';
import { Field, Input } from '@org/ui';
import { normalizeUsername, usernameProblem } from '@org/validation';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Check =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'unavailable'; reason: string };

const CHECK_DELAY_MS = 350;

/**
 * The editable `@handle` with a live availability check against the API.
 * Format problems show straight away; only well-formed, changed handles hit
 * the server, and a stale answer never overwrites a newer one.
 */
export function UsernameField({
  value,
  onChange,
  current,
  error,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The saved handle — unchanged input needs no check. */
  current: string | null | undefined;
  /** Form-level error (e.g. a 409 from save). */
  error?: string;
  className?: string;
}) {
  const normalized = normalizeUsername(value);
  const unchanged = normalized === (current ?? '');
  const formatProblem =
    normalized && !unchanged ? usernameProblem(normalized) : null;
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  useEffect(() => {
    if (!normalized || unchanged || formatProblem) {
      setCheck({ state: 'idle' });
      return;
    }
    setCheck({ state: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      userApi
        .checkUsername(normalized, controller.signal)
        .then((res) =>
          setCheck(
            res.available
              ? { state: 'available' }
              : {
                  state: 'unavailable',
                  reason: res.reason ?? 'That username is taken',
                },
          ),
        )
        .catch(() => {
          // Aborted or offline — the save itself re-checks on the server.
          if (!controller.signal.aborted) setCheck({ state: 'idle' });
        });
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized, unchanged, formatProblem]);

  const shownError =
    error ??
    formatProblem ??
    (check.state === 'unavailable' ? check.reason : undefined);

  return (
    <Field
      label="Username / Handle"
      className={className}
      error={shownError}
      success={
        check.state === 'available' ? `@${normalized} is available` : undefined
      }
      hint="Teammates see this on your profile card. Letters, numbers, _ and ."
    >
      <Input
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/^@+/, '').toLowerCase())
        }
        prefix="@"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={30}
        invalid={!!shownError}
        suffix={
          check.state === 'checking' ? (
            <Loader2
              className="size-3.5 animate-spin text-muted-foreground"
              aria-label="Checking"
            />
          ) : undefined
        }
        wrapperClassName="h-9 font-mono"
      />
    </Field>
  );
}
