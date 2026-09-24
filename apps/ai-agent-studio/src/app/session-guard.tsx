import {
  authApi,
  getAccessToken,
  setAccessToken,
  workspaceApi,
} from '@org/api-client';
import type { CurrentUser, Workspace } from '@org/types';
import { Button, LoadingState } from '@org/ui';
import { ExternalLink, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

export interface StudioSession {
  user: CurrentUser;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace: (ws: Workspace) => void;
  refetchWorkspaces: () => Promise<void>;
}

const StudioSessionContext = createContext<StudioSession | null>(null);

export function useStudioSession(): StudioSession {
  const ctx = useContext(StudioSessionContext);
  if (!ctx) {
    throw new Error('useStudioSession must be used within SessionGuard');
  }
  return ctx;
}

export function SessionGuard({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  const initSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Check for handoff token in URL fragment
      if (typeof window !== 'undefined' && window.location.hash) {
        try {
          const hashParams = new URLSearchParams(
            window.location.hash.replace(/^#/, ''),
          );
          const hashToken =
            hashParams.get('token') || hashParams.get('accessToken');
          if (hashToken) {
            setAccessToken(hashToken);
            window.history.replaceState(
              {},
              document.title,
              `${window.location.pathname}${window.location.search}`,
            );
          }
        } catch {
          // Ignore
        }
      }

      // 2. Check if we already have an active access token or refresh cookie
      let activeUser: CurrentUser | null = null;
      const currentToken = getAccessToken();
      if (currentToken) {
        try {
          activeUser = await authApi.me();
        } catch {
          // Token expired, attempt refresh
        }
      }

      if (!activeUser) {
        try {
          const tokens = await authApi.refresh();
          setAccessToken(tokens.accessToken);
          activeUser = await authApi.me();
        } catch {
          // Unauthenticated
        }
      }

      if (!activeUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(activeUser);

      // 3. Load user's workspaces
      const wsList = await workspaceApi.list();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        // Resolve saved active workspace ID
        const savedWsId = localStorage.getItem('onetab_active_workspace_id');
        const matched = wsList.find((w) => w.id === savedWsId) || wsList[0];
        setActiveWorkspace(matched);
        localStorage.setItem('onetab_active_workspace_id', matched.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void initSession();
  }, [initSession]);

  const handleSelectWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws);
    localStorage.setItem('onetab_active_workspace_id', ws.id);
  };

  const refetchWorkspaces = async () => {
    try {
      const wsList = await workspaceApi.list();
      setWorkspaces(wsList);
      if (activeWorkspace) {
        const updated = wsList.find((w) => w.id === activeWorkspace.id);
        if (updated) setActiveWorkspace(updated);
      }
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return <LoadingState fullPage label="Connecting to platform workspace session…" />;
  }

  // Not authenticated: seamless login redirect or single-click authentication
  if (!user) {
    const returnUrl =
      typeof window !== 'undefined' ? window.location.href : 'http://localhost:4202';
    const loginUrl = `${WEB_APP_URL}/login?returnTo=${encodeURIComponent(returnUrl)}`;

    return (
      <div className="dark flex min-h-screen flex-col items-center justify-between bg-background px-4 py-10 text-foreground selection:bg-primary/25">
        <header className="flex w-full max-w-4xl items-center justify-between pt-4">
          <div className="inline-flex items-center gap-2.5 rounded-lg">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-xs">
              <Sparkles className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              OneTab AI
            </span>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
              Agent Studio
            </span>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <a
              href={WEB_APP_URL}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Main Platform</span>
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </header>

        <main className="my-auto flex w-full max-w-[420px] flex-col items-center text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/5">
            <Sparkles className="size-7" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            AI Agent Studio
          </h1>
          <p className="mt-2 text-balance text-sm leading-relaxed text-muted-foreground">
            A native workflow builder and autonomous agent execution studio for the OneTab AI platform.
          </p>

          <div className="mt-8 w-full space-y-3">
            <Button
              size="lg"
              className="w-full font-medium"
              asChild
            >
              <a href={loginUrl}>
                <span>Sign in with Platform Account</span>
                <ExternalLink className="ml-1.5 size-4" />
              </a>
            </Button>

            <Button
              variant="outline"
              size="md"
              className="w-full text-xs"
              onClick={() => void initSession()}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              <span>Retry Session Check</span>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Uses your existing workspace account, billing credits, and model permissions.
          </p>
        </main>

        <footer className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} OneTab AI Platform. Seamless multi-tenant agent orchestration.
        </footer>
      </div>
    );
  }

  // User has no workspace
  if (workspaces.length === 0 || !activeWorkspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-xl font-bold">No Active Workspace Found</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You are signed in as <span className="font-semibold text-foreground">{user.email}</span>, but you are not a member of any workspace yet.
        </p>
        <div className="mt-6">
          <Button asChild>
            <a href={`${WEB_APP_URL}/workspaces/new`}>Create or Join a Workspace</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StudioSessionContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        setActiveWorkspace: handleSelectWorkspace,
        refetchWorkspaces,
      }}
    >
      {children}
    </StudioSessionContext.Provider>
  );
}
