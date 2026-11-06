import {
  AppSelect,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  confirm,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Textarea,
  DatePicker,
  ProjectGlyph,
} from '@org/ui';
import {
  ProjectHealth,
  WorkspacePermission,
  type Initiative,
  type ProjectDetail,
  type PublicUser,
  type TaskPriority,
} from '@org/types';
import { cn } from '@org/utils';
import {
  Calendar,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspacePermission } from '@org/web-workspace';
import { dayToIso, isoToDay } from '../kanban/server-board.js';

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  HEALTHY: 'On track',
  AT_RISK: 'At risk',
  OFF_TRACK: 'Off track',
  COMPLETED: 'Completed',
};

interface InitiativeDraft {
  id?: string;
  name: string;
  objective: string;
  description: string;
  health: ProjectHealth;
  targetDate?: string;
  projectIds: string[];
}

const EMPTY_DRAFT: InitiativeDraft = {
  name: '',
  objective: '',
  description: '',
  health: ProjectHealth.HEALTHY,
  projectIds: [],
};

interface InitiativesViewProps {
  initiatives: Initiative[];
  projects: ProjectDetail[];
  members?: PublicUser[];
  onSelectProject: (projectId: string) => void;
  /** Each rejects on failure; the app's mutation handler shows the error. */
  onCreateInitiative: (input: InitiativeInput) => Promise<unknown>;
  onUpdateInitiative: (
    initiativeId: string,
    input: InitiativeInput,
  ) => Promise<unknown>;
  onDeleteInitiative: (initiativeId: string) => Promise<unknown>;
}

interface InitiativeInput {
  name: string;
  objective?: string | null;
  description?: string | null;
  health?: ProjectHealth;
  priority?: TaskPriority;
  targetDate?: string | null;
  projectIds?: string[];
}

