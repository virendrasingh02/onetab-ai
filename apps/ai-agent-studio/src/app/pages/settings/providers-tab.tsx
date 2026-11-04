import { aiApi, ApiError, memberApi } from '@org/api-client';
import {
  WorkspaceRole,
  type AIModelMetadata,
  type AIProviderMetadata,
  type AIProviderStatus,
  type ProviderConnectionTestResult,
} from '@org/types';
import {
  AIModelBadge,
  AIProviderIcon,
  AppSelect,
  Badge,
  Button,
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
  Switch,
  toast,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Eye, EyeOff, Lock, RefreshCw, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStudioSession } from '../../session-guard.js';

const QUIET = { disableToast: true } as const;

const errorText = (err: unknown): string =>
  err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';

const STATUS: Record<AIProviderStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  CONNECTED: { label: 'Connected', variant: 'success' },
  NOT_CONFIGURED: { label: 'Not connected', variant: 'outline' },
  AUTH_ERROR: { label: 'Key rejected', variant: 'destructive' },
  RATE_LIMITED: { label: 'Rate limited', variant: 'warning' },
  UNAVAILABLE: { label: 'Unavailable', variant: 'warning' },
  DISABLED: { label: 'Disabled', variant: 'outline' },
  ERROR: { label: 'Connection error', variant: 'destructive' },
};

const isChatModel = (m: AIModelMetadata) => m.type !== 'embedding' && m.type !== 'reranking';

function credentialLine(provider: AIProviderMetadata): string {
  if (provider.credentialSource === 'workspace') return `Workspace key ${provider.maskedKey ?? ''}`.trim();
  if (provider.credentialSource === 'environment') {
    return provider.requiresApiKey ? 'Using the platform key' : 'No key needed';
  }
  return 'No key added';
}

/**
 * Model provider connections for one workspace. Everything here comes from the
 * API, so a card only exists for a provider this deployment can actually run,
 * and its status is what the provider last answered.
 */
export function ProvidersTab() {
  const { activeWorkspace, user } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();

  const providersKey = ['workspace-ai-providers', workspaceId] as const;
  const providersQuery = useQuery({ queryKey: providersKey, queryFn: () => aiApi.getProviders(workspaceId) });
  const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);

  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => memberApi.list(workspaceId),
  });
  const me = membersQuery.data?.find((m) => m.user.id === user.id);
  const canManage = me?.role === WorkspaceRole.OWNER || me?.role === WorkspaceRole.ADMIN;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = providers.find((p) => p.id === selectedId) ?? null;
  const [testingIds, setTestingIds] = useState<ReadonlySet<string>>(new Set());

  /** Model pickers across the Studio read these too, so they refresh together. */
  const refreshAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: providersKey }),
      queryClient.invalidateQueries({ queryKey: ['studio-config'] }),
    ]);

  const runTests = async (targets: AIProviderMetadata[]): Promise<ProviderConnectionTestResult[]> => {
    setTestingIds(new Set(targets.map((p) => p.id)));
    try {
      const settled = await Promise.allSettled(targets.map((p) => aiApi.testProvider(workspaceId, p.id)));
      await refreshAll();
      return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    } finally {
      setTestingIds(new Set());
    }
  };

  const testOne = async (provider: AIProviderMetadata) => {
    const [result] = await runTests([provider]);
    if (!result) toast.error(`Couldn’t test ${provider.name}`);
    else if (result.status === 'CONNECTED') toast.success(`${provider.name} is connected`, { description: result.detail });
    else toast.error(`${provider.name} isn’t working`, { description: result.detail });
  };

  const connected = providers.filter((p) => p.configured);

  const checkAll = async () => {
    const results = await runTests(connected);
    const failed = results.filter((r) => r.status !== 'CONNECTED').length;
    if (failed > 0 || results.length < connected.length) {
      toast.error(`${connected.length - results.length + failed} of ${connected.length} connections need attention`);
    } else {
      toast.success(`All ${connected.length} connections are working`);
    }
  };

  if (providersQuery.isLoading) return <LoadingState label="Loading model providers…" />;
  if (providersQuery.isError) {
    return (
      <ErrorState
        title="Couldn’t load model providers"
        description={errorText(providersQuery.error)}
        onRetry={() => void providersQuery.refetch()}
      />
    );
  }
  if (providers.length === 0) {
    return (
      <EmptyState
        icon={<Cpu />}
        title="No model providers available"
        description="This deployment doesn’t offer any model providers yet."
      />
    );
  }

  const working = providers.filter((p) => p.status === 'CONNECTED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">AI model providers</h3>
          <p className="text-xs text-muted-foreground">
            {working} of {providers.length} connected. Agents and workflows can use the models of any connected provider.
          </p>
        </div>
        {canManage && connected.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void checkAll()}
            disabled={testingIds.size > 0}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn('size-3.5', testingIds.size > 0 && 'animate-spin')} />
            {testingIds.size > 0 ? 'Checking…' : 'Check connections'}
          </Button>
        ) : null}
      </div>

      {membersQuery.isSuccess && !canManage ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You’re a {me?.role.toLowerCase() ?? 'member'} here, so you can see these connections but not change them.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            canManage={canManage}
            testing={testingIds.has(provider.id)}
            onManage={() => setSelectedId(provider.id)}
            onTest={() => void testOne(provider)}
          />
        ))}
      </div>

      <ProviderDialog
        key={selectedId ?? 'closed'}
        workspaceId={workspaceId}
        provider={selected}
        onClose={() => setSelectedId(null)}
        onChanged={refreshAll}
      />
    </div>
  );
}

