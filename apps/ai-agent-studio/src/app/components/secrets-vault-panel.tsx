import { aiSecretsApi } from '@org/api-client';
import { WorkspacePermission } from '@org/types';
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
  Label,
} from '@org/ui';
import { useWorkspacePermission } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, Key, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { errorText } from './agent-architect/architect-ui.js';

/** Mirrors `createAISecretSchema`: the server rejects a leading underscore or digit. */
const SECRET_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** Keys the built-in tools read, offered as one-click starting points. */
const SUGGESTED_KEYS = [{ key: 'FIRECRAWL_API_KEY', hint: 'Web search & scraping' }];

const secretRef = (key: string) => `{{secrets.${key}}}`;

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
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_SETTINGS);

  const secretsQuery = useQuery({
    queryKey,
    queryFn: () => aiSecretsApi.list(workspaceId),
  });

  const [search, setSearch] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      setIsDialogOpen(false);
      setSecretValue('');
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

  const openDialog = (key = '', replacing = false) => {
    setSecretKey(key);
    setSecretValue('');
    setSecretDescription('');
    setShowValue(false);
    setEditingKey(replacing ? key : null);
    setIsDialogOpen(true);
  };

  const copyRef = async (key: string) => {
    try {
      await navigator.clipboard.writeText(secretRef(key));
      toast.success(`Copied ${secretRef(key)}`);
    } catch {
      toast.error('Couldn’t copy — your browser blocked the clipboard.');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!SECRET_KEY_PATTERN.test(secretKey.trim())) {
      toast.error('Use letters, digits and underscores only, starting with a letter (max 64 characters)');
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

  const allSecrets = secretsQuery.data ?? [];
  const needle = search.trim().toLowerCase();
  const secrets = needle
    ? allSecrets.filter((sec) => `${sec.key} ${sec.description ?? ''}`.toLowerCase().includes(needle))
    : allSecrets;

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
        {canManage ? (
          <Button size="sm" onClick={() => openDialog()} className="gap-1.5 text-xs shrink-0">
            <Plus className="size-3.5" />
            Add Secret
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" />
          You can see which secrets exist, but only workspace admins can add, replace or delete them.
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
        Use a secret in an HTTP Request node’s URL, headers or body as{' '}
        <code className="font-mono text-foreground">{'{{secrets.KEY}}'}</code>. It is filled in on the server when the
        run executes and never appears in run logs or on the canvas.
      </div>

      {allSecrets.length > 6 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search secrets"
            className="pl-8 text-xs"
          />
        </div>
      ) : null}

      {secretsQuery.isLoading ? (
        <LoadingState label="Loading secrets…" />
      ) : secretsQuery.isError ? (
        <ErrorState
          title="Could not load secrets"
          description={errorText(secretsQuery.error, 'Request failed')}
          onRetry={() => void secretsQuery.refetch()}
        />
      ) : allSecrets.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={<Key className="size-6" />}
            title="No secrets yet"
            description="Store API keys and tokens here instead of pasting them into prompts or node settings."
          />
          {canManage ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUGGESTED_KEYS.map((suggestion) => (
                <Button
                  key={suggestion.key}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => openDialog(suggestion.key)}
                >
                  <Plus className="size-3.5" />
                  <span className="font-mono">{suggestion.key}</span>
                  <span className="text-muted-foreground">· {suggestion.hint}</span>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : secrets.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No secrets match “{search}”.</p>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
          {secrets.map((sec) => (
            <div key={sec.id} className="flex items-center justify-between gap-3 p-4 text-xs">
              <div className="space-y-1 min-w-0">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Key className="size-3.5 text-primary shrink-0" />
                  <span className="font-mono truncate">{sec.key}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">{sec.maskedValue}</div>
                <div className="text-[10px] text-muted-foreground">
                  {sec.description ? `${sec.description} · ` : ''}Updated{' '}
                  {new Date(sec.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => void copyRef(sec.key)}
                  title={`Copy ${secretRef(sec.key)}`}
                >
                  <Copy className="size-3.5" />
                </Button>
                {canManage ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openDialog(sec.key, true)}
                      title={`Replace value of ${sec.key}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => void handleDelete(sec.key)}
                      className="text-destructive hover:bg-destructive/10"
                      title={`Delete ${sec.key}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingKey ? `Replace ${editingKey}` : 'Add Secret'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <DialogBody className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="font-semibold text-foreground">Key</Label>
                <Input
                  placeholder="e.g. FIRECRAWL_API_KEY"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="font-mono"
                  maxLength={64}
                  disabled={editingKey !== null}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Keys are stored in upper case, e.g. firecrawl_api_key → FIRECRAWL_API_KEY.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-foreground">Value</Label>
                <div className="relative">
                  <Input
                    type={showValue ? 'text' : 'password'}
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-9 font-mono"
                    autoFocus={secretKey !== ''}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showValue ? 'Hide value' : 'Show value'}
                  >
                    {showValue ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Encrypted at rest. Saving an existing key replaces its value; the old value can’t be recovered.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-foreground">Description (optional)</Label>
                <Input
                  value={secretDescription}
                  onChange={(e) => setSecretDescription(e.target.value)}
                  maxLength={500}
                />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={createMutation.isPending}>
                {editingKey ? 'Replace Secret' : 'Save Secret'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
