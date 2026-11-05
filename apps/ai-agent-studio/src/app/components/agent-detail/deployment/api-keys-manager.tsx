import { agentApiKeysApi } from '@org/api-client';
import {
  AGENT_API_KEY_SCOPES,
  WorkspacePermission,
  type AgentApiKeyCreated,
  type AgentApiKeyScope,
  type AgentApiKeyView,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
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
  Label,
  LoadingState,
  toast,
} from '@org/ui';
import { useWorkspacePermission } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ApiKeyQuickstart } from './api-key-quickstart.js';
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

const SCOPES: Record<AgentApiKeyScope, { label: string; hint: string }> = {
  'agent:execute': {
    label: 'Run agents',
    hint: 'Start agent runs and cancel them',
  },
  'agent:read': { label: 'Read runs', hint: 'Check the status of a run' },
};

/** How close to its expiry a working key starts to warn. */
const EXPIRY_WARNING_MS = 14 * 86_400_000;

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : null;

const expiresSoon = (k: AgentApiKeyView) =>
  k.status === 'active' &&
  !!k.expiresAt &&
  new Date(k.expiresAt).getTime() - Date.now() < EXPIRY_WARNING_MS;

function KeyRow({
  apiKey: k,
  canManage,
  revoking,
  onRevoke,
}: {
  apiKey: AgentApiKeyView;
  canManage: boolean;
  revoking: boolean;
  onRevoke: () => void;
}) {
  return (
    <Card className="gap-3 p-4 shadow-2xs flex-row flex-wrap items-center justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="gap-2 flex flex-wrap items-center">
          <span className="text-xs font-bold text-foreground">{k.name}</span>
          <code className="px-2 py-0.5 text-xs font-bold rounded-md bg-brand/10 font-mono text-brand-text">
            {k.keyPrefix}••••••••
          </code>
          {k.status === 'expired' ? (
            <Badge variant="outline" className="text-2xs">
              Expired
            </Badge>
          ) : null}
          {k.status === 'revoked' ? (
            <Badge variant="outline" className="text-2xs">
              Revoked
            </Badge>
          ) : null}
          {expiresSoon(k) ? (
            <Badge variant="warning" className="text-2xs">
              Expires soon
            </Badge>
          ) : null}
        </div>
        <div className="gap-1 flex flex-wrap">
          {k.scopes.map((scope) => (
            <Badge key={scope} variant="neutral" className="text-2xs">
              {SCOPES[scope as AgentApiKeyScope]?.label ?? scope}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Created {when(k.createdAt)}
          {k.expiresAt ? ` · expires ${when(k.expiresAt)}` : ''}
          {' · '}
          {k.lastUsedAt
            ? `last used ${new Date(k.lastUsedAt).toLocaleString()}`
            : 'never used'}
        </div>
      </div>
      {canManage && k.status === 'active' ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          loading={revoking}
          className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Revoke
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * The workspace's agent API keys: create, see what exists, revoke. The key
 * itself is shown exactly once, in the response to creating it.
 */
export function ApiKeysManager({
  workspaceId,
  agentId,
  title = 'API keys',
  description,
}: {
  workspaceId: string;
  /** Starts the usage example on this agent. */
  agentId?: string;
  title?: string;
  description?: string;
}) {
  const queryClient = useQueryClient();
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_SETTINGS);
  const key = ['agent-api-keys', workspaceId] as const;

  const keysQuery = useQuery({
    queryKey: key,
    queryFn: () => agentApiKeysApi.list(workspaceId),
    enabled: !!workspaceId,
  });
  const keys = keysQuery.data ?? [];
  const activeKeys = keys.filter((k) => k.status === 'active');
  const inactiveKeys = keys.filter((k) => k.status !== 'active');

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [scopes, setScopes] = useState<AgentApiKeyScope[]>([
    ...AGENT_API_KEY_SCOPES,
  ]);
  const [created, setCreated] = useState<AgentApiKeyCreated | null>(null);

  const create = useMutation({
    meta: QUIET,
    mutationFn: () =>
      agentApiKeysApi.create(workspaceId, {
        name: name.trim(),
        scopes,
        expiresInDays: expiry === 'never' ? undefined : Number(expiry),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: key });
      setCreated(result);
      setOpen(false);
      setName('');
      setExpiry('never');
      setScopes([...AGENT_API_KEY_SCOPES]);
    },
    onError: (e) =>
      toast.error('Could not create the key', { description: errorMessage(e) }),
  });

  const revoke = useMutation({
    meta: QUIET,
    mutationFn: (id: string) => agentApiKeysApi.revoke(workspaceId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success('Key revoked: anything using it is refused from now on');
    },
    onError: (e) =>
      toast.error('Could not revoke the key', { description: errorMessage(e) }),
  });

  const confirmRevoke = async (k: AgentApiKeyView) => {
    const ok = await confirm({
      title: `Revoke “${k.name}”?`,
      description:
        'Every system using this key is refused immediately. This can’t be undone; create a new key to replace it.',
      confirmLabel: 'Revoke key',
      destructive: true,
    });
    if (ok) revoke.mutate(k.id);
  };

  return (
    <div className="space-y-5">
      <div className="gap-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {description ??
              'Private keys for server-to-server calls to deployed agents. They belong to the workspace and work for any of its deployed agents.'}
          </p>
        </div>
        {canManage ? (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Create key
          </Button>
        ) : null}
      </div>

      {created ? (
        <div
          className="space-y-2 p-4 rounded-xl border border-success/40 bg-success/10"
          role="status"
        >
          <div className="gap-1.5 text-xs font-bold flex items-center text-success">
            <CheckCircle2 className="size-4" /> “{created.name}” is ready
          </div>
          <p className="text-xs text-foreground">
            Copy it now. It can’t be shown again; only its first characters are
            kept to identify it.
          </p>
          <div className="gap-2 flex items-center">
            <Input
              value={created.apiKey}
              readOnly
              aria-label="New API key"
              className="text-xs bg-card font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <CopyButton
              text={created.apiKey}
              label="Copy key"
              className="text-xs shrink-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreated(null)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}

      <div className="gap-5 xl:grid-cols-2 grid items-start">
        <div className="min-w-0 space-y-3">
          {keysQuery.isLoading ? (
            <LoadingState label="Loading keys…" />
          ) : keysQuery.isError ? (
            <ErrorState
              title="Couldn’t load API keys"
              description={errorMessage(keysQuery.error)}
              onRetry={() => void keysQuery.refetch()}
            />
          ) : activeKeys.length === 0 ? (
            <Card className="shadow-2xs">
              <EmptyState
                size="sm"
                hideGraphic
                icon={<KeyRound />}
                title={keys.length === 0 ? 'No API keys yet' : 'No active keys'}
                description={
                  canManage
                    ? 'Create a key to run this workspace’s deployed agents from your own backend, CI or scheduled jobs.'
                    : 'Ask a workspace admin to create a key.'
                }
                action={
                  canManage ? (
                    <Button
                      size="sm"
                      onClick={() => setOpen(true)}
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" /> Create a key
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <ul className="space-y-2">
              {activeKeys.map((k) => (
                <li key={k.id}>
                  <KeyRow
                    apiKey={k}
                    canManage={canManage}
                    revoking={revoke.isPending && revoke.variables === k.id}
                    onRevoke={() => void confirmRevoke(k)}
                  />
                </li>
              ))}
            </ul>
          )}

          {inactiveKeys.length > 0 ? (
            <Collapsible>
              <CollapsibleTrigger className="group gap-1 text-xs font-semibold flex items-center text-muted-foreground hover:text-foreground">
                <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
                Revoked and expired ({inactiveKeys.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-2 space-y-2">
                  {inactiveKeys.map((k) => (
                    <li key={k.id}>
                      <KeyRow
                        apiKey={k}
                        canManage={false}
                        revoking={false}
                        onRevoke={() => undefined}
                      />
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>

        <ApiKeyQuickstart
          workspaceId={workspaceId}
          agentId={agentId}
          apiKey={created?.apiKey}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && scopes.length > 0) create.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="gap-2 flex items-center">
                <KeyRound className="size-5 text-primary" /> Create an API key
              </DialogTitle>
              <DialogDescription className="text-xs">
                Name it after what will use it, so you know what to rotate if it
                leaks.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4 text-xs">
              <Field label="Name" required>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nightly report job"
                />
              </Field>
              <Field label="Expiry">
                <AppSelect
                  value={expiry}
                  onValueChange={setExpiry}
                  options={EXPIRY_OPTIONS}
                />
              </Field>
              <Field label="Permissions" required>
                <div className="space-y-2">
                  {AGENT_API_KEY_SCOPES.map((scope) => (
                    <Label
                      key={scope}
                      className="gap-2.5 p-2 font-normal flex cursor-pointer items-start rounded-lg border border-border/60"
                    >
                      <Checkbox
                        checked={scopes.includes(scope)}
                        onCheckedChange={(c) =>
                          setScopes((cur) =>
                            c === true
                              ? [...cur, scope]
                              : cur.filter((x) => x !== scope),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <span className="text-xs font-semibold block text-foreground">
                          {SCOPES[scope].label}
                        </span>
                        <span className="text-xs block text-muted-foreground">
                          {SCOPES[scope].hint}
                        </span>
                      </span>
                    </Label>
                  ))}
                </div>
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={create.isPending}
                disabled={!name.trim() || scopes.length === 0}
                className="font-semibold"
              >
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
