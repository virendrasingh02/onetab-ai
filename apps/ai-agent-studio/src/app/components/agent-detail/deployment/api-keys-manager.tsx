import { agentApiKeysApi } from '@org/api-client';
import type { AgentApiKeyCreated, AgentApiKeyView } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from './parts.js';
import { errorMessage } from './use-deployment.js';

/** These mutations report their own errors, so the app-wide error toast stays quiet. */
const QUIET = { disableToast: true } as const;

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : null);

/**
 * The workspace's agent API keys: create, see what exists, revoke. The key
 * itself is shown exactly once, in the response to creating it.
 */
export function ApiKeysManager({ workspaceId, title = 'API keys', description }: { workspaceId: string; title?: string; description?: string }) {
  const queryClient = useQueryClient();
  const key = ['agent-api-keys', workspaceId] as const;

  const keysQuery = useQuery({ queryKey: key, queryFn: () => agentApiKeysApi.list(workspaceId), enabled: !!workspaceId });
  const keys = keysQuery.data ?? [];

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [created, setCreated] = useState<AgentApiKeyCreated | null>(null);

  const create = useMutation({
    meta: QUIET,
    mutationFn: () => agentApiKeysApi.create(workspaceId, { name: name.trim(), expiresInDays: expiry === 'never' ? undefined : Number(expiry) }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: key });
      setCreated(result);
      setOpen(false);
      setName('');
      setExpiry('never');
    },
    onError: (e) => toast.error('Could not create the key', { description: errorMessage(e) }),
  });

  const revoke = useMutation({
    meta: QUIET,
    mutationFn: (id: string) => agentApiKeysApi.revoke(workspaceId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success('Key revoked: anything using it is refused from now on');
    },
    onError: (e) => toast.error('Could not revoke the key', { description: errorMessage(e) }),
  });

  const confirmRevoke = async (k: AgentApiKeyView) => {
    const ok = await confirm({
      title: `Revoke “${k.name}”?`,
      description: 'Every system using this key is refused immediately. This can’t be undone; create a new key to replace it.',
      confirmLabel: 'Revoke key',
      destructive: true,
    });
    if (ok) revoke.mutate(k.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {description ?? 'Private keys for server-to-server calls to published agents. They belong to the workspace and work for any of its agents.'}
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-xs font-semibold">
          <Plus className="size-3.5" /> Create key
        </Button>
      </div>

      {created ? (
        <div className="space-y-2 rounded-xl border border-success/40 bg-success/10 p-4" role="status">
          <div className="flex items-center gap-1.5 text-xs font-bold text-success">
            <CheckCircle2 className="size-4" /> “{created.name}” is ready
          </div>
          <p className="text-xs text-foreground">Copy it now. It can’t be shown again; only its first characters are kept to identify it.</p>
          <div className="flex items-center gap-2">
            <Input value={created.apiKey} readOnly aria-label="New API key" className="bg-card font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={created.apiKey} label="Copy key" className="shrink-0 text-xs" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {keysQuery.isLoading ? (
        <LoadingState label="Loading keys…" />
      ) : keysQuery.isError ? (
        <ErrorState title="Couldn’t load API keys" description={errorMessage(keysQuery.error)} onRetry={() => void keysQuery.refetch()} />
      ) : keys.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title="No API keys yet"
          description="Create a key to run published agents from your own backend, CI or scheduled jobs."
          action={
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-xs">
              <Plus className="size-3.5" /> Create the first key
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-2xs">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{k.name}</span>
                    <code className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{k.keyPrefix}••••••••</code>
                    {!k.isActive ? <Badge variant="outline" className="text-[10px]">{k.expiresAt && new Date(k.expiresAt) < new Date() ? 'Expired' : 'Revoked'}</Badge> : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Created {when(k.createdAt)}
                    {k.expiresAt ? ` · expires ${when(k.expiresAt)}` : ''}
                    {' · '}
                    {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : 'never used'}
                  </div>
                </div>
                {k.isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void confirmRevoke(k)}
                    loading={revoke.isPending && revoke.variables === k.id}
                    className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" /> Revoke
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" /> Create an API key
              </DialogTitle>
              <DialogDescription className="text-xs">Name it after what will use it, so you know what to rotate if it leaks.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4 text-xs">
              <Field label="Name" required>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightly report job" />
              </Field>
              <Field label="Expiry">
                <AppSelect value={expiry} onValueChange={setExpiry} options={EXPIRY_OPTIONS} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim()} className="font-semibold">
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
