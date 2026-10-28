import { useQuery } from '@tanstack/react-query';
import { memberApi, queryKeys } from '@org/api-client';
import type { AgentInstallScope, MarketplaceInstallation } from '@org/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AppSelect,
  Badge,
  Button,
  Card,
  Checkbox,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Switch,
  toast,
} from '@org/ui';
import {
  Activity,
  AlertTriangle,
  ArrowUpCircle,
  Lock,
  MessageSquare,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorAlert } from './AgentInstallDialog';
import { EntityIcon, MARKETPLACE_GRID_CLASS } from './marketplace-ui';
import {
  toAgentInstallError,
  useAgentInstallMutations,
  useAgentInstallPreview,
  useAgentInstalls,
  type AgentInstallError,
} from './use-agent-install';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'neutral' | 'warning' | 'destructive' | 'info' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  DISABLED: { label: 'Disabled', variant: 'neutral' },
  INSTALLING: { label: 'Installing…', variant: 'info' },
  UPDATING: { label: 'Updating…', variant: 'info' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  PENDING_APPROVAL: { label: 'Awaiting approval', variant: 'warning' },
};

const SCOPE_LABEL: Record<string, string> = {
  WORKSPACE: 'Workspace',
  PERSONAL: 'Personal',
  ADMIN_MANAGED: 'Admin managed',
};

interface AgentInstallsSectionProps {
  workspace: { id: string; slug: string };
  currentUserId?: string;
  /** Presentation only — the API re-checks every action. */
  canManage: boolean;
  onOpenChat: (agentId: string) => void;
  /** Reopens the install dialog for a failed install. */
  onRetry: (installation: MarketplaceInstallation) => void;
  onBrowse: () => void;
}

