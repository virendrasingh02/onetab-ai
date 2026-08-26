import {
  Button,
  Card,
  CardContent,
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
  Textarea,
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
  const [selectedIntake, setSelectedIntake] = useState<IntakeRequest | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [targetType, setTargetType] = useState<WorkItemType>(WorkItemType.REQUEST);
  const [targetPriority, setTargetPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [targetAssignee, setTargetAssignee] = useState<string | undefined>(undefined);

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
    <div className="flex flex-col w-full h-full gap-6 p-4 overflow-y-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Inbox className="size-5 text-primary" />
            Intake & Triage Queue
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Capture, triage, and convert incoming requests from users, email, Slack, and AI agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
            {['PENDING', 'CONVERTED', 'DECLINED', 'ALL'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize cursor-pointer',
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
            New Request
          </Button>
        </div>
      </div>

      {/* Requests Feed */}
      <div className="flex flex-col gap-3">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No incoming requests found for this filter.
          </div>
        ) : (
          filteredRequests.map((item) => (
            <Card
              key={item.id}
              className="border border-border/60 bg-card/80 shadow-xs hover:border-primary/40 transition-all"
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted/80 px-2 py-0.5 rounded border border-border/50">
                      {renderSourceIcon(item.source)}
                      <span className="capitalize">{item.source.toLowerCase()}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px]">
                      <PriorityIcon priority={item.priority as TaskPriority} className="size-3.5" />
                      <span className="capitalize text-muted-foreground">
                        {item.priority.toLowerCase()}
                      </span>
                    </span>

                    <span
                      className={cn(
                        'text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border',
                        item.status === IntakeStatus.PENDING &&
                          'bg-accent-amber-soft text-accent-amber border-accent-amber/30',
                        item.status === IntakeStatus.CONVERTED &&
                          'bg-accent-green-soft text-accent-green border-accent-green/30',
                        item.status === IntakeStatus.DECLINED &&
                          'bg-muted text-muted-foreground border-border',
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

                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>

                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {item.status === IntakeStatus.PENDING && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDecline(item.id)}
                      className="text-xs text-muted-foreground hover:text-destructive gap-1"
                    >
                      <XCircle className="size-3.5" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenConvert(item)}
                      className="text-xs gap-1.5"
                    >
                      Convert to Issue
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
            <DialogTitle>Convert to Work Item</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block">Destination Project</label>
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
                      {p.name} ({p.ticketPrefix || 'PRJ'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Work Item Type</label>
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
                <label className="text-xs font-semibold mb-1 block">Priority</label>
                <Select
                  value={targetPriority}
                  onValueChange={(val) => setTargetPriority(val as TaskPriority)}
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
              <label className="text-xs font-semibold mb-1 block">Assignee</label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecuteConvert} disabled={!targetProjectId}>
              Confirm & Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Request Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>File Intake Request</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-semibold mb-1 block">Title</label>
              <Input
                placeholder="Brief summary of the request"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Description</label>
              <Textarea
                rows={3}
                placeholder="Full details, repro steps or requirements"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Requester Name</label>
                <Input
                  placeholder="e.g. John Doe"
                  value={newRequester}
                  onChange={(e) => setNewRequester(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Source</label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!newTitle.trim()}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
