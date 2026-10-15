import { oauthAppsApi } from '@org/api-client';
import type { OAuthAppStatus } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, ExternalLink, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';

const OAUTH_APPS_KEY = (workspaceId: string | undefined) => ['oauth-apps', workspaceId] as const;

/** The workspace's OAuth apps (which providers can be connected, and with whose client). */
export function useOAuthApps(workspaceId: string | undefined) {
  return useQuery({
    queryKey: OAUTH_APPS_KEY(workspaceId),
    queryFn: () => oauthAppsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

/** The OAuth app family that serves a connector, if it needs one. */
export function oauthAppFor(apps: OAuthAppStatus[] | undefined, provider: string): OAuthAppStatus | undefined {
  const key = provider.toUpperCase();
  return apps?.find((a) => a.providers.includes(key));
}

function useOAuthAppMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  // Connector listings in both apps derive "available" from these apps, so refresh them too.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: OAUTH_APPS_KEY(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: ['connectors', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['integrations', workspaceId] }),
    ]);
  const save = useMutation({
    mutationFn: (v: { appKey: string; clientId: string; clientSecret?: string; enabled?: boolean }) =>
      oauthAppsApi.save(workspaceId, v.appKey, { clientId: v.clientId, clientSecret: v.clientSecret, enabled: v.enabled }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (appKey: string) => oauthAppsApi.remove(workspaceId, appKey),
    onSuccess: refresh,
  });
  return { save, remove };
}

const SOURCE_LABEL: Record<OAuthAppStatus['source'], string> = {
  workspace: 'Your app',
  server: 'Platform default',
  none: 'Not set up',
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs">{value}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Copy ${label} redirect URL`}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

function AppEditor({
  workspaceId,
  app,
  canEdit,
  onBack,
}: {
  workspaceId: string;
  app: OAuthAppStatus;
  canEdit: boolean;
  onBack: () => void;
}) {
  const { save, remove } = useOAuthAppMutations(workspaceId);
  const [clientId, setClientId] = useState(app.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [enabled, setEnabled] = useState(app.secretSet ? app.enabled : true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClientId(app.clientId ?? '');
    setClientSecret('');
    setEnabled(app.secretSet ? app.enabled : true);
    setError(null);
  }, [app.appKey, app.clientId, app.secretSet, app.enabled]);

  const needsSecret = !app.secretSet;
  const canSave = clientId.trim().length >= 3 && (!needsSecret || clientSecret.trim().length > 0);
  const busy = save.isPending || remove.isPending;
  const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

  const submit = () => {
    setError(null);
    save.mutate(
      { appKey: app.appKey, clientId, clientSecret: clientSecret.trim() || undefined, enabled },
      {
        onSuccess: () => {
          toast.success(`${app.label} OAuth app saved.`);
          onBack();
        },
        onError: (err) => setError(message(err, 'Could not save the OAuth app.')),
      },
    );
  };

  const reset = () => {
    setError(null);
    remove.mutate(app.appKey, {
      onSuccess: () => {
        toast.success(app.serverFallback ? `${app.label} now uses the platform default.` : `${app.label} OAuth app removed.`);
        onBack();
      },
      onError: (err) => setError(message(err, 'Could not remove the OAuth app.')),
    });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> All OAuth apps
      </button>

      <div>
        <div className="text-sm font-medium text-foreground">{app.label}</div>
        <p className="text-xs text-muted-foreground">
          Used for {app.providerNames.join(', ')}. {app.setupHint}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-surface-raised p-3">
        <div className="text-xs font-medium text-foreground">1. Allow these redirect URLs</div>
        {app.callbackUrls.map((c) => (
          <CopyRow key={c.url} label={c.provider} value={c.url} />
        ))}
        <a
          href={app.setupUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open {app.label} developer console <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-foreground">2. Paste the client credentials</div>
        <div className="space-y-1">
          <Label htmlFor="oauth-client-id" className="text-xs">
            Client ID
          </Label>
          <Input
            id="oauth-client-id"
            value={clientId}
            autoComplete="off"
            disabled={!canEdit}
            placeholder={app.clientIdPlaceholder}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="oauth-client-secret" className="text-xs">
            Client secret
          </Label>
          <Input
            id="oauth-client-secret"
            type="password"
            value={clientSecret}
            autoComplete="new-password"
            disabled={!canEdit}
            placeholder={app.secretSet ? '•••••••• saved — leave blank to keep it' : 'Client secret'}
            onChange={(e) => setClientSecret(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Stored encrypted and never shown again.</p>
        </div>
        {app.secretSet && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <div className="text-xs font-medium text-foreground">Use this app</div>
              <p className="text-[11px] text-muted-foreground">
                {app.serverFallback
                  ? 'Switch off to use the platform default instead — your credentials stay saved.'
                  : 'Switch off to pause connecting these apps — your credentials stay saved.'}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} aria-label="Use this OAuth app" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Connections already made keep working. Changing the app only affects new sign-ins and token refreshes for this
        workspace.
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {canEdit ? (
        <div className="flex items-center justify-between gap-2">
          {app.secretSet ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={reset}>
              {app.serverFallback ? 'Use platform default' : 'Remove app'}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" disabled={!canSave || busy} onClick={submit}>
            {save.isPending ? 'Saving…' : 'Save OAuth app'}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only workspace admins can change OAuth apps.</p>
      )}
    </div>
  );
}

/**
 * A workspace's OAuth apps for connectors — the same dialog in the main app's
 * Integration Hub and the AI Agent Studio. Pass `initialAppKey` to jump
 * straight to one provider's setup (e.g. from a "not set up" connector).
 */
export function OAuthAppsDialog({
  workspaceId,
  open,
  onOpenChange,
  initialAppKey,
  initialProvider,
  canEdit = true,
}: {
  workspaceId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAppKey?: string | null;
  /** Alternative to `initialAppKey`: open the app that serves this connector (e.g. `GMAIL`). */
  initialProvider?: string;
  canEdit?: boolean;
}) {
  const apps = useOAuthApps(workspaceId);
  const startKey = initialAppKey ?? (initialProvider ? oauthAppFor(apps.data, initialProvider)?.appKey : undefined) ?? null;
  const [selected, setSelected] = useState<string | null>(startKey);

  useEffect(() => {
    if (open) setSelected(startKey);
  }, [open, startKey]);

  const current = apps.data?.find((a) => a.appKey === selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>OAuth apps</DialogTitle>
          <DialogDescription>
            Connect apps through your own OAuth client instead of the platform’s. Applies to this workspace, in the main
            app and the AI Agent Studio.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {!workspaceId ? null : apps.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : apps.isError ? (
            <p className="text-sm text-destructive">Could not load OAuth apps.</p>
          ) : current ? (
            <AppEditor workspaceId={workspaceId} app={current} canEdit={canEdit} onBack={() => setSelected(null)} />
          ) : (
            <ul className="space-y-2">
              {apps.data?.map((app) => (
                <li key={app.appKey}>
                  <button
                    type="button"
                    onClick={() => setSelected(app.appKey)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 text-left transition-colors hover:bg-accent"
                  >
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{app.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{app.providerNames.join(', ')}</span>
                    </span>
                    <Badge variant={app.source === 'none' ? 'outline' : app.source === 'workspace' ? 'primary' : 'secondary'}>
                      {SOURCE_LABEL[app.source]}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
