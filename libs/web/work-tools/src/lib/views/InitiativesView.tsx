import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@org/ui';
import {
  ProjectHealth,
  TaskPriority,
  type Initiative,
  type ProjectDetail,
  type PublicUser,
} from '@org/types';
import { cn } from '@org/utils';
import {
  Calendar,
  FolderKanban,
  Plus,
  Target,
} from 'lucide-react';
import { useState } from 'react';

interface InitiativesViewProps {
  initiatives: Initiative[];
  projects: ProjectDetail[];
  members?: PublicUser[];
  onSelectProject: (projectId: string) => void;
  onCreateInitiative: (input: {
    name: string;
    objective?: string;
    description?: string;
    health?: ProjectHealth;
    priority?: TaskPriority;
    targetDate?: string;
    projectIds?: string[];
  }) => void;
}

export function InitiativesView({
  initiatives,
  projects,
  onSelectProject,
  onCreateInitiative,
}: InitiativesViewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateInitiative({
      name: name.trim(),
      objective: objective.trim() || undefined,
      description: description.trim() || undefined,
      targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
      projectIds: selectedProjectIds,
    });
    setIsCreateOpen(false);
    setName('');
    setObjective('');
    setDescription('');
    setSelectedProjectIds([]);
  };

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  return (
    <div className="flex flex-col w-full h-full gap-6 p-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Target className="size-5 text-primary" />
            Strategic Initiatives
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            High-level business objectives connecting multiple teams and projects.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          New Initiative
        </Button>
      </div>

      {/* Initiatives List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {initiatives.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No strategic initiatives defined. Create an initiative to align cross-project goals.
          </div>
        ) : (
          initiatives.map((init) => {
            const childProjects = projects.filter((p) =>
              init.projects?.some((ip) => ip.id === p.id),
            );

            return (
              <Card
                key={init.id}
                className="border border-border/60 bg-card/80 shadow-xs hover:border-primary/40 transition-all flex flex-col"
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                          init.health === ProjectHealth.HEALTHY &&
                            'bg-accent-green-soft text-accent-green border-accent-green/30',
                          init.health === ProjectHealth.AT_RISK &&
                            'bg-accent-amber-soft text-accent-amber border-accent-amber/30',
                          init.health === ProjectHealth.OFF_TRACK &&
                            'bg-destructive/10 text-destructive border-destructive/30',
                          init.health === ProjectHealth.COMPLETED &&
                            'bg-accent-blue-soft text-accent-blue border-accent-blue/30',
                        )}
                      >
                        {init.health}
                      </span>
                      {init.targetDate && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="size-3" />
                          Target: {new Date(init.targetDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {init.name}
                    </CardTitle>
                    {init.objective && (
                      <p className="text-xs font-medium text-primary mt-1">
                        🎯 {init.objective}
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 flex flex-col gap-4 flex-1 justify-between">
                  {init.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {init.description}
                    </p>
                  )}

                  {/* Connected Projects */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Connected Projects ({childProjects.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
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
                            className="inline-flex items-center gap-1.5 bg-muted/60 hover:bg-primary/10 hover:text-primary px-2.5 py-1 rounded-md text-xs border border-border/50 transition-colors"
                          >
                            <FolderKanban className="size-3 text-muted-foreground" />
                            <span className="font-medium">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
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

      {/* Create Initiative Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Strategic Initiative</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block">Initiative Name</label>
              <Input
                placeholder="e.g. Elevate Mobile Experience & Speed"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Key Objective</label>
              <Input
                placeholder="e.g. Reduce app launch time under 1 second"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Description</label>
              <Textarea
                rows={3}
                placeholder="Scope, measurable key results and context"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Target Date</label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block">
                Link Existing Projects
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-border rounded-lg bg-muted/20">
                {projects.map((p) => {
                  const isLinked = selectedProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProject(p.id)}
                      className={cn(
                        'px-2.5 py-1 rounded text-xs transition-colors border',
                        isLinked
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-muted',
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create Initiative
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
