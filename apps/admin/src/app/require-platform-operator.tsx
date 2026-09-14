import { authApi, setAccessToken } from '@org/api-client';
import { SystemRole, type CurrentUser } from '@org/types';
import { Button, EmptyState, LoadingState } from '@org/ui';
import { Lock, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

type SessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; user: CurrentUser }
  | { status: 'ready' };

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

/**
 * Gates the whole console behind a signed-in platform-operator session.
 *
 * The console has no login page of its own — see `AdminShell`'s docstring —
 * it relies on the httpOnly refresh cookie the API sets on `/auth/login`
 * being visible to it too: cookies are scoped by host, not by port, so a
 * session started at the web app (`:4200`) is already present here (`:4201`)
 * against the same API host. This component only *reads* that session — it
 * exchanges the cookie for an access token on mount (`authApi.refresh()`,
 * the same call the web app's own bootstrap makes) and confirms `systemRole`
 * is a platform-operator role. `SystemRoleGuard` enforces the identical
 * check server-side on every `@SystemRoles(...)` route independently — this
 * gate only saves a signed-out or non-operator visitor from staring at a
 * shell full of "failed to load" charts; it is not itself the security
 * boundary, so getting it removed or bypassed leaks no data.
 */
export function RequirePlatformOperator({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tokens = await authApi.refresh();
        setAccessToken(tokens.accessToken);
        const user = await authApi.me();
        if (cancelled) return;
        setState(
          user.systemRole === SystemRole.USER
            ? { status: 'forbidden', user }
            : { status: 'ready' },
        );
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        setState({ status: 'unauthenticated' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  if (state.status === 'unauthenticated') {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <EmptyState
          size="lg"
          icon={<Lock />}
          title="Sign in required"
          description="The admin console shares its session with the main app — sign in there first, then reload this page."
          action={
            <Button asChild>
              <a href={WEB_APP_URL}>Go to sign in</a>
            </Button>
          }
        />
      </div>
    );
  }

  if (state.status === 'forbidden') {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <EmptyState
          size="lg"
          icon={<ShieldAlert />}
          title="Access denied"
          description={`Signed in as ${state.user.email}, which is not a platform-operator account. Ask an existing operator to change your role.`}
          action={
            <Button variant="outline" asChild>
              <a href={WEB_APP_URL}>Back to the main app</a>
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