/** Installed agents with their full lifecycle: update, disable, access, health, uninstall. */
export function AgentInstallsSection({ workspace, currentUserId, canManage, onOpenChat, onRetry, onBrowse }: AgentInstallsSectionProps) {
  const installs = useAgentInstalls(workspace.id);
  const m = useAgentInstallMutations(workspace.id);
  const [updating, setUpdating] = useState<MarketplaceInstallation | null>(null);
  const [accessFor, setAccessFor] = useState<MarketplaceInstallation | null>(null);

  const rows = (installs.data ?? []).filter((i) => i.status !== 'PENDING_APPROVAL');

  const uninstall = async (i: MarketplaceInstallation, purge: boolean) => {
    const name = i.listing.name;
    const ok = await confirm(
      purge
        ? {
            title: `Remove ${name} completely?`,
            description: 'This permanently deletes the agent, its conversations and any credentials stored for it. It cannot be undone.',
            confirmLabel: 'Delete everything',
            destructive: true,
            requireText: name,
          }
        : {
            title: `Uninstall ${name}?`,
            description: 'It stops working right away. Its conversations and settings are kept, so installing it again restores them.',
            confirmLabel: 'Uninstall',
            destructive: true,
          },
    );
    if (ok) m.uninstall.mutate({ slug: i.listing.slug, purge });
  };

  const checkHealth = async (i: MarketplaceInstallation) => {
    try {
      const h = await m.checkHealth.mutateAsync(i.listing.slug);
      if (h.ok) toast.success('All health checks passed');
      else toast.error(`Health check failed: ${h.checks.find((c) => !c.ok)?.name ?? 'unknown'}`);
    } catch {
      /* surfaced by the mutation's onError toast */
    }
  };

  if (installs.isLoading) {
    return (
      <div className={MARKETPLACE_GRID_CLASS} aria-label="Loading installed agents" role="status">
        {[0, 1].map((k) => (
          <Skeleton key={k} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (installs.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>Could not load installed agents</AlertTitle>
        <AlertDescription>
          {toAgentInstallError(installs.error).message}{' '}
          <button type="button" className="underline" onClick={() => installs.refetch()}>
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No installed agents"
        description="Install an agent from the directory or publish one from AI Agent Studio."
        action={
          <Button variant="primary" size="sm" onClick={onBrowse}>
            Browse agents
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className={MARKETPLACE_GRID_CLASS}>
        {rows.map((i) => {
          const status = STATUS_BADGE[i.status] ?? { label: i.status, variant: 'neutral' as const };
          const busy = i.status === 'INSTALLING' || i.status === 'UPDATING';
          const canAct = canManage || (i.scope === 'PERSONAL' && !!currentUserId && i.installedById === currentUserId);
          const toggleable = i.status === 'ACTIVE' || i.status === 'DISABLED';
          return (
            <Card key={i.id} className="p-4 gap-3 justify-between" aria-busy={busy}>
              <div>
                <div className="gap-3 flex items-start justify-between">
                  <div className="min-w-0 gap-3 flex items-center">
                    <EntityIcon iconUrl={i.listing.iconUrl} kind="AGENT" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate text-foreground">{i.listing.name}</h4>
                      <div className="mt-0.5 gap-1.5 flex flex-wrap items-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Badge variant="neutral" className="font-mono">v{i.version}</Badge>
                        <Badge variant="neutral">{SCOPE_LABEL[i.scope ?? 'WORKSPACE']}</Badge>
                      </div>
                    </div>
                  </div>
                  {toggleable && canAct && (
                    <Switch
                      checked={i.status === 'ACTIVE'}
                      disabled={m.setEnabled.isPending}
                      onCheckedChange={(enabled) => m.setEnabled.mutate({ slug: i.listing.slug, enabled })}
                      aria-label={`${i.status === 'ACTIVE' ? 'Disable' : 'Enable'} ${i.listing.name}`}
                    />
                  )}
                </div>

                {i.status === 'FAILED' && i.lastError && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle aria-hidden />
                    <AlertDescription>{i.lastError}</AlertDescription>
                  </Alert>
                )}
                {i.status === 'ACTIVE' && i.lastError && (
                  <p className="mt-3 text-xs text-warning-text">Last update failed and was rolled back: {i.lastError}</p>
                )}
                {i.health?.checks && !i.health.ok && i.status !== 'FAILED' && (
                  <p className="mt-3 text-xs text-warning-text">
                    Health check failing: {i.health.checks.find((c) => !c.ok)?.name ?? 'unknown check'}
                  </p>
                )}
                {i.updateAvailable && canAct && toggleable && (
                  <button
                    type="button"
                    onClick={() => setUpdating(i)}
                    className="mt-3 gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-xs font-medium flex w-full items-center text-primary-text hover:bg-primary/10"
                  >
                    <ArrowUpCircle className="size-4" aria-hidden />
                    Update available: v{i.version} → v{i.latestVersion}
                  </button>
                )}
              </div>

              <div className="gap-1.5 pt-3 flex flex-wrap items-center border-t border-border/60">
                {i.status === 'ACTIVE' && i.agentId && (
                  <Button variant="primary" size="xs" onClick={() => onOpenChat(i.agentId as string)}>
                    <MessageSquare aria-hidden />
                    Open chat
                  </Button>
                )}
                {i.status === 'FAILED' && canAct && (
                  <Button variant="primary" size="xs" onClick={() => onRetry(i)}>
                    Retry install
                  </Button>
                )}
                {toggleable && canAct && (
                  <Button variant="outline" size="xs" onClick={() => checkHealth(i)} loading={m.checkHealth.isPending && m.checkHealth.variables === i.listing.slug}>
                    <Activity aria-hidden />
                    Health
                  </Button>
                )}
                {canManage && toggleable && (
                  <Button variant="outline" size="xs" onClick={() => setAccessFor(i)}>
                    <Users aria-hidden />
                    Access
                  </Button>
                )}
                {canAct && !busy && (
                  <>
                    <Button variant="ghost" size="xs" className="ml-auto hover:text-destructive-text" onClick={() => uninstall(i, false)}>
                      <Trash2 aria-hidden />
                      Uninstall
                    </Button>
                    <Button variant="ghost" size="xs" className="hover:text-destructive-text" onClick={() => uninstall(i, true)}>
                      Remove all data
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {updating && <UpdateDialog workspaceId={workspace.id} installation={updating} onClose={() => setUpdating(null)} />}
      {accessFor && <AccessDialog workspaceId={workspace.id} installation={accessFor} onClose={() => setAccessFor(null)} />}
    </>
  );
}

/** Shows exactly what an update changes — new permissions need a fresh approval. */
function UpdateDialog({ workspaceId, installation, onClose }: { workspaceId: string; installation: MarketplaceInstallation; onClose: () => void }) {
  const slug = installation.listing.slug;
  const preview = useAgentInstallPreview(workspaceId, slug);
  const { update } = useAgentInstallMutations(workspaceId);
  const [approved, setApproved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<AgentInstallError | null>(null);

  const added = preview.data?.newPermissions ?? [];
  const existingSecrets = ((installation.settings?.['_secretRefs'] ?? {}) as Record<string, string>);
  const newFields = (preview.data?.configFields ?? []).filter(
    (f) => f.required && (f.type === 'secret' ? !existingSecrets[f.key] : installation.settings?.[f.key] === undefined),
  );
  const ready = added.length === 0 || approved;

  const apply = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        slug,
        input: { approvedPermissions: approved ? added.map((p) => p.id) : [], settings: values },
      });
      onClose();
    } catch (err) {
      setError(toAgentInstallError(err));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update {installation.listing.name}</DialogTitle>
          <DialogDescription>
            v{installation.version} → v{installation.latestVersion}. Your settings and conversations are kept; if the update fails it is rolled back automatically.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {preview.isLoading && <Skeleton className="h-20 w-full" />}
          {error && <ErrorAlert error={error} />}
          {added.length === 0 && preview.data && <p className="text-xs text-muted-foreground">This version asks for no new permissions.</p>}
          {added.length > 0 && (
            <>
              <Alert>
                <Lock aria-hidden />
                <AlertTitle>New permissions</AlertTitle>
                <AlertDescription>This version asks for access it didn’t have before. It stays on v{installation.version} until you approve.</AlertDescription>
              </Alert>
              <ul className="space-y-1.5">
                {added.map((p) => (
                  <li key={p.id} className="gap-2 text-xs flex items-center">
                    <Badge variant={p.sensitive ? 'warning' : 'neutral'}>{p.sensitive ? 'Sensitive' : 'New'}</Badge>
                    <span className="text-foreground">{p.label}</span>
                  </li>
                ))}
              </ul>
              <label className="gap-2.5 text-xs flex cursor-pointer items-center">
                <Checkbox checked={approved} onCheckedChange={(c) => setApproved(c === true)} aria-label="Approve new permissions" />
                I approve these permissions
              </label>
            </>
          )}
          {newFields.map((f) => (
            <Field key={f.key} label={f.label} required hint={f.description} error={error?.fields?.[f.key]}>
              <Input type={f.type === 'secret' ? 'password' : 'text'} autoComplete="off" value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            </Field>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button variant="primary" onClick={apply} disabled={!ready || preview.isLoading} loading={update.isPending}>
            Update to v{installation.latestVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

/** Who may use the installed agent: scope, roles and named people. */
function AccessDialog({ workspaceId, installation, onClose }: { workspaceId: string; installation: MarketplaceInstallation; onClose: () => void }) {
  const { updateAccess } = useAgentInstallMutations(workspaceId);
  const members = useQuery({
    queryKey: queryKeys.members.list(workspaceId),
    queryFn: () => memberApi.list(workspaceId),
    staleTime: 60_000,
  });
  const [scope, setScope] = useState<AgentInstallScope>(installation.scope ?? 'WORKSPACE');
  const [restricted, setRestricted] = useState(installation.access?.mode === 'RESTRICTED');
  const [roles, setRoles] = useState<string[]>(installation.access?.roles ?? []);
  const [userIds, setUserIds] = useState<string[]>(installation.access?.userIds ?? []);
  const [error, setError] = useState<AgentInstallError | null>(null);

  useEffect(() => {
    if (scope === 'PERSONAL') setRestricted(true);
  }, [scope]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const save = async () => {
    setError(null);
    try {
      await updateAccess.mutateAsync({
        slug: installation.listing.slug,
        input: { scope, access: { mode: scope === 'WORKSPACE' && !restricted ? 'EVERYONE' : 'RESTRICTED', roles, userIds } },
      });
      onClose();
    } catch (err) {
      setError(toAgentInstallError(err));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Who can use {installation.listing.name}</DialogTitle>
          <DialogDescription>Enforced on the server every time the agent runs. Admins always have access.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <ErrorAlert error={error} />}
          <Field label="Scope">
            <AppSelect
              value={scope}
              onValueChange={(v) => setScope(v as AgentInstallScope)}
              options={[
                { value: 'WORKSPACE', label: 'Workspace-wide' },
                { value: 'ADMIN_MANAGED', label: 'Administrator-managed' },
                { value: 'PERSONAL', label: 'Personal (installer only)' },
              ]}
            />
          </Field>
          {scope !== 'PERSONAL' && (
            <div className="gap-3 rounded-xl border border-border/60 p-3 flex items-center justify-between">
              <span className="text-xs">
                <span className="block font-semibold text-foreground">Limit to specific people</span>
                <span className="text-muted-foreground">Off means every member can use it.</span>
              </span>
              <Switch checked={restricted} onCheckedChange={setRestricted} aria-label="Limit to specific people" />
            </div>
          )}
          {scope !== 'PERSONAL' && restricted && (
            <>
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-xs font-semibold text-foreground">Roles</legend>
                {ROLES.map((r) => (
                  <label key={r} className="gap-2 text-xs flex items-center">
                    <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggle(roles, setRoles, r)} aria-label={r} />
                    {r.charAt(0) + r.slice(1).toLowerCase()}s
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-xs font-semibold text-foreground">People</legend>
                {members.isLoading && <Skeleton className="h-8 w-full" />}
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {(members.data ?? []).map((mem) => (
                    <label key={mem.user.id} className="gap-2 text-xs flex items-center">
                      <Checkbox checked={userIds.includes(mem.user.id)} onCheckedChange={() => toggle(userIds, setUserIds, mem.user.id)} aria-label={mem.user.name} />
                      {mem.user.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={updateAccess.isPending}>Save access</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
