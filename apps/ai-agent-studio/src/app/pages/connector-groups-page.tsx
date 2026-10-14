import { agentsApi, connectorsApi } from '@org/api-client';
import type { ConnectorGroup, ConnectorGroupMember } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Switch,
  Textarea,
  confirm,
  toast,
} from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Layers, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppConnectorIcon } from '../components/common/app-connector-icon.jsx';
import {
  applyGroupToAgent,
  errorMessage,
  saveConnectorGroup,
  useConnectorGroups,
  useConnectors,
  useInvalidateConnectorGroups,
  type AgentWithApps,
  type ConnectorSummary,
} from '../services/connectors.js';
import { useStudioSession } from '../session-guard.js';

/**
 * Connector groups: a named set of apps, with the actions switched on for
 * each, that can be handed to an agent in one step and reused as a template.
 * A group holds no credentials — an agent still acts through connections its
 * owner may use.
 */
export function ConnectorGroupsPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const groups = useConnectorGroups();
  const connectors = useConnectors();
  const invalidate = useInvalidateConnectorGroups();
  const [editing, setEditing] = useState<ConnectorGroup | 'new' | null>(null);
  const [giving, setGiving] = useState<ConnectorGroup | null>(null);

  const bySlug = useMemo(() => new Map((connectors.data ?? []).map((c) => [c.provider, c])), [connectors.data]);

  const duplicate = async (group: ConnectorGroup) => {
    if (!activeWorkspace) return;
    try {
      await connectorsApi.groups.duplicate(activeWorkspace.id, group.id);
      toast.success(`Made your own copy of “${group.name}”.`);
      void invalidate();
    } catch (error) {
      toast.error(errorMessage(error, 'Couldn’t copy the group.'));
    }
  };

  const remove = async (group: ConnectorGroup) => {
    if (!activeWorkspace) return;
    const ok = await confirm({
      title: `Delete “${group.name}”?`,
      description: 'Agents that already received these apps keep them. Only the group is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await connectorsApi.groups.remove(activeWorkspace.id, group.id);
      toast.success('Group deleted.');
      void invalidate();
    } catch (error) {
      toast.error(errorMessage(error, 'Couldn’t delete the group.'));
    }
  };

  return (
    <Page>
      <PageHeader
        title="Connector groups"
        description="Give one agent several apps at once. Pick the apps and the actions each may use, then reuse the set for other agents."
        icon={<Layers />}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/connectors')} leadingIcon={<ArrowLeft />}>
              Connectors
            </Button>
            <Button size="sm" onClick={() => setEditing('new')} leadingIcon={<Plus />} disabled={!connectors.data}>
              New group
            </Button>
          </div>
        }
      />

      {groups.isLoading || connectors.isLoading ? (
        <LoadingState label="Loading groups…" />
      ) : groups.isError ? (
        <ErrorState title="Couldn’t load groups" description={errorMessage(groups.error, '')} onRetry={() => groups.refetch()} />
      ) : (groups.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No groups yet"
          description="A group might be “Store operations”: Shopify to read orders, Slack to tell the team, WhatsApp to message customers."
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              Create a group
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(groups.data ?? []).map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              connectors={bySlug}
              onEdit={() => setEditing(group)}
              onGive={() => setGiving(group)}
              onDuplicate={() => void duplicate(group)}
              onDelete={() => void remove(group)}
            />
          ))}
        </div>
      )}

      {editing && (
        <GroupEditor
          group={editing === 'new' ? null : editing}
          connectors={connectors.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void invalidate();
          }}
        />
      )}
      {giving && <GiveToAgentDialog group={giving} connectors={connectors.data ?? []} onClose={() => setGiving(null)} />}
    </Page>
  );
}

function enabledActionCount(member: ConnectorGroupMember, connector: ConnectorSummary | undefined): number {
  if (!member.enabled || !connector) return 0;
  return member.actions === null ? connector.capabilities.length : member.actions.length;
}

