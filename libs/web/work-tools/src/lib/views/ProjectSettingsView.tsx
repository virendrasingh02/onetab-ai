import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@org/ui';
import {
  IdentifierPrefixMode,
  ProjectHealth,
  type ProjectDetail,
  type PublicUser,
  type Team,
} from '@org/types';
import { formatTicketIdentifier } from '@org/utils';
import {
  AlertTriangle,
  Hash,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  CoworkerAvatar,
  CoworkerStatusDot,
  useCoworkerMutations,
  useCoworkers,
  useProjectCoworkers,
} from '@org/web-coworkers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  SkeletonList,
} from '@org/ui';

interface ProjectSettingsViewProps {
  project: ProjectDetail;
  teams: Team[];
  members: PublicUser[];
  onUpdateProject: (patch: Record<string, any>) => void;
  onUpdateIdentifierSettings: (input: {
    ticketPrefix?: string;
    identifierPrefixMode?: IdentifierPrefixMode;
    regenerate?: boolean;
  }) => void;
  onDeleteProject: () => void;
}

export function ProjectSettingsView({
  project,
  teams,
  members,
  onUpdateProject,
  onUpdateIdentifierSettings,
  onDeleteProject,
}: ProjectSettingsViewProps) {
  // General State
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [health, setHealth] = useState(project.health || ProjectHealth.HEALTHY);
  const [leadId, setLeadId] = useState(project.leadId || 'none');
  const [teamId, setTeamId] = useState(project.teamId || 'none');

  // Identifier Settings State
  const [prefixMode, setPrefixMode] = useState<IdentifierPrefixMode>(
    project.identifierPrefixMode || IdentifierPrefixMode.AUTO,
  );
  const [customPrefix, setCustomPrefix] = useState(project.ticketPrefix || 'PRJ');
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const nextNumber = (project.ticketSeq || 0) + 1;
  const previewTicket = formatTicketIdentifier(customPrefix, nextNumber);

  const handleSaveGeneral = () => {
    onUpdateProject({
      name: name.trim(),
      description: description.trim() || null,
      health,
      leadId: leadId === 'none' ? null : leadId,
      teamId: teamId === 'none' ? null : teamId,
    });
    toast.success('Project details saved');
  };

  const handleSaveIdentifier = () => {
    onUpdateIdentifierSettings({
      ticketPrefix: customPrefix.trim().toUpperCase(),
      identifierPrefixMode: prefixMode,
    });
    toast.success('Identifier settings updated');
  };

  const handleConfirmRegenerate = () => {
    onUpdateIdentifierSettings({
      identifierPrefixMode: IdentifierPrefixMode.AUTO,
      regenerate: true,
    });
    setIsRegenerateConfirmOpen(false);
    toast.success('Prefix regenerated from project name');
  };

  return (
    <div className="flex flex-col w-full h-full gap-6 p-4 overflow-y-auto max-w-4xl mx-auto">
      {/* 1. Dynamic Identifier Configuration Card */}
      <Card className="border border-primary/40 bg-card/90 shadow-xs">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <Hash className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Dynamic Ticket Identifier System
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure prefix generation rules and sequential work item numbering.
                </CardDescription>
              </div>
            </div>

            {/* Live Preview Badge */}
            <div className="flex items-center gap-2 bg-muted/60 border border-border/80 px-3 py-1.5 rounded-lg">
              <span className="text-[11px] text-muted-foreground font-medium">
                Next Issue:
              </span>
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
                {previewTicket}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prefix Mode */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block">Prefix Mode</label>
              <Select
                value={prefixMode}
                onValueChange={(val) => setPrefixMode(val as IdentifierPrefixMode)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={IdentifierPrefixMode.AUTO}>
                    Auto-Generate (from Project Name)
                  </SelectItem>
                  <SelectItem value={IdentifierPrefixMode.CUSTOM}>
                    Custom Prefix
                  </SelectItem>
                  <SelectItem value={IdentifierPrefixMode.LOCKED}>
                    Locked Prefix (Immutable)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prefix Input */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block">
                Identifier Stem Prefix
              </label>
              <Input
                disabled={prefixMode === IdentifierPrefixMode.LOCKED}
                value={customPrefix}
                onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. WEB, MOB, API"
                className="font-mono uppercase font-bold"
                maxLength={8}
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRegenerateConfirmOpen(true)}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Regenerate from Title
            </Button>

            <Button size="sm" onClick={handleSaveIdentifier} className="text-xs">
              Save Identifier Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. General Project Settings */}
      <Card className="border border-border/60 bg-card/80 shadow-xs">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold text-foreground">
            Project Information
          </CardTitle>
          <CardDescription className="text-xs">
            Manage project identity, team assignment, and health status.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block">Project Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block">Health Status</label>
              <Select
                value={health}
                onValueChange={(val) => setHealth(val as ProjectHealth)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ProjectHealth).map((h) => (
                    <SelectItem key={h} value={h}>
                      <span className="capitalize">{h.toLowerCase()}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block">Description</label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State the core mission and scope of this project"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block">Project Lead</label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Assign a lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Lead</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName || m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block">Assigned Team</label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button size="sm" onClick={handleSaveGeneral} className="text-xs">
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2b. AI Coworkers */}
      <ProjectCoworkersCard workspaceId={project.workspaceId} projectId={project.id} />

      {/* 3. Danger Zone */}
      <Card className="border border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-sm font-bold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="size-4" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Irreversible actions that affect all work items in this project.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-2 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">
              Delete this project
            </span>
            <span className="text-[11px] text-muted-foreground">
              Permanently delete all tasks, milestones, and cycles associated with this project.
            </span>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="text-xs"
          >
            Delete Project
          </Button>
        </CardContent>
      </Card>

      {/* Regenerate Warning Dialog */}
      <Dialog
        open={isRegenerateConfirmOpen}
        onOpenChange={setIsRegenerateConfirmOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Ticket Prefix?</DialogTitle>
            <DialogDescription className="text-xs">
              This will update the project's ticket prefix to match the current project title.
              Existing ticket numbers will remain intact with the new prefix applied to future tickets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRegenerateConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmRegenerate}>Confirm Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete Project “{project.name}”?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure? This action cannot be undone and will permanently remove all work items,
              sprints, and docs under this project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                onDeleteProject();
              }}
            >
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * AI Coworkers added to this project — real, backend-wired (`ProjectCoworker`
 * rows via `@org/web-coworkers`). A project coworker's tools/knowledge are
 * additionally scoped to this project inside `AIRuntimeService`, not just
 * shown here — this card only controls membership.
 */
