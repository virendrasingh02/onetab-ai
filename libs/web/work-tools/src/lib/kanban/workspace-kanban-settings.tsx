import type { TaskLabel, Team } from '@org/types';
import {
  Button,
  confirm,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@org/ui';
import { Contact, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import {
  useCurrentWorkspace,
  useTaskLabelMutations,
  useTaskLabels,
  useTeamMutations,
  useTeams,
} from '../use-work-tools.js';
import { PriorityIcon } from './kanban-icons.js';
import { KANBAN_PRIORITIES, LABEL_COLORS } from './kanban-custom-store.js';
import { WorkflowStatusesSettings } from './workflow-statuses-settings.js';

/** The server's message for a rejected request, when it sent one. */
function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
}

/** A team key from its name: `Core Engineering` → `COREENG`. */
function keyFromName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

/**
 * The swatch row shared by the label dialog.
 *
 * Each swatch carries its colour as an accessible name — a colour-only button
 * otherwise reads as an unlabelled control to a screen reader.
 */
function ColorSwatchPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 block">{label}</label>
      <div role="group" aria-label={label} className="gap-2 flex items-center">
        {LABEL_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={`size-6 rounded-full border-2 transition-transform ${
              value === color
                ? 'scale-110 border-foreground'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-1 flex items-center justify-between">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {action}
    </div>
  );
}

/**
 * Settings → Tasks & Kanban.
 *
 * Statuses are the workspace workflow (`WorkflowStatusesSettings`): renamed,
 * recoloured and extended here for every board. Priorities are an enum on the
 * server, so they are shown with their menu shortcuts rather than edited. Labels are
 * the workspace's `TaskLabel` catalogue and teams are `Team` rows; both are
 * shared with every member and every device.
 */
export function WorkspaceKanbanSettings() {
  const { workspaceId } = useCurrentWorkspace();
  const labelsQuery = useTaskLabels(workspaceId);
  const labelMutations = useTaskLabelMutations(workspaceId);
  const teamsQuery = useTeams(workspaceId);
  const teamMutations = useTeamMutations(workspaceId);

  const labels = labelsQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  // Label dialog: `editing` is the label being changed, or null for a new one.
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<TaskLabel | null>(null);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState<string>(LABEL_COLORS[0]);

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamKey, setTeamKey] = useState('');
  const [teamKeyTouched, setTeamKeyTouched] = useState(false);

  const openLabelDialog = (label: TaskLabel | null) => {
    setEditingLabel(label);
    setLabelName(label?.name ?? '');
    setLabelColor(label?.color ?? LABEL_COLORS[0]);
    setLabelDialogOpen(true);
  };

  const handleSaveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = labelName.trim();
    if (!name) return;
    try {
      if (editingLabel) {
        await labelMutations.update.mutateAsync({
          labelId: editingLabel.id,
          input: { name, color: labelColor },
        });
        toast.success('Label updated');
      } else {
        await labelMutations.create.mutateAsync({ name, color: labelColor });
        toast.success(`Label “${name}” added`);
      }
      setLabelDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the label'));
    }
  };

  const handleRemoveLabel = async (label: TaskLabel) => {
    const ok = await confirm({
      title: `Remove the “${label.name}” label?`,
      description:
        'It is taken off every task that has it. This cannot be undone.',
      confirmLabel: 'Remove label',
      destructive: true,
    });
    if (!ok) return;
    try {
      await labelMutations.remove.mutateAsync(label.id);
      toast.success(`Label “${label.name}” removed`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove the label'));
    }
  };

  const openTeamDialog = () => {
    setTeamName('');
    setTeamKey('');
    setTeamKeyTouched(false);
    setTeamDialogOpen(true);
  };

  const effectiveTeamKey = teamKeyTouched ? teamKey : keyFromName(teamName);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = teamName.trim();
    if (name.length < 2 || effectiveTeamKey.length < 2) return;
    try {
      await teamMutations.create.mutateAsync({ name, key: effectiveTeamKey });
      toast.success(`Team “${name}” created`);
      setTeamDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the team'));
    }
  };

  const handleRemoveTeam = async (team: Team) => {
    const ok = await confirm({
      title: `Delete the “${team.name}” team?`,
      description:
        'Its tasks and projects stay, but are no longer filed under a team. This cannot be undone.',
      confirmLabel: 'Delete team',
      destructive: true,
    });
    if (!ok) return;
    try {
      await teamMutations.remove.mutateAsync(team.id);
      toast.success(`Team “${team.name}” deleted`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the team'));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Tasks & Kanban
        </h1>
        <p className="text-xs mt-1 text-muted-foreground">
          Statuses, labels and teams, shared by every board. Ticket IDs are set
          per project, from the project&apos;s identifier settings.
        </p>
      </div>

      {/* ---------------- STATUSES ---------------- */}
      <WorkflowStatusesSettings />

      {/* ---------------- PRIORITIES ---------------- */}
      <div className="space-y-3">
        <SectionHeading
          title={<>Task priorities ({KANBAN_PRIORITIES.length})</>}
        />
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {KANBAN_PRIORITIES.map((priority) => (
            <div
              key={priority.id}
              className="p-3.5 gap-4 flex items-center justify-between"
            >
              <div className="gap-3 min-w-0 flex items-center">
                <PriorityIcon
                  priority={priority.id as never}
                  className="size-4"
                />
                <span className="text-xs font-semibold text-foreground">
                  {priority.label}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded border border-border/50 bg-muted/60 font-mono text-meta text-muted-foreground">
                Key: {priority.key}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- LABELS ---------------- */}
      <div className="space-y-3">
        <SectionHeading
          title={<>Workspace labels ({labels.length})</>}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => openLabelDialog(null)}
              className="h-7 text-xs gap-1.5"
              disabled={!workspaceId}
            >
              <Plus className="size-3.5" />
              <span>Add label</span>
            </Button>
          }
        />

        <div className="p-5 rounded-xl border border-border bg-surface shadow-xs">
          {labelsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading labels…</p>
          ) : labelsQuery.isError ? (
            <p className="text-xs text-destructive">Could not load labels.</p>
          ) : labels.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No labels yet. Add one here, or create one while tagging a card.
            </p>
          ) : (
            <div className="gap-2 flex flex-wrap items-center">
              {labels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="gap-1.5 px-3 py-1 text-xs font-medium group inline-flex items-center rounded-full border"
                  style={{
                    backgroundColor: `${lbl.color}15`,
                    borderColor: `${lbl.color}40`,
                    color: lbl.color,
                  }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: lbl.color }}
                  />
                  <span>{lbl.name}</span>
                  <button
                    type="button"
                    onClick={() => openLabelDialog(lbl)}
                    className="ml-1 cursor-pointer opacity-50 group-hover:opacity-100 hover:text-foreground"
                    aria-label={`Edit label ${lbl.name}`}
                    title="Edit label"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveLabel(lbl)}
                    className="cursor-pointer opacity-50 group-hover:opacity-100 hover:text-destructive"
                    aria-label={`Remove label ${lbl.name}`}
                    title="Remove label"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- TEAMS ---------------- */}
      <div className="space-y-3">
        <SectionHeading
          title={<>Teams ({teams.length})</>}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={openTeamDialog}
              className="h-7 text-xs gap-1.5"
              disabled={!workspaceId}
            >
              <Plus className="size-3.5" />
              <span>Add team</span>
            </Button>
          }
        />

        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {teamsQuery.isLoading ? (
            <p className="p-3 text-xs text-muted-foreground">Loading teams…</p>
          ) : teamsQuery.isError ? (
            <p className="p-3 text-xs text-destructive">
              Could not load teams.
            </p>
          ) : teams.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              No teams yet. Tasks and projects can be filed under a team once
              one exists.
            </p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="p-3 gap-2 flex items-center justify-between hover:bg-accent/30"
              >
                <div className="gap-2 text-xs font-medium min-w-0 flex items-center text-foreground">
                  <Contact
                    className="size-3.5 shrink-0"
                    style={{ color: team.color ?? undefined }}
                  />
                  <span className="truncate">{team.name}</span>
                  <span className="px-1.5 py-0.5 rounded border border-border/50 bg-muted/60 font-mono text-2xs text-muted-foreground">
                    {team.key}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemoveTeam(team)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete team ${team.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------- DIALOGS ---------------- */}

      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveLabel}>
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                {editingLabel ? 'Edit label' : 'Add label'}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">
                  Label name
                </label>
                <Input
                  autoFocus
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  placeholder="e.g. Design, Mobile, Security"
                  maxLength={50}
                  className="h-9 text-xs"
                />
                {editingLabel &&
                labelName.trim() &&
                labelName.trim() !== editingLabel.name ? (
                  <p className="mt-1 text-meta text-muted-foreground">
                    Every task tagged “{editingLabel.name}” is renamed too.
                  </p>
                ) : null}
              </div>
              <ColorSwatchPicker
                label="Label colour"
                value={labelColor}
                onChange={setLabelColor}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLabelDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!labelName.trim()}
                loading={
                  labelMutations.create.isPending ||
                  labelMutations.update.isPending
                }
              >
                {editingLabel ? 'Save' : 'Create label'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddTeam}>
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">Add team</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">
                  Team name
                </label>
                <Input
                  autoFocus
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Core Engineering"
                  maxLength={80}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Key</label>
                <Input
                  value={effectiveTeamKey}
                  onChange={(e) => {
                    setTeamKeyTouched(true);
                    setTeamKey(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                    );
                  }}
                  placeholder="ENG"
                  maxLength={10}
                  className="h-9 text-xs font-mono uppercase"
                />
                <p className="mt-1 text-meta text-muted-foreground">
                  2–10 letters or digits, unique in this workspace.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTeamDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  teamName.trim().length < 2 || effectiveTeamKey.length < 2
                }
                loading={teamMutations.create.isPending}
              >
                Create team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
