import {
  Badge,
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
  Textarea,
  UserAvatar,
} from '@org/ui';
import {
  TaskPriority,
  type Epic,
  type Module,
  type PublicUser,
  type Task,
} from '@org/types';
import { cn } from '@org/utils';
import {
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { StatusIcon } from '../kanban/kanban-icons.js';

interface ModulesEpicsViewProps {
  projectId: string;
  epics: Epic[];
  modules: Module[];
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  onCreateEpic: (input: {
    projectId: string;
    name: string;
    description?: string;
    priority?: TaskPriority;
    targetDate?: string;
  }) => void;
  onCreateModule: (input: {
    projectId: string;
    name: string;
    description?: string;
    leadId?: string;
    targetDate?: string;
  }) => void;
}

export function ModulesEpicsView({
  projectId,
  epics,
  modules,
  tasks,
  members,
  onSelectTask,
  onCreateEpic,
  onCreateModule,
}: ModulesEpicsViewProps) {
  const [tab, setTab] = useState<'epics' | 'modules'>('epics');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dialogs
  const [isEpicOpen, setIsEpicOpen] = useState(false);
  const [epicName, setEpicName] = useState('');
  const [epicDesc, setEpicDesc] = useState('');

  const [isModuleOpen, setIsModuleOpen] = useState(false);
  const [moduleName, setModuleName] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');
  const [moduleLead, setModuleLead] = useState<string | undefined>(undefined);

  const activeEpic = epics.find((e) => e.id === selectedId) || epics[0];
  const activeModule = modules.find((m) => m.id === selectedId) || modules[0];

  const selectedTasks =
    tab === 'epics' && activeEpic
      ? tasks.filter((t) => t.epicId === activeEpic.id)
      : tab === 'modules' && activeModule
      ? tasks.filter((t) => t.moduleId === activeModule.id)
      : [];

  const handleCreateEpic = () => {
    if (!epicName.trim()) return;
    onCreateEpic({
      projectId,
      name: epicName.trim(),
      description: epicDesc.trim() || undefined,
    });
    setIsEpicOpen(false);
    setEpicName('');
    setEpicDesc('');
  };

  const handleCreateModule = () => {
    if (!moduleName.trim()) return;
    onCreateModule({
      projectId,
      name: moduleName.trim(),
      description: moduleDesc.trim() || undefined,
      leadId: moduleLead,
    });
    setIsModuleOpen(false);
    setModuleName('');
    setModuleDesc('');
  };

  return (
    <div className="flex flex-col w-full h-full gap-6 p-4 overflow-y-auto">
      {/* Top Header & Tab Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => {
              setTab('epics');
              setSelectedId(null);
            }}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
              tab === 'epics'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Epics ({epics.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('modules');
              setSelectedId(null);
            }}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
              tab === 'modules'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Modules ({modules.length})
          </button>
        </div>

        <Button
          size="sm"
          onClick={() => (tab === 'epics' ? setIsEpicOpen(true) : setIsModuleOpen(true))}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          {tab === 'epics' ? 'New Epic' : 'New Module'}
        </Button>
      </div>

      {/* Grid of Cards + Detail Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
        {/* Left 2 Cols: Card Grid */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tab === 'epics' ? (
            epics.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No Epics created for this project yet. Create an Epic to group related workstreams.
              </div>
            ) : (
              epics.map((epic) => {
                const epicTasks = tasks.filter((t) => t.epicId === epic.id);
                const completed = epicTasks.filter((t) => t.status === 'DONE').length;
                const total = epicTasks.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const isSelected = (selectedId || epics[0]?.id) === epic.id;

                return (
                  <Card
                    key={epic.id}
                    onClick={() => setSelectedId(epic.id)}
                    className={cn(
                      'cursor-pointer transition-all border shadow-xs hover:border-primary/50',
                      isSelected
                        ? 'border-primary ring-1 ring-primary/20 bg-card'
                        : 'border-border/60 bg-card/60',
                    )}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="neutral" className="text-[10px] uppercase font-bold text-accent-violet">
                          Epic
                        </Badge>
                        <span className="text-xs font-semibold text-foreground font-mono">
                          {pct}%
                        </span>
                      </div>
                      <CardTitle className="text-sm font-bold mt-1 text-foreground">
                        {epic.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 flex flex-col gap-3">
                      {epic.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {epic.description}
                        </p>
                      )}
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>{completed}/{total} completed</span>
                        {epic.targetDate && (
                          <span>Due {new Date(epic.targetDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )
          ) : modules.length === 0 ? (
            <div className="col-span-2 p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              No Modules created yet. Modules represent architecture or feature subsystems.
            </div>
          ) : (
            modules.map((mod) => {
              const modTasks = tasks.filter((t) => t.moduleId === mod.id);
              const completed = modTasks.filter((t) => t.status === 'DONE').length;
              const total = modTasks.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isSelected = (selectedId || modules[0]?.id) === mod.id;

              return (
                <Card
                  key={mod.id}
                  onClick={() => setSelectedId(mod.id)}
                  className={cn(
                    'cursor-pointer transition-all border shadow-xs hover:border-primary/50',
                    isSelected
                      ? 'border-primary ring-1 ring-primary/20 bg-card'
                      : 'border-border/60 bg-card/60',
                  )}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="neutral" className="text-[10px] uppercase font-bold text-accent-blue">
                        Module
                      </Badge>
                      <span className="text-xs font-semibold text-foreground font-mono">
                        {pct}%
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold mt-1 text-foreground">
                      {mod.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 flex flex-col gap-3">
                    {mod.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {mod.description}
                      </p>
                    )}
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>{completed}/{total} completed</span>
                      {mod.lead && (
                        <div className="flex items-center gap-1">
                          <UserAvatar
                            name={mod.lead.displayName || mod.lead.name}
                            seed={mod.lead.id}
                            src={mod.lead.avatarUrl}
                            size="xs"
                            className="size-4"
                          />
                          <span>{mod.lead.displayName || mod.lead.name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Right 1 Col: Linked Work Items List */}
        <div className="border border-border/60 rounded-xl bg-card overflow-hidden shadow-xs flex flex-col">
          <div className="px-4 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between">
            <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
              {tab === 'epics'
                ? activeEpic
                  ? `Items in ${activeEpic.name}`
                  : 'Epic Items'
                : activeModule
                ? `Items in ${activeModule.name}`
                : 'Module Items'}
            </span>
          </div>

          <div className="p-2 divide-y divide-border/30 max-h-[500px] overflow-y-auto">
            {selectedTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No work items linked to this {tab === 'epics' ? 'epic' : 'module'}.
              </div>
            ) : (
              selectedTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-2.5 rounded-lg hover:bg-muted/40 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <StatusIcon status={task.status} className="size-3.5 shrink-0" />
                    <span className="font-mono text-[10px] text-primary/80 font-bold">
                      {task.identifier || 'TASK'}
                    </span>
                    <span className="text-xs text-foreground font-medium truncate">
                      {task.title}
                    </span>
                  </div>
                  {task.assignee && (
                    <UserAvatar
                      name={task.assignee.displayName || task.assignee.name}
                      seed={task.assignee.id}
                      src={task.assignee.avatarUrl}
                      size="xs"
                      className="size-5 shrink-0"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Epic Dialog */}
      <Dialog open={isEpicOpen} onOpenChange={setIsEpicOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Epic</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block">Epic Name</label>
              <Input
                placeholder="e.g. Collaboration & Matrix System"
                value={epicName}
                onChange={(e) => setEpicName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Description</label>
              <Textarea
                rows={3}
                placeholder="Overview of this workstream"
                value={epicDesc}
                onChange={(e) => setEpicDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEpicOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEpic} disabled={!epicName.trim()}>
              Create Epic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Module Dialog */}
      <Dialog open={isModuleOpen} onOpenChange={setIsModuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Module</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block">Module Name</label>
              <Input
                placeholder="e.g. Authentication & RBAC"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Description</label>
              <Textarea
                rows={3}
                placeholder="Subsystem scope and responsibilities"
                value={moduleDesc}
                onChange={(e) => setModuleDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Module Lead</label>
              <Select value={moduleLead || ''} onValueChange={(val) => setModuleLead(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Assign module lead" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName || m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModuleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateModule} disabled={!moduleName.trim()}>
              Create Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
