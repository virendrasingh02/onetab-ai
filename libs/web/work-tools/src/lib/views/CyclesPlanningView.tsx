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
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UserAvatar,
} from '@org/ui';
import {
  CycleStatus,
  type Cycle,
  type PublicUser,
  type Task,
} from '@org/types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RotateCw,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { StatusIcon } from '../kanban/kanban-icons.js';

interface CyclesPlanningViewProps {
  cycles: Cycle[];
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  onCreateCycle: (input: {
    name: string;
    description?: string;
    goal?: string;
    startDate: string;
    endDate: string;
  }) => void;
  onUpdateCycleStatus: (cycleId: string, status: CycleStatus) => void;
  onAssignTaskToCycle: (taskId: string, cycleId: string | null) => void;
}

export function CyclesPlanningView({
  cycles,
  tasks,
  onSelectTask,
  onCreateCycle,
  onAssignTaskToCycle,
}: CyclesPlanningViewProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(
    () => cycles.find((c) => c.status === CycleStatus.ACTIVE)?.id || cycles[0]?.id || null,
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  const cycleTasks = tasks.filter((t) => t.cycleId === selectedCycleId);
  const backlogTasks = tasks.filter((t) => !t.cycleId);

  const completedCount = cycleTasks.filter((t) => t.status === 'DONE').length;
  const totalCount = cycleTasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const totalEstimate = cycleTasks.reduce((acc, t) => acc + (t.estimate || 0), 0);
  const completedEstimate = cycleTasks
    .filter((t) => t.status === 'DONE')
    .reduce((acc, t) => acc + (t.estimate || 0), 0);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateCycle({
      name: name.trim(),
      goal: goal.trim() || undefined,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    });
    setIsCreateOpen(false);
    setName('');
    setGoal('');
  };

  return (
    <div className="flex flex-col w-full h-full gap-6 p-4 overflow-y-auto">
      {/* Top Banner: Active Cycle Overview & Stats */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Left: Cycle Selector & Status */}
        <Card className="flex-1 border border-border/60 bg-card/80 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <RotateCw className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  {selectedCycle ? selectedCycle.name : 'Select or Create a Cycle'}
                </CardTitle>
                {selectedCycle?.goal && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Goal: {selectedCycle.goal}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedCycleId || ''}
                onValueChange={(val) => setSelectedCycleId(val)}
              >
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="Choose cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="size-3.5" />
                New Cycle
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-3 flex flex-col gap-3">
            {selectedCycle && (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {new Date(selectedCycle.startDate).toLocaleDateString()} –{' '}
                    {new Date(selectedCycle.endDate).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-foreground">
                    {progressPct}% Completed ({completedCount}/{totalCount} tasks)
                  </span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Metrics Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0 lg:w-[420px]">
          <Card className="border border-border/60 p-3 bg-muted/20 flex flex-col justify-between">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Zap className="size-3.5 text-accent-amber" />
              Velocity
            </span>
            <div className="text-xl font-bold text-foreground">
              {completedEstimate}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                / {totalEstimate} pts
              </span>
            </div>
          </Card>

          <Card className="border border-border/60 p-3 bg-muted/20 flex flex-col justify-between">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-accent-green" />
              Done Tasks
            </span>
            <div className="text-xl font-bold text-accent-green">{completedCount}</div>
          </Card>

          <Card className="border border-border/60 p-3 bg-muted/20 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="size-3.5 text-accent-blue" />
              Remaining
            </span>
            <div className="text-xl font-bold text-foreground">
              {totalCount - completedCount}
            </div>
          </Card>
        </div>
      </div>

      {/* Main Area: 2 Columns - In Cycle vs Backlog Carry-Over */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* In-Cycle Work Items */}
        <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between">
            <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
              Work Items in {selectedCycle?.name || 'Cycle'} ({cycleTasks.length})
            </span>
          </div>

          <div className="flex-1 p-2 overflow-y-auto divide-y divide-border/30 space-y-1">
            {cycleTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No work items assigned to this cycle yet. Move items from the backlog.
              </div>
            ) : (
              cycleTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-2.5 rounded-lg hover:bg-muted/40 transition-colors flex items-center justify-between group cursor-pointer border border-transparent hover:border-border/40"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <StatusIcon status={task.status} className="size-3.5 shrink-0" />
                    <span className="font-mono text-[10px] text-primary/80 font-bold">
                      {task.identifier || 'TASK'}
                    </span>
                    <span className="text-xs text-foreground font-medium truncate">
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.estimate != null && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {task.estimate} pts
                      </span>
                    )}
                    {task.assignee && (
                      <UserAvatar
                        name={task.assignee.displayName || task.assignee.name}
                        seed={task.assignee.id}
                        src={task.assignee.avatarUrl}
                        size="xs"
                        className="size-5"
                      />
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignTaskToCycle(task.id, null);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-destructive h-6 px-1.5"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Backlog Items to Add */}
        <div className="flex flex-col border border-border/60 rounded-xl bg-card overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between">
            <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
              Workspace Backlog ({backlogTasks.length})
            </span>
          </div>

          <div className="flex-1 p-2 overflow-y-auto divide-y divide-border/30 space-y-1">
            {backlogTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No backlog work items available.
              </div>
            ) : (
              backlogTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-2.5 rounded-lg hover:bg-muted/40 transition-colors flex items-center justify-between group cursor-pointer border border-transparent hover:border-border/40"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <StatusIcon status={task.status} className="size-3.5 shrink-0" />
                    <span className="font-mono text-[10px] text-primary/80 font-bold">
                      {task.identifier || 'TASK'}
                    </span>
                    <span className="text-xs text-foreground font-medium truncate">
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.estimate != null && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {task.estimate} pts
                      </span>
                    )}
                    {selectedCycleId && (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignTaskToCycle(task.id, selectedCycleId);
                        }}
                        className="text-[10px] h-6 px-2 gap-1 text-primary"
                      >
                        <Plus className="size-3" />
                        Add to Cycle
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Cycle Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Planning Cycle</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block">Cycle Name</label>
              <Input
                placeholder="e.g. Sprint 24 or Q3 Launch"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Cycle Goal</label>
              <Input
                placeholder="Key outcome or deliverable"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Create Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
