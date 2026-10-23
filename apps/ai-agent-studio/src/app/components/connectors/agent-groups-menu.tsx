import {
  AppSelect,
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
  toast,
} from '@org/ui';
import { Layers, Save } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '../../router.js';
import {
  applyGroupToAgent,
  errorMessage,
  groupMembersFromAgent,
  saveConnectorGroup,
  useConnectorGroups,
  useConnectors,
  useInvalidateConnectorGroups,
  type AgentWithApps,
  type GroupApplyResult,
} from '../../services/connectors.js';
import { useStudioSession } from '../../session-guard.js';

/**
 * Two shortcuts on an agent's Apps tab: give it a whole connector group, or
 * keep the apps it has now as a group to reuse on other agents.
 */
export function AgentGroupsMenu({ agent, onChanged }: { agent: AgentWithApps; onChanged: () => void }) {
  const [mode, setMode] = useState<'use' | 'save' | null>(null);
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setMode('use')} leadingIcon={<Layers />}>
          Use a group
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode('save')} leadingIcon={<Save />}>
          Save as group
        </Button>
      </div>
      {mode === 'use' && <UseGroupDialog agent={agent} onClose={() => setMode(null)} onChanged={onChanged} />}
      {mode === 'save' && <SaveGroupDialog agent={agent} onClose={() => setMode(null)} />}
    </>
  );
}

function UseGroupDialog({ agent, onClose, onChanged }: { agent: AgentWithApps; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const groups = useConnectorGroups();
  const connectors = useConnectors();
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<GroupApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const group = (groups.data ?? []).find((g) => g.id === groupId);
  const apply = async () => {
    if (!group || !activeWorkspace) return;
    setBusy(true);
    setError(null);
    try {
      const result = await applyGroupToAgent(activeWorkspace.id, agent, group, connectors.data ?? []);
      setOutcome(result);
      if (result.applied.length) {
        toast.success(`${agent.name} can now use ${result.applied.join(', ')}.`);
        onChanged();
      }
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t apply the group.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Use a connector group</DialogTitle>
          <DialogDescription>{agent.name} gets each switched-on app in the group, limited to the actions the group allows.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {groups.isSuccess && (groups.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              There are no groups yet.{' '}
              <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => navigate('/connectors/groups')}>
                Create one
              </button>
              , or save this agent’s apps as a group.
            </p>
          ) : (
            <AppSelect
              value={groupId}
              onValueChange={setGroupId}
              placeholder={groups.isLoading ? 'Loading groups…' : 'Choose a group'}
              options={(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.members.length} app${g.members.length === 1 ? '' : 's'}` }))}
            />
          )}
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
            <Button size="sm" onClick={apply} loading={busy} disabled={!group}>
              Add apps
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveGroupDialog({ agent, onClose }: { agent: AgentWithApps; onClose: () => void }) {
  const { activeWorkspace } = useStudioSession();
  const connectors = useConnectors();
  const invalidate = useInvalidateConnectorGroups();
  const [name, setName] = useState(`${agent.name} apps`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const members = groupMembersFromAgent(agent, connectors.data ?? []);

  const save = async () => {
    if (!activeWorkspace) return;
    setBusy(true);
    setError(null);
    try {
      await saveConnectorGroup(activeWorkspace.id, { name, members });
      toast.success('Saved as a group.');
      void invalidate();
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t save the group.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as a group</DialogTitle>
          <DialogDescription>Keep this agent’s apps, actions and “ask first” choices to give to other agents.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">This agent has no apps yet, so there is nothing to save.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="save-group-name" className="text-xs font-medium text-foreground">
                  Group name
                </Label>
                <Input id="save-group-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {members.length} app{members.length === 1 ? '' : 's'}: {members.map((m) => connectors.data?.find((c) => c.provider === m.provider)?.name ?? m.provider).join(', ')}
              </p>
            </>
          )}
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
          <Button size="sm" onClick={save} loading={busy} disabled={members.length === 0 || !name.trim()}>
            Save group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