function GroupCard({
  group,
  connectors,
  onEdit,
  onGive,
  onDuplicate,
  onDelete,
}: {
  group: ConnectorGroup;
  connectors: Map<string, ConnectorSummary>;
  onEdit: () => void;
  onGive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const actions = group.members.reduce((n, m) => n + enabledActionCount(m, connectors.get(m.provider)), 0);
  return (
    <Card className="flex flex-col justify-between gap-4 p-5">
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{group.name}</h3>
          {group.isTemplate && <Badge variant="outline">Template</Badge>}
        </div>
        {group.description && <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{group.description}</p>}
        <ul className="space-y-1.5" aria-label="Apps in this group">
          {group.members.map((m) => {
            const connector = connectors.get(m.provider);
            return (
              <li key={m.provider} className="flex items-center gap-2 text-xs">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised">
                  <AppConnectorIcon connectorId={connector?.slug ?? m.provider.toLowerCase()} name={connector?.name ?? m.provider} category={connector?.category} size={14} />
                </span>
                <span className={m.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}>{connector?.name ?? m.provider}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {!m.enabled
                    ? 'off'
                    : m.actions === null
                      ? 'every action'
                      : `${m.actions.length} action${m.actions.length === 1 ? '' : 's'}`}
                  {m.askBefore?.length ? ` · ${m.askBefore.length} ask first` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          {group.members.length} app{group.members.length === 1 ? '' : 's'} · {actions} actions on
        </span>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="outline" onClick={onGive} leadingIcon={<Send />}>
            Give to an agent
          </Button>
          {group.mine ? (
            <>
              <Button size="icon-xs" variant="ghost" aria-label={`Edit ${group.name}`} onClick={onEdit}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label={`Delete ${group.name}`} onClick={onDelete}>
                <Trash2 className="size-3.5" />
              </Button>
            </>
          ) : (
            <Button size="icon-xs" variant="ghost" aria-label={`Copy ${group.name}`} title="Make your own copy" onClick={onDuplicate}>
              <Copy className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- editor -- */

function GroupEditor({
  group,
  connectors,
  onClose,
  onSaved,
}: {
  group: ConnectorGroup | null;
  connectors: ConnectorSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { activeWorkspace } = useStudioSession();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [isTemplate, setIsTemplate] = useState(group?.isTemplate ?? false);
  const [members, setMembers] = useState<ConnectorGroupMember[]>(group?.members ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usable = connectors.filter((c) => c.capabilities.length > 0 && c.status !== 'unavailable');
  const addable = usable.filter((c) => !members.some((m) => m.provider === c.provider));
  const patch = (provider: string, next: Partial<ConnectorGroupMember>) =>
    setMembers((all) => all.map((m) => (m.provider === provider ? { ...m, ...next } : m)));

  const save = async () => {
    if (!activeWorkspace) return;
    setSaving(true);
    setError(null);
    try {
      await saveConnectorGroup(activeWorkspace.id, { name, description: description || null, isTemplate, members }, group?.id);
      toast.success(group ? 'Group saved.' : 'Group created.');
      onSaved();
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t save the group.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{group ? 'Edit group' : 'New connector group'}</DialogTitle>
          <DialogDescription>Choose the apps and which of their actions agents may use.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="group-name" className="text-xs font-medium text-foreground">
              Name
            </Label>
            <Input id="group-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Store operations" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="group-description" className="text-xs font-medium text-foreground">
              What it is for <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="group-description" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Label htmlFor="group-template" className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border bg-surface-raised/60 p-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">Share as a template</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Everyone in the workspace can see it and make their own copy. No connections or credentials are shared.
              </span>
            </span>
            <Switch id="group-template" checked={isTemplate} onCheckedChange={setIsTemplate} />
          </Label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Apps</span>
              <div className="w-56">
                <AppSelect
                  value=""
                  onValueChange={(provider) => setMembers((all) => [...all, { provider, integrationId: null, enabled: true, actions: null }])}
                  searchable
                  placeholder={addable.length ? 'Add an app…' : 'Every app is in the group'}
                  disabled={addable.length === 0}
                  options={addable.map((c) => ({ value: c.provider, label: c.status === 'connected' ? c.name : `${c.name} (not connected)` }))}
                />
              </div>
            </div>
            {members.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No apps yet. Add the first one above.</p>}
            {members.map((m) => {
              const connector = connectors.find((c) => c.provider === m.provider);
              return (
                <MemberRow
                  key={m.provider}
                  member={m}
                  connector={connector}
                  onChange={(next) => patch(m.provider, next)}
                  onRemove={() => setMembers((all) => all.filter((x) => x.provider !== m.provider))}
                />
              );
            })}
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-text">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!name.trim() || members.length === 0}>
            {group ? 'Save group' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  connector,
  onChange,
  onRemove,
}: {
  member: ConnectorGroupMember;
  connector: ConnectorSummary | undefined;
  onChange: (patch: Partial<ConnectorGroupMember>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const capabilities = connector?.capabilities ?? [];
  const on = (id: string) => member.actions === null || member.actions.includes(id);
  const toggleAction = (id: string, checked: boolean) => {
    const current = member.actions ?? capabilities.map((c) => c.id);
    const next = checked ? [...new Set([...current, id])] : current.filter((x) => x !== id);
    onChange({
      actions: next.length === capabilities.length ? null : next,
      askBefore: (member.askBefore ?? []).filter((x) => next.includes(x)),
    });
  };
  const toggleAsk = (id: string, checked: boolean) =>
    onChange({ askBefore: checked ? [...new Set([...(member.askBefore ?? []), id])] : (member.askBefore ?? []).filter((x) => x !== id) });
  const connections = (connector?.connections ?? []).filter((c) => c.status === 'CONNECTED');

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 p-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised">
          <AppConnectorIcon connectorId={connector?.slug ?? member.provider.toLowerCase()} name={connector?.name ?? member.provider} category={connector?.category} size={16} />
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="block truncate text-xs font-semibold text-foreground">{connector?.name ?? member.provider}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {member.actions === null ? 'Every action' : `${member.actions.length} of ${capabilities.length} actions`}
            {member.askBefore?.length ? ` · asks first on ${member.askBefore.length}` : ''}
            {connector && connector.status !== 'connected' ? ' · not connected yet' : ''}
          </span>
        </button>
        <Switch checked={member.enabled} onCheckedChange={(enabled) => onChange({ enabled })} aria-label={`Use ${connector?.name ?? member.provider}`} />
        <Button size="icon-xs" variant="ghost" aria-label={`Remove ${connector?.name ?? member.provider}`} onClick={onRemove}>
          <X className="size-3.5" />
        </Button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {connections.length > 1 && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-foreground">Connection</span>
              <AppSelect
                value={member.integrationId ?? ''}
                onValueChange={(id) => onChange({ integrationId: id || null })}
                placeholder="Whichever the agent’s owner has"
                options={connections.map((c) => ({ value: c.id, label: `${c.accountEmail ?? c.accountName ?? c.displayName ?? 'Account'}${c.mine ? ' (personal)' : ' (shared)'}` }))}
              />
            </div>
          )}
          <ul className="space-y-1.5">
            {capabilities.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <Checkbox id={`${member.provider}-${c.id}`} checked={on(c.id)} onCheckedChange={(v) => toggleAction(c.id, v === true)} />
                <label htmlFor={`${member.provider}-${c.id}`} className="min-w-0 flex-1 cursor-pointer truncate text-foreground">
                  {c.label}
                  {c.kind === 'action' && <span className="ml-1 text-[10px] text-muted-foreground">writes</span>}
                </label>
                {c.kind === 'action' && (
                  <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-muted-foreground">
                    <Checkbox
                      checked={member.askBefore?.includes(c.id) ?? false}
                      disabled={!on(c.id)}
                      onCheckedChange={(v) => toggleAsk(c.id, v === true)}
                      aria-label={`Ask a person before ${c.label}`}
                    />
                    Ask first
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- give to agent -- */

function GiveToAgentDialog({ group, connectors, onClose }: { group: ConnectorGroup; connectors: ConnectorSummary[]; onClose: () => void }) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace?.id;
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ applied: string[]; skipped: Array<{ provider: string; reason: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ['studio-agents', workspaceId],
    queryFn: () => agentsApi.list(workspaceId as string) as Promise<AgentWithApps[]>,
    enabled: !!workspaceId,
  });
  const options = (agents.data ?? []).filter((a) => a.type === 'agent').map((a) => ({ value: a.id, label: a.name }));

  const give = async () => {
    const agent = (agents.data ?? []).find((a) => a.id === agentId);
    if (!agent || !workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      // The list view may not carry the app links; read the agent itself.
      const full = (await agentsApi.get(workspaceId, agent.id)) as AgentWithApps;
      setOutcome(await applyGroupToAgent(workspaceId, full, group, connectors));
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t give the group to the agent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Give “{group.name}” to an agent</DialogTitle>
          <DialogDescription>
            The agent gets each switched-on app and only the actions you chose. Apps it already has are updated to match.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <AppSelect value={agentId} onValueChange={setAgentId} searchable placeholder={agents.isLoading ? 'Loading agents…' : 'Choose an agent'} options={options} />
          {outcome && (
            <div role="status" className="space-y-1.5 rounded-lg border border-border bg-surface-raised/60 p-3 text-xs">
              {outcome.applied.length > 0 && <p className="text-foreground">Added {outcome.applied.join(', ')}.</p>}
              {outcome.skipped.map((s) => (
                <p key={s.provider} className="text-warning-text">
                  {s.reason}
                </p>
              ))}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-text">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {outcome ? 'Done' : 'Cancel'}
          </Button>
          {!outcome && (
            <Button size="sm" onClick={give} loading={busy} disabled={!agentId}>
              Give apps
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
