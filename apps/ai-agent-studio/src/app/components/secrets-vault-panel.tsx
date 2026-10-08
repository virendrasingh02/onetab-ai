import { aiSecretsApi } from '@org/api-client';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  confirm,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { errorText } from './agent-architect/architect-ui.js';

/** Built-in tools look secrets up by name, so keep keys identifier-shaped. */
const SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface SecretsVaultPanelProps {
  workspaceId: string;
  title?: string;
  description?: React.ReactNode;
}

/**
 * The workspace's encrypted AI secrets (`aiSecretsApi`). Values are write-only:
 * the API only ever returns a masked preview.
 */
export function SecretsVaultPanel({ workspaceId, title = 'Secrets Vault', description }: SecretsVaultPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = ['studio-ai-secrets', workspaceId];

  const secretsQuery = useQuery({
    queryKey,
    queryFn: () => aiSecretsApi.list(workspaceId),
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretDescription, setSecretDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      aiSecretsApi.create(workspaceId, {
        key: secretKey.trim(),
        value: secretValue,
        description: secretDescription.trim() || undefined,
      }),
    onSuccess: (saved) => {
      toast.success(`Saved secret ${saved.key}`);
      setIsCreateOpen(false);
      setSecretKey('');
      setSecretValue('');
      setSecretDescription('');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error('Could not save secret', { description: errorText(err, 'Request failed') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => aiSecretsApi.delete(workspaceId, key),
    onSuccess: (_res, key) => {
      toast.success(`Deleted secret ${key}`);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error('Could not delete secret', { description: errorText(err, 'Request failed') });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!SECRET_KEY_PATTERN.test(secretKey.trim())) {
      toast.error('Use letters, digits and underscores only, starting with a letter or underscore');
      return;
    }
    if (!secretValue) return;
    createMutation.mutate();
  };

  const handleDelete = async (key: string) => {
    const ok = await confirm({
      title: `Delete ${key}?`,
      description: 'Anything that reads this secret will fail until it is recreated.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(key);
  };

  const secrets = secretsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {description ??
              'Encrypted values for tools and integrations. Values are write-only — only a masked preview is ever returned.'}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 text-xs shrink-0">
          <Plus className="size-3.5" />
          Add Secret
        </Button>
      </div>

      {secretsQuery.isLoading ? (
        <LoadingState label="Loading secrets…" />
      ) : secretsQuery.isError ? (
        <ErrorState
          title="Could not load secrets"
          description={errorText(secretsQuery.error, 'Request failed')}
          onRetry={() => void secretsQuery.refetch()}
        />
      ) : secrets.length === 0 ? (
        <EmptyState
          icon={<Key className="size-6" />}
          title="No secrets yet"
          description="Store API keys and tokens here instead of pasting them into prompts or node settings."
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
          {secrets.map((sec) => (
            <div key={sec.id} className="flex items-center justify-between p-4 text-xs">
              <div className="space-y-1 min-w-0">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Key className="size-3.5 text-primary shrink-0" />
                  <span className="font-mono truncate">{sec.key}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">{sec.maskedValue}</div>
                <div className="text-[10px] text-muted-foreground">
                  {sec.description ? `${sec.description} · ` : ''}Updated {new Date(sec.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => void handleDelete(sec.key)}
                className="text-destructive hover:bg-destructive/10 shrink-0"
                title={`Delete ${sec.key}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Secret</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <DialogBody className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Key</label>
                <Input
                  placeholder="e.g. FIRECRAWL_API_KEY"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Value</label>
                <Input
                  type="password"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  autoComplete="off"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Encrypted at rest. Saving an existing key replaces its value.
                </p>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Description (optional)</label>
                <Input value={secretDescription} onChange={(e) => setSecretDescription(e.target.value)} />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={createMutation.isPending}>
                Save Secret
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