export function InitiativesView({
  initiatives,
  projects,
  onSelectProject,
  onCreateInitiative,
  onUpdateInitiative,
  onDeleteInitiative,
}: InitiativesViewProps) {
  const canDelete = useWorkspacePermission().can(WorkspacePermission.DELETE);
  const [draft, setDraft] = useState<InitiativeDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || draft.name.trim().length < 2) return;

    const input: InitiativeInput = {
      name: draft.name.trim(),
      objective: draft.objective.trim() || null,
      description: draft.description.trim() || null,
      health: draft.health,
      targetDate: draft.targetDate ? dayToIso(draft.targetDate) : null,
      projectIds: draft.projectIds,
    };
    setSaving(true);
    try {
      await (draft.id
        ? onUpdateInitiative(draft.id, input)
        : onCreateInitiative(input));
      setDraft(null);
    } catch {
      // The draft stays open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (initiative: Initiative) => {
    const ok = await confirm({
      title: `Delete “${initiative.name}”?`,
      description:
        'Its projects stay as they are and are no longer linked to it.',
      confirmLabel: 'Delete initiative',
      destructive: true,
    });
    if (ok) await onDeleteInitiative(initiative.id).catch(() => undefined);
  };

  const toggleProject = (id: string) => {
    setDraft(
      (prev) =>
        prev && {
          ...prev,
          projectIds: prev.projectIds.includes(id)
            ? prev.projectIds.filter((p) => p !== id)
            : [...prev.projectIds, id],
        },
    );
  };

  return (
    <div className="gap-6 p-4 flex h-full w-full flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Initiatives
          </h2>
          <p className="text-xs mt-0.5 text-muted-foreground">
            Workspace goals that connect several projects.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setDraft(EMPTY_DRAFT)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          New initiative
        </Button>
      </div>

      {/* Initiatives List */}
      <div className="lg:grid-cols-2 gap-4 grid grid-cols-1">
        {initiatives.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon={<Target />}
              title="No initiatives yet"
              description="Create an initiative to track a goal that spans several projects."
            />
          </div>
        ) : (
          initiatives.map((init) => {
            const childProjects = projects.filter((p) =>
              init.projects?.some((ip) => ip.id === p.id),
            );

            return (
              <Card
                key={init.id}
                className="flex flex-col border border-border/60 bg-card/80 shadow-xs transition-all hover:border-primary/40"
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                  <div className="pr-2 flex-1">
                    <div className="gap-2 mb-1 flex items-center">
                      <span
                        className={cn(
                          'gap-1 font-bold px-2 py-0.5 inline-flex items-center rounded-full border text-[10px]',
                          init.health === ProjectHealth.HEALTHY &&
                            'border-accent-green/30 bg-accent-green-soft text-accent-green',
                          init.health === ProjectHealth.AT_RISK &&
                            'border-accent-amber/30 bg-accent-amber-soft text-accent-amber',
                          init.health === ProjectHealth.OFF_TRACK &&
                            'border-destructive/30 bg-destructive/10 text-destructive',
                          init.health === ProjectHealth.COMPLETED &&
                            'border-accent-blue/30 bg-accent-blue-soft text-accent-blue',
                        )}
                      >
                        {HEALTH_LABELS[init.health]}
                      </span>
                      {init.targetDate && (
                        <span className="gap-1 flex items-center text-[11px] text-muted-foreground">
                          <Calendar className="size-3" />
                          Target:{' '}
                          {new Date(init.targetDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {init.name}
                    </CardTitle>
                    {init.objective && (
                      <p className="text-xs font-medium mt-1 text-primary">
                        {init.objective}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 text-muted-foreground"
                        aria-label={`Actions for ${init.name}`}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onSelect={() =>
                          setDraft({
                            id: init.id,
                            name: init.name,
                            objective: init.objective ?? '',
                            description: init.description ?? '',
                            health: init.health,
                            targetDate: isoToDay(init.targetDate),
                            projectIds: (init.projects ?? []).map((p) => p.id),
                          })
                        }
                        className="gap-2 text-xs"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </DropdownMenuItem>
                      {canDelete ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void handleDelete(init)}
                          className="gap-2 text-xs"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="p-4 pt-2 gap-4 flex flex-1 flex-col justify-between">
                  {init.description && (
                    <p className="text-xs line-clamp-2 text-muted-foreground">
                      {init.description}
                    </p>
                  )}

                  {/* Connected Projects */}
                  <div className="gap-2 pt-2 flex flex-col border-t border-border/40">
                    <span className="font-medium text-[11px] text-muted-foreground">
                      Projects ({childProjects.length})
                    </span>
                    <div className="gap-2 flex flex-wrap">
                      {childProjects.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">
                          No projects linked
                        </span>
                      ) : (
                        childProjects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onSelectProject(p.id)}
                            className="gap-1.5 px-2.5 py-1 text-xs inline-flex items-center rounded-md border border-border/50 bg-muted/60 transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <ProjectGlyph
                              icon={p.icon}
                              iconColor={p.iconColor}
                              color={p.color}
                              size="xs"
                            />
                            <span className="font-medium">{p.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({p._count?.tasks || 0})
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {draft ? (
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? 'Edit initiative' : 'New initiative'}
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="gap-3 flex flex-col">
                <Field label="Name" required>
                  <Input
                    autoFocus
                    maxLength={100}
                    placeholder="e.g. Faster mobile experience"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Objective" optional>
                  <Input
                    maxLength={500}
                    placeholder="e.g. App opens in under one second"
                    value={draft.objective}
                    onChange={(e) =>
                      setDraft({ ...draft, objective: e.target.value })
                    }
                  />
                </Field>
                <Field label="Description" optional>
                  <Textarea
                    rows={3}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </Field>
                <div className="gap-3 grid grid-cols-2">
                  <Field label="Health">
                    <AppSelect
                      value={draft.health}
                      onValueChange={(value) =>
                        setDraft({ ...draft, health: value as ProjectHealth })
                      }
                      aria-label="Health"
                      options={Object.values(ProjectHealth).map((value) => ({
                        value,
                        label: HEALTH_LABELS[value],
                      }))}
                    />
                  </Field>
                  <Field label="Target date" optional>
                    <DatePicker
                      value={draft.targetDate}
                      onChange={(targetDate) =>
                        setDraft({ ...draft, targetDate })
                      }
                      placeholder="No date"
                    />
                  </Field>
                </div>
                <Field label="Projects" optional>
                  <div className="gap-1.5 max-h-32 p-2 flex flex-wrap overflow-y-auto rounded-lg border border-border bg-muted/20">
                    {projects.map((p) => {
                      const isLinked = draft.projectIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={isLinked}
                          onClick={() => toggleProject(p.id)}
                          className={cn(
                            'px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors',
                            isLinked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-foreground hover:bg-muted',
                          )}
                        >
                          <span className="gap-1.5 inline-flex items-center">
                            <ProjectGlyph
                              icon={p.icon}
                              iconColor={p.iconColor}
                              color={p.color}
                              size="xs"
                            />
                            {p.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={saving}
                  disabled={draft.name.trim().length < 2}
                >
                  {draft.id ? 'Save changes' : 'Create initiative'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