function ProjectCoworkersCard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const projectCoworkers = useProjectCoworkers(workspaceId, projectId);
  const allCoworkers = useCoworkers(workspaceId);
  const mutations = useCoworkerMutations(workspaceId);

  const linkedIds = new Set(
    (projectCoworkers.data ?? []).map((c) => c.coworkerId),
  );
  const availableToAdd = (allCoworkers.data ?? []).filter(
    (c) => !linkedIds.has(c.id),
  );

  const handleAdd = (coworkerId: string) => {
    mutations.addProjectCoworker.mutate(
      { projectId, coworkerId },
      {
        onSuccess: () => toast.success('Coworker added to project'),
        onError: () => toast.error('Could not add the coworker to this project'),
      },
    );
  };

  const handleRemove = (coworkerId: string) => {
    mutations.removeProjectCoworker.mutate(
      { projectId, coworkerId },
      {
        onSuccess: () => toast.info('Coworker removed from project'),
        onError: () => toast.error('Could not remove the coworker'),
      },
    );
  };

  return (
    <Card className="shadow-xs">
      <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" />
            AI Coworkers
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Persistent AI teammates with access to this project's context and tasks.
          </CardDescription>
        </div>
        {availableToAdd.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2">
                <Plus className="size-3" />
                <span>Add</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {availableToAdd.map((coworker) => (
                <DropdownMenuItem
                  key={coworker.id}
                  onClick={() => handleAdd(coworker.id)}
                  className="gap-2"
                >
                  <CoworkerAvatar
                    name={coworker.name}
                    avatarUrl={coworker.avatarUrl}
                    size="xs"
                    showStatusDot={false}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {coworker.name}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {coworker.role}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardHeader>
      <CardContent className="p-5 pt-2">
        {projectCoworkers.isLoading ? (
          <SkeletonList rows={2} withAvatar />
        ) : (projectCoworkers.data ?? []).length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Sparkles />}
            title="No coworkers on this project"
            description="Add an AI coworker so it can read permitted project context and help with tasks."
          />
        ) : (
          <div className="space-y-2">
            {(projectCoworkers.data ?? []).map((link) => (
              <div
                key={link.id}
                className="p-3 rounded-xl border border-border bg-surface flex items-center gap-2.5"
              >
                <CoworkerAvatar
                  name={link.coworker.name}
                  avatarUrl={link.coworker.avatarUrl}
                  status={link.coworker.status}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                      {link.coworker.name}
                    </span>
                    <CoworkerStatusDot status={link.coworker.status} />
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {link.coworker.role}
                  </span>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleRemove(link.coworkerId)}
                  className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                  title="Remove coworker from project"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
