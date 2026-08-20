import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@org/ui';
import { PriorityIcon, StatusIcon } from './kanban-icons.js';
import {
  useKanbanCustomStore,
} from './kanban-custom-store.js';
import {
  Contact,
  Hash,
  Plus,
  Ticket,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';

const PRESET_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

/**
 * The swatch row shared by the status, priority and label dialogs.
 *
 * They each drew their own before, which is why they had drifted: one offered
 * five colours and the others eight, the selected ring was `border-primary` in
 * one and `border-foreground` in the next, and none of the swatches carried a
 * name — a colour-only button reads as an unlabelled control to a screen
 * reader.
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
      <div role="group" aria-label={label} className="flex items-center gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={`size-6 rounded-full border-2 transition-transform ${
              value === color
                ? 'border-foreground scale-110'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

export function WorkspaceKanbanSettings() {
  const store = useKanbanCustomStore();

  // General Settings
  const [kanbanDefaultView, setKanbanDefaultView] = useState('board');
  const [showTaskAge, setShowTaskAge] = useState(true);
  const [enableWipLimits, setEnableWipLimits] = useState(false);
  const [autoArchiveCompleted, setAutoArchiveCompleted] = useState('30');

  // Status Modal State
  const [isAddStatusOpen, setIsAddStatusOpen] = useState(false);
  const [statusName, setStatusName] = useState('');
  const [statusKey, setStatusKey] = useState('');
  const [statusColor, setStatusColor] = useState('#3b82f6');

  // Priority Modal State
  const [isAddPriorityOpen, setIsAddPriorityOpen] = useState(false);
  const [priorityName, setPriorityName] = useState('');
  const [priorityKey, setPriorityKey] = useState('');
  const [priorityColor, setPriorityColor] = useState('#f59e0b');

  // Label Modal State
  const [isAddLabelOpen, setIsAddLabelOpen] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#8b5cf6');

  // Team Modal State
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState('');

  // Slack Channel Modal State
  const [isAddSlackOpen, setIsAddSlackOpen] = useState(false);
  const [slackName, setSlackName] = useState('');

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusName.trim()) return;
    const id = statusName.trim().toUpperCase().replace(/\s+/g, '_');
    store.addStatus({
      id,
      label: statusName.trim(),
      key: statusKey.trim() || `${store.statuses.length + 1}`,
      color: statusColor,
    });
    setStatusName('');
    setStatusKey('');
    setIsAddStatusOpen(false);
  };

  const handleAddPriority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priorityName.trim()) return;
    const id = priorityName.trim().toUpperCase().replace(/\s+/g, '_');
    store.addPriority({
      id,
      label: priorityName.trim(),
      key: priorityKey.trim() || `${store.priorities.length}`,
      color: priorityColor,
    });
    setPriorityName('');
    setPriorityKey('');
    setIsAddPriorityOpen(false);
  };

  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelName.trim()) return;
    store.addLabel({
      name: labelName.trim(),
      color: labelColor,
    });
    setLabelName('');
    setIsAddLabelOpen(false);
  };

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    store.addTeam({ name: teamName.trim() });
    setTeamName('');
    setIsAddTeamOpen(false);
  };

  const handleAddSlack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slackName.trim()) return;
    store.addSlackChannel({ name: slackName.trim().replace(/^#/, '') });
    setSlackName('');
    setIsAddSlackOpen(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Tasks & Kanban
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Customize task statuses, priority levels, labels, teams, ticket IDs, and board workflows.
        </p>
      </div>

      {/* ---------------- 1. TICKET IDENTIFIER ---------------- */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
          Ticket Key & Identifier
        </h3>
        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Ticket className="size-4 text-primary" />
              <h4 className="text-xs font-medium text-foreground">
                Ticket Identifier Prefix
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Prefix used for unique issue and card references (e.g. {store.ticketPrefix}-101)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Input
              value={store.ticketPrefix}
              onChange={(e) => store.setTicketPrefix(e.target.value)}
              placeholder="DES"
              className="w-24 h-8 text-xs font-mono uppercase text-center font-bold bg-surface"
              maxLength={6}
            />
            <span className="text-xs font-mono text-muted-foreground">
              → Preview: <span className="font-semibold text-foreground">{store.ticketPrefix}-101</span>
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- 2. CUSTOM STATUSES ---------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Board Statuses ({store.statuses.length})
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddStatusOpen(true)}
            className="h-7 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Status</span>
          </Button>
        </div>

        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
          {store.statuses.map((status) => (
            <div
              key={status.id}
              className="p-3.5 flex items-center justify-between gap-4 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusIcon status={status.id as any} className="size-4" />
                <span className="text-xs font-semibold text-foreground">
                  {status.label}
                </span>
                {status.isCustom && (
                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                    Custom
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
                  Key: {status.key}
                </span>

                {status.isCustom ? (
                  <button
                    type="button"
                    onClick={() => store.removeStatus(status.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                    title="Remove custom status"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 select-none">
                    Default
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- 3. CUSTOM PRIORITIES ---------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Task Priorities ({store.priorities.length})
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddPriorityOpen(true)}
            className="h-7 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Priority</span>
          </Button>
        </div>

        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
          {store.priorities.map((priority) => (
            <div
              key={priority.id}
              className="p-3.5 flex items-center justify-between gap-4 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <PriorityIcon priority={priority.id as any} className="size-4" />
                <span className="text-xs font-semibold text-foreground">
                  {priority.label}
                </span>
                {priority.isCustom && (
                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                    Custom
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
                  Key: {priority.key}
                </span>

                {priority.isCustom ? (
                  <button
                    type="button"
                    onClick={() => store.removePriority(priority.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                    title="Remove custom priority"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 select-none">
                    Default
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- 4. LABELS & TAGS ---------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Workspace Labels ({store.labels.length})
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddLabelOpen(true)}
            className="h-7 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Label</span>
          </Button>
        </div>

        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-4">
          <div className="flex items-center gap-2 flex-wrap">
            {store.labels.map((lbl) => (
              <span
                key={lbl.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border group"
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
                  onClick={() => store.removeLabel(lbl.id)}
                  className="opacity-50 group-hover:opacity-100 hover:text-destructive cursor-pointer ml-1"
                  title="Remove label"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 5. TEAMS & SLACK ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Teams */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
              Team Links
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddTeamOpen(true)}
              className="h-6 text-[11px] px-2 gap-1"
            >
              <Plus className="size-3" />
              <span>Add</span>
            </Button>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            {store.teams.map((team) => (
              <div
                key={team.id}
                className="p-3 flex items-center justify-between gap-2 hover:bg-accent/30"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-accent-blue">
                  <Contact className="size-3.5 text-accent-blue" />
                  <span>{team.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => store.removeTeam(team.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Slack Channels */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
              Slack Channels
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddSlackOpen(true)}
              className="h-6 text-[11px] px-2 gap-1"
            >
              <Plus className="size-3" />
              <span>Add</span>
            </Button>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            {store.slackChannels.map((slk) => (
              <div
                key={slk.id}
                className="p-3 flex items-center justify-between gap-2 hover:bg-accent/30"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Hash className="size-3.5 text-muted-foreground" />
                  <span>{slk.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => store.removeSlackChannel(slk.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 6. GENERAL WORKFLOWS ---------------- */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
          Board Workflows
        </h3>
        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div>
              <h4 className="text-xs font-medium text-foreground">Default Task Layout</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Select default view when opening project tasks</p>
            </div>
            <Select value={kanbanDefaultView} onValueChange={setKanbanDefaultView}>
              <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                <SelectValue placeholder="Board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board" className="text-xs">Kanban Board</SelectItem>
                <SelectItem value="list" className="text-xs">Task List</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div>
              <h4 className="text-xs font-medium text-foreground">Show Task Age Indicator</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Display time elapsed since task creation on cards</p>
            </div>
            <Switch checked={showTaskAge} onCheckedChange={setShowTaskAge} />
          </div>

          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div>
              <h4 className="text-xs font-medium text-foreground">Enable WIP Limits per Column</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Restrict maximum active tasks per board status column</p>
            </div>
            <Switch checked={enableWipLimits} onCheckedChange={setEnableWipLimits} />
          </div>

          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div>
              <h4 className="text-xs font-medium text-foreground">Auto-archive Completed Tasks</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Move completed tasks to archive after set duration</p>
            </div>
            <Select value={autoArchiveCompleted} onValueChange={setAutoArchiveCompleted}>
              <SelectTrigger className="w-32 h-8 text-xs bg-surface border-border">
                <SelectValue placeholder="30 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30" className="text-xs">30 days</SelectItem>
                <SelectItem value="7" className="text-xs">7 days</SelectItem>
                <SelectItem value="never" className="text-xs">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}

      {/* Add Status Dialog */}
      <Dialog open={isAddStatusOpen} onOpenChange={setIsAddStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddStatus}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Add Custom Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">Status Name</label>
                <Input
                  autoFocus
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  placeholder="e.g. Under Review, In QA, Blocked"
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Keyboard Key</label>
                  <Input
                    value={statusKey}
                    onChange={(e) => setStatusKey(e.target.value)}
                    placeholder="e.g. 6"
                    maxLength={2}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <ColorSwatchPicker
                  label="Color"
                  value={statusColor}
                  onChange={setStatusColor}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddStatusOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!statusName.trim()}>
                Add Status
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Priority Dialog */}
      <Dialog open={isAddPriorityOpen} onOpenChange={setIsAddPriorityOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddPriority}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Add Custom Priority</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">Priority Name</label>
                <Input
                  autoFocus
                  value={priorityName}
                  onChange={(e) => setPriorityName(e.target.value)}
                  placeholder="e.g. Critical, Blocker, Nice to have"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Keyboard Key</label>
                <Input
                  value={priorityKey}
                  onChange={(e) => setPriorityKey(e.target.value)}
                  placeholder="e.g. 5"
                  maxLength={2}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <ColorSwatchPicker
                label="Color"
                value={priorityColor}
                onChange={setPriorityColor}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddPriorityOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!priorityName.trim()}>
                Add Priority
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Label Dialog */}
      <Dialog open={isAddLabelOpen} onOpenChange={setIsAddLabelOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddLabel}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Add Label / Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">Label Name</label>
                <Input
                  autoFocus
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  placeholder="e.g. Design, Mobile, Security, High-Impact"
                  className="h-9 text-xs"
                />
              </div>
              <ColorSwatchPicker
                label="Label Color"
                value={labelColor}
                onChange={setLabelColor}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddLabelOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!labelName.trim()}>
                Create Label
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Team Dialog */}
      <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddTeam}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Add Team Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">Team Name</label>
                <Input
                  autoFocus
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Designteam-link, Core-Eng, QA-Squad"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddTeamOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!teamName.trim()}>
                Add Team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Slack Channel Dialog */}
      <Dialog open={isAddSlackOpen} onOpenChange={setIsAddSlackOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddSlack}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Add Slack Channel Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold mb-1 block">Channel Name</label>
                <Input
                  autoFocus
                  value={slackName}
                  onChange={(e) => setSlackName(e.target.value)}
                  placeholder="e.g. design-sync, general, alerts"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddSlackOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!slackName.trim()}>
                Add Channel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
