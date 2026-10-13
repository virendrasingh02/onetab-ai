import {
  authApi,
  restoreBrowserSession,
  setAccessToken,
  setSessionExpiredHandler,
  workspaceApi,
} from '@org/api-client';
import type { CurrentUser, Workspace } from '@org/types';
import { Button, ErrorState, LoadingState } from '@org/ui';
import { ShieldAlert } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { WEB_APP_URL } from './auth-redirect.js';
import { StudioSignIn } from './studio-sign-in.js';

const ACTIVE_WORKSPACE_KEY = 'onetab_active_workspace_id';

export interface StudioSession {
  user: CurrentUser;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace: (ws: Workspace) => void;
  refetchWorkspaces: () => Promise<void>;
  /** Ends the platform session (shared with the web app) and returns to sign-in. */
  signOut: () => Promise<void>;
}

const StudioSessionContext = createContext<StudioSession | null>(null);

export function useStudioSession(): StudioSession {
  const ctx = useContext(StudioSessionContext);
  if (!ctx) {
    throw new Error('useStudioSession must be used within SessionGuard');
  }
  return ctx;
}

function readSavedWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function saveWorkspaceId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

type Phase =
  /** Asking the platform who this is. */
  | { kind: 'loading' }
  /** Signed out; the tab is on its way to the web app's sign-in. */
  | { kind: 'redirecting' }
  | { kind: 'signed-out'; cameBack: boolean }
  /** The API couldn't be reached — not the same as being signed out. */
  | { kind: 'unreachable'; message: string }
  | { kind: 'no-workspace'; user: CurrentUser }
  | { kind: 'ready'; user: CurrentUser; workspaces: Workspace[]; activeWorkspace: Workspace };

/**
 * Gates Studio behind a platform session.
 *
 * - Already signed in (a live token, the shared refresh cookie, or a `#token=`
 *   hand-off from the web app): straight in, no click.
 * - Signed out: redirected to the web app's sign-in, which returns here.
 * - Session ends while Studio is open: back to sign-in, to the same page.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // A retry can overlap the first check (StrictMode runs effects twice): only the latest answer counts.
  const run = useRef(0);

  const initSession = useCallback(async () => {
    const mine = ++run.current;
    const current = () => run.current === mine;
    setPhase({ kind: 'loading' });

    try {
      // Hand-off fragment → in-memory token → shared refresh cookie. `null`
      // means signed out; an unreachable API throws into the catch below.
      const user = await restoreBrowserSession();
      if (!current()) return;

      if (!user) {
        // Studio signs people in itself, so it works without the main web app.
        setPhase({ kind: 'signed-out', cameBack: false });
        return;
      }

      const workspaces = await workspaceApi.list();
      if (!current()) return;

      if (workspaces.length === 0) {
        setPhase({ kind: 'no-workspace', user });
        return;
      }
      const activeWorkspace =
        workspaces.find((w) => w.id === readSavedWorkspaceId()) ?? workspaces[0];
      saveWorkspaceId(activeWorkspace.id);
      setPhase({ kind: 'ready', user, workspaces, activeWorkspace });
    } catch (err) {
      if (!current()) return;
      setPhase({
        kind: 'unreachable',
        message: err instanceof Error && err.message ? err.message : 'The OneTab API did not respond.',
      });
    }
  }, []);

  useEffect(() => {
    void initSession();
  }, [initSession]);

  // The platform refused to renew the session (revoked, expired, signed out
  // elsewhere): go back to sign-in and return to the same page afterwards.
  useEffect(() => {
    setSessionExpiredHandler(() => setPhase({ kind: 'signed-out', cameBack: false }));
    return () => setSessionExpiredHandler(null);
  }, []);

  // Signed in to the main app in another tab? The refresh cookie is shared, so
  // coming back to this tab while signed out picks that session up on its own.
  const signedOut = phase.kind === 'signed-out';
  useEffect(() => {
    if (!signedOut) return;
    const recheck = () => {
      if (document.visibilityState === 'visible') void initSession();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [signedOut, initSession]);

  const setActiveWorkspace = useCallback((activeWorkspace: Workspace) => {
    saveWorkspaceId(activeWorkspace.id);
    setPhase((p) => (p.kind === 'ready' ? { ...p, activeWorkspace } : p));
  }, []);

  const refetchWorkspaces = useCallback(async () => {
    try {
      const workspaces = await workspaceApi.list();
      setPhase((p) => {
        if (p.kind !== 'ready') return p;
        const activeWorkspace = workspaces.find((w) => w.id === p.activeWorkspace.id) ?? p.activeWorkspace;
        return { ...p, workspaces, activeWorkspace };
      });
    } catch {
      // Keep what is on screen; the next refetch tries again.
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The cookie may already be gone. Signing out locally is still right.
    }
    setAccessToken(null);
    saveWorkspaceId(null);
    setPhase({ kind: 'signed-out', cameBack: false });
  }, []);

  if (phase.kind === 'loading') {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  if (phase.kind === 'redirecting') {
    return <LoadingState fullPage label="Taking you to sign in…" />;
  }

  if (phase.kind === 'unreachable') {
    return (
      <ErrorState
        fullPage
        title="Couldn't reach the platform"
        description={phase.message}
        onRetry={() => void initSession()}
      />
    );
  }

  if (phase.kind === 'signed-out') {
    return <StudioSignIn onSignedIn={() => void initSession()} />;
  }

  if (phase.kind === 'no-workspace') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-xl font-bold">No workspace yet</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You are signed in as <span className="font-semibold text-foreground">{phase.user.email}</span>, but you are
          not a member of any workspace.
        </p>
        <div className="mt-6 flex gap-2">
          <Button asChild>
            <a href={`${WEB_APP_URL}/workspaces/new`}>Create or join a workspace</a>
          </Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StudioSessionContext.Provider
      value={{
        user: phase.user,
        workspaces: phase.workspaces,
        activeWorkspace: phase.activeWorkspace,
        setActiveWorkspace,
        refetchWorkspaces,
        signOut,
      }}
    >
      {children}
    </StudioSessionContext.Provider>
  );
}
