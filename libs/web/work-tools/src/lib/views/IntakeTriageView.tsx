import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ProjectGlyph,
} from '@org/ui';
import {
  IntakeSource,
  IntakeStatus,
  TaskPriority,
  WorkItemType,
  type IntakeRequest,
  type ProjectDetail,
  type PublicUser,
} from '@org/types';
import { cn } from '@org/utils';
import {
  ArrowRight,
  Bot,
  Inbox,
  Mail,
  MessageSquare,
  Plus,
  User,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { PriorityIcon } from '../kanban/kanban-icons.js';

interface IntakeTriageViewProps {
  intakeRequests: IntakeRequest[];
  projects: ProjectDetail[];
  members: PublicUser[];
  onConvert: (
    intakeId: string,
    input: {
      projectId: string;
      title?: string;
      type?: WorkItemType;
      priority?: TaskPriority;
      assigneeId?: string;
    },
  ) => void;
  onDecline: (intakeId: string) => void;
  onCreateIntake: (input: {
    title: string;
    description?: string;
    source?: IntakeSource;
    requesterName?: string;
    requesterEmail?: string;
    priority?: TaskPriority;
  }) => void;
}

export function IntakeTriageView({
  intakeRequests,
  projects,
  members,
  onConvert,
  onDecline,
  onCreateIntake,
}: IntakeTriageViewProps) {
  const [selectedIntake, setSelectedIntake] = useState<IntakeRequest | null>(
    null,
  );
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [targetType, setTargetType] = useState<WorkItemType>(
    WorkItemType.REQUEST,
  );
  const [targetPriority, setTargetPriority] = useState<TaskPriority>(
    TaskPriority.MEDIUM,
  );
  const [targetAssignee, setTargetAssignee] = useState<string | undefined>(
    undefined,
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRequester, setNewRequester] = useState('');
  const [newSource, setNewSource] = useState<IntakeSource>(IntakeSource.USER);

  const [filterStatus, setFilterStatus] = useState<string>('PENDING');

  const filteredRequests = intakeRequests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  const handleOpenConvert = (item: IntakeRequest) => {
    setSelectedIntake(item);
    setTargetProjectId(item.projectId || projects[0]?.id || '');
    setTargetPriority(item.priority as TaskPriority);
    setIsConvertOpen(true);
  };

  const handleExecuteConvert = () => {
    if (!selectedIntake || !targetProjectId) return;
    onConvert(selectedIntake.id, {
      projectId: targetProjectId,
      type: targetType,
      priority: targetPriority,
      assigneeId: targetAssignee,
    });
    setIsConvertOpen(false);
    setSelectedIntake(null);
  };

  const handleCreateSubmit = () => {
    if (!newTitle.trim()) return;
    onCreateIntake({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      requesterName: newRequester.trim() || undefined,
      source: newSource,
    });
    setIsCreateOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewRequester('');
  };

  const renderSourceIcon = (source: IntakeSource) => {
    switch (source) {
      case IntakeSource.EMAIL:
        return <Mail className="size-3.5 text-accent-blue" />;
      case IntakeSource.SLACK:
        return <MessageSquare className="size-3.5 text-accent-violet" />;
      case IntakeSource.AI_AGENT:
        return <Bot className="size-3.5 text-accent-amber" />;
      default:
        return <User className="size-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="gap-6 p-4 flex h-full w-full flex-col overflow-y-auto">
      {/* Header Bar */}
      <div className="sm:flex-row sm:items-center gap-3 flex flex-col justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Intake</h2>
          <p className="text-xs mt-0.5 text-muted-foreground">
            Review incoming requests and turn the right ones into tasks.
          </p>
        </div>

        <div className="gap-2 flex items-center">
          {/* Status Filter */}
          <div className="gap-1 p-1 flex items-center rounded-xl border border-border/50 bg-muted/60">
            {['PENDING', 'CONVERTED', 'DECLINED', 'ALL'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold cursor-pointer rounded-lg capitalize transition-all',
                  filterStatus === st
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            New request
          </Button>
        </div>
      </div>

      {/* Requests Feed */}
      <div className="gap-3 flex flex-col">
        {filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={
              filterStatus === 'PENDING'
                ? 'Nothing waiting for review'
                : 'No requests here'
            }
            description="New requests appear here until someone accepts or declines them."
          />
        ) : (
          filteredRequests.map((item) => (
            <Card
              key={item.id}
              className="border border-border/60 bg-card/80 shadow-xs transition-all hover:border-primary/40"
            >
              <CardContent className="p-4 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="flex-1">
                  <div className="gap-2 mb-1.5 flex flex-wrap items-center">
                    <span className="gap-1 font-medium px-2 py-0.5 rounded inline-flex items-center border border-border/50 bg-muted/80 text-[11px]">
                      {renderSourceIcon(item.source)}
                      <span className="capitalize">
                        {item.source.toLowerCase()}
                      </span>
                    </span>

                    <span className="gap-1 inline-flex items-center text-[11px]">
                      <PriorityIcon
                        priority={item.priority as TaskPriority}
                        className="size-3.5"
                      />
                      <span className="text-muted-foreground capitalize">
                        {item.priority.toLowerCase()}
                      </span>
                    </span>

                    <span
                      className={cn(
                        'font-bold px-2 py-0.5 rounded-full border text-[10px] uppercase',
                        item.status === IntakeStatus.PENDING &&
                          'border-accent-amber/30 bg-accent-amber-soft text-accent-amber',
                        item.status === IntakeStatus.CONVERTED &&
                          'border-accent-green/30 bg-accent-green-soft text-accent-green',
                        item.status === IntakeStatus.DECLINED &&
                          'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {item.status}
                    </span>

                    {item.requesterName && (
                      <span className="text-xs text-muted-foreground">
                        by {item.requesterName}
                      </span>
                    )}

                    <span className="text-[11px] text-muted-foreground/60">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {item.status === IntakeStatus.PENDING && (
                  <div className="gap-2 flex shrink-0 items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDecline(item.id)}
                      className="text-xs gap-1 text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="size-3.5" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenConvert(item)}
                      className="text-xs gap-1.5"
                    >
                      Convert to task
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Convert to Work Item Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to task</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-3 flex flex-col">
            <div>
              <label className="text-xs font-semibold mb-1 block">
                Project
              </label>
              <Select
                value={targetProjectId}
                onValueChange={(val) => setTargetProjectId(val)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select target project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="gap-2 flex items-center">
                        <ProjectGlyph
                          icon={p.icon}
                          iconColor={p.iconColor}
                          color={p.color}
                          size="xs"
                        />
                        {p.name} ({p.ticketPrefix || 'PRJ'})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="gap-2 grid grid-cols-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Type</label>
                <Select
                  value={targetType}
                  onValueChange={(val) => setTargetType(val as WorkItemType)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(WorkItemType).map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="capitalize">{t.toLowerCase()}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">
                  Priority
                </label>
                <Select
                  value={targetPriority}
                  onValueChange={(val) =>
                    setTargetPriority(val as TaskPriority)
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskPriority).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="capitalize">{p.toLowerCase()}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block">
                Assignee
              </label>
              <Select
                value={targetAssignee || 'unassigned'}
                onValueChange={(val) =>
                  setTargetAssignee(val === 'unassigned' ? undefined : val)
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName || m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecuteConvert} disabled={!targetProjectId}>
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Request Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New request</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-3 flex flex-col">
            <div>
              <label className="text-xs font-semibold mb-1 block">Title</label>
              <Input
                placeholder="Brief summary of the request"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">
                Description
              </label>
              <Textarea
                rows={3}
                placeholder="Full details, repro steps or requirements"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="gap-2 grid grid-cols-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">
                  Requester
                </label>
                <Input
                  placeholder="e.g. John Doe"
                  value={newRequester}
                  onChange={(e) => setNewRequester(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">
                  Source
                </label>
                <Select
                  value={newSource}
                  onValueChange={(val) => setNewSource(val as IntakeSource)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(IntakeSource).map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="capitalize">{s.toLowerCase()}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!newTitle.trim()}>
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