interface ProviderCardProps {
  provider: AIProviderMetadata;
  canManage: boolean;
  testing: boolean;
  onManage: () => void;
  onTest: () => void;
}

function ProviderCard({ provider, canManage, testing, onManage, onTest }: ProviderCardProps) {
  const status = STATUS[provider.status] ?? STATUS.ERROR;
  const models = provider.models.filter((m) => m.enabled !== false && isChatModel(m));
  const failing = provider.status !== 'CONNECTED' && Boolean(provider.lastError);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised">
            <AIProviderIcon provider={provider.id} size={20} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{provider.name}</div>
            <div className="line-clamp-1 text-xs text-muted-foreground">{provider.description}</div>
          </div>
        </div>
        <Badge variant={status.variant} className="shrink-0 text-2xs">
          {status.label}
        </Badge>
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1">
        {models.slice(0, 3).map((m) => (
          <AIModelBadge key={m.id} modelId={m.model} provider={provider.id} variant="subtle" size="xs" />
        ))}
        {models.length > 3 ? <span className="text-2xs text-muted-foreground">+{models.length - 3} more</span> : null}
        {models.length === 0 ? <span className="text-2xs text-muted-foreground">No models turned on</span> : null}
      </div>

      {failing ? (
        <p className="mt-2 line-clamp-2 text-xs text-destructive" title={provider.lastError}>
          {provider.lastError}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <div className="min-w-0 text-2xs text-muted-foreground">
          <div className="truncate">{credentialLine(provider)}</div>
          {provider.lastTestedAt ? <div className="truncate">Checked {formatRelative(provider.lastTestedAt)}</div> : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            {provider.configured ? (
              <Button variant="ghost" size="xs" onClick={onTest} disabled={testing} className="gap-1 text-xs">
                <Zap className={cn('size-3.5', testing && 'animate-pulse')} />
                {testing ? 'Testing…' : 'Test'}
              </Button>
            ) : null}
            <Button variant="outline" size="xs" onClick={onManage} className="text-xs">
              {provider.configured ? 'Manage' : 'Connect'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface ProviderDialogProps {
  workspaceId: string;
  provider: AIProviderMetadata | null;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}

function ProviderDialog({ workspaceId, provider, onClose, onChanged }: ProviderDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel ?? '');
  const [failure, setFailure] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (verify: boolean) =>
      aiApi.saveCredential(workspaceId, provider!.id, {
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        baseUrl: baseUrl.trim(),
        defaultModel,
        verify,
      }),
    meta: QUIET,
    onSuccess: async (saved) => {
      await onChanged();
      if (saved.status === 'CONNECTED') toast.success(`${saved.name} is connected`);
      else toast.warning(`${saved.name} saved, but it isn’t working yet`);
      onClose();
    },
    onError: (err) => setFailure(errorText(err)),
  });

  const disconnect = useMutation({
    mutationFn: () => aiApi.deleteCredential(workspaceId, provider!.id),
    meta: QUIET,
    onSuccess: async () => {
      await onChanged();
      toast.success(`Removed the ${provider!.name} key`);
      onClose();
    },
    onError: (err) => setFailure(errorText(err)),
  });

  const toggleModel = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      aiApi.updateModelSetting(workspaceId, input.id, { enabled: input.enabled }),
    meta: QUIET,
    onSuccess: onChanged,
    onError: (err) => toast.error('Couldn’t update that model', { description: errorText(err) }),
  });

  const requirements = provider?.credentialRequirements ?? [];
  const keyField = requirements.find((r) => r.name === 'apiKey');
  const urlField = requirements.find((r) => r.name === 'baseUrl');
  const chatModels = provider?.models.filter(isChatModel) ?? [];
  const hasOwnKey = provider?.credentialSource === 'workspace';
  // A required key can only be skipped when one is already in place.
  const needsKey = Boolean(keyField?.required) && !provider?.configured && !apiKey.trim();
  const busy = save.isPending || disconnect.isPending;

  const removeKey = async () => {
    if (!provider) return;
    const ok = await confirm({
      title: `Remove the ${provider.name} key?`,
      description: 'Agents using its models stop working unless a platform key covers them. The saved key is deleted.',
      confirmLabel: 'Remove key',
      destructive: true,
    });
    if (ok) disconnect.mutate();
  };

  return (
    <Dialog open={provider !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {provider ? <AIProviderIcon provider={provider.id} size={20} /> : null}
            <span>{provider?.configured ? `Manage ${provider.name}` : `Connect ${provider?.name ?? ''}`}</span>
          </DialogTitle>
          <DialogDescription>
            {keyField ? 'We check the connection with the provider before saving.' : provider?.description}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {keyField ? (
            <Field
              label={keyField.label}
              required={keyField.required && !provider?.configured}
              hint={
                hasOwnKey
                  ? `Current key ${provider?.maskedKey ?? ''}. Leave blank to keep it.`
                  : provider?.credentialSource === 'environment'
                    ? 'Using the platform key. Add your own to bill this workspace directly.'
                    : keyField.description
              }
            >
              <Input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                placeholder={keyField.placeholder}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setFailure(null);
                }}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                }
              />
            </Field>
          ) : null}

          {chatModels.length > 0 ? (
            <Field label="Default model" hint="Used when an agent or request doesn’t name a model.">
              <AppSelect
                value={defaultModel}
                onValueChange={(value) => {
                  setDefaultModel(value);
                  setFailure(null);
                }}
                options={chatModels.map((m) => ({ value: m.model, label: m.name }))}
                aria-label="Default model"
              />
            </Field>
          ) : null}

          {urlField ? (
            <Field label={urlField.label} optional hint={urlField.description ?? 'Leave blank to use the provider’s own endpoint.'}>
              <Input
                type="url"
                placeholder={urlField.placeholder}
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setFailure(null);
                }}
              />
            </Field>
          ) : null}

          {provider?.configured && chatModels.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground">Models available to this workspace</div>
              <div className="divide-y divide-border rounded-lg border border-border">
                {chatModels.map((m) => (
                  <label key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-foreground">
                    <span className="min-w-0 truncate">{m.name}</span>
                    <Switch
                      checked={m.enabled !== false}
                      disabled={toggleModel.isPending}
                      onCheckedChange={(enabled) => toggleModel.mutate({ id: m.id, enabled })}
                      aria-label={`Use ${m.name} in this workspace`}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {failure ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
              {failure}
            </p>
          ) : null}

          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Lock className="size-3 shrink-0" />
            Keys are encrypted at rest and can’t be read back.
          </p>
        </DialogBody>

        <DialogFooter className="gap-2">
          {hasOwnKey ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void removeKey()}
              disabled={busy}
              className="mr-auto text-destructive hover:bg-destructive/10"
            >
              Remove key
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {failure ? (
            <Button variant="outline" size="sm" onClick={() => save.mutate(false)} disabled={busy || needsKey}>
              Save anyway
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => {
              setFailure(null);
              save.mutate(true);
            }}
            disabled={busy || needsKey}
          >
            {save.isPending ? 'Checking…' : provider?.configured ? 'Save changes' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
