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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  UserAvatar,
} from '@org/ui';
import { ProjectHealth, type ProjectUpdate } from '@org/types';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HeartPulse,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

interface ProjectUpdatesViewProps {
  projectId: string;
  projectName: string;
  updates: ProjectUpdate[];
  onPublishUpdate: (input: {
    projectId: string;
    status: ProjectHealth;
    title: string;
    body?: string;
    completedSummary?: string;
    inProgressSummary?: string;
    blockersSummary?: string;
    nextStepsSummary?: string;
  }) => void;
}

export function ProjectUpdatesView({
  projectId,
  projectName,
  updates,
  onPublishUpdate,
}: ProjectUpdatesViewProps) {
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [status, setStatus] = useState<ProjectHealth>(ProjectHealth.HEALTHY);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [completedSummary, setCompletedSummary] = useState('');
  const [inProgressSummary, setInProgressSummary] = useState('');
  const [blockersSummary, setBlockersSummary] = useState('');
  const [nextStepsSummary, setNextStepsSummary] = useState('');

  const handlePublish = () => {
    if (!title.trim()) return;
    onPublishUpdate({
      projectId,
      status,
      title: title.trim(),
      body: body.trim() || undefined,
      completedSummary: completedSummary.trim() || undefined,
      inProgressSummary: inProgressSummary.trim() || undefined,
      blockersSummary: blockersSummary.trim() || undefined,
      nextStepsSummary: nextStepsSummary.trim() || undefined,
    });
    setIsPublishOpen(false);
    setTitle('');
    setBody('');
    setCompletedSummary('');
    setInProgressSummary('');
    setBlockersSummary('');
    setNextStepsSummary('');
  };

  return (
    <div className="flex flex-col w-full h-full gap-6 p-4 overflow-y-auto max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <HeartPulse className="size-5 text-primary" />
            Project Health & Status Updates
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly summaries, blockers, and milestone progress for {projectName}.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsPublishOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Publish Update
        </Button>
      </div>

      {/* Updates Stream */}
      <div className="flex flex-col gap-4">
        {updates.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No status updates published yet. Keep the team informed by publishing an update.
          </div>
        ) : (
          updates.map((up) => (
            <Card
              key={up.id}
              className="border border-border/60 bg-card/80 shadow-xs overflow-hidden"
            >
              <CardHeader className="p-4 pb-3 bg-muted/20 border-b border-border/40 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  {up.author && (
                    <UserAvatar
                      name={up.author.displayName || up.author.name}
                      seed={up.author.id}
                      src={up.author.avatarUrl}
                      size="sm"
                      className="size-7"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {up.author?.displayName || up.author?.name || 'Team Member'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(up.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold text-foreground mt-0.5">
                      {up.title}
                    </CardTitle>
                  </div>
                </div>

                <span
                  className={cn(
                    'text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase',
                    up.status === ProjectHealth.HEALTHY &&
                      'bg-accent-green-soft text-accent-green border-accent-green/30',
                    up.status === ProjectHealth.AT_RISK &&
                      'bg-accent-amber-soft text-accent-amber border-accent-amber/30',
                    up.status === ProjectHealth.OFF_TRACK &&
                      'bg-destructive/10 text-destructive border-destructive/30',
                    up.status === ProjectHealth.COMPLETED &&
                      'bg-accent-blue-soft text-accent-blue border-accent-blue/30',
                  )}
                >
                  {up.status}
                </span>
              </CardHeader>

              <CardContent className="p-4 flex flex-col gap-3 text-xs">
                {up.body && (
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {up.body}
                  </p>
                )}

                {/* 4 Pillars Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {up.completedSummary && (
                    <div className="p-2.5 rounded-lg bg-accent-green/5 border border-accent-green/20">
                      <span className="font-bold text-accent-green flex items-center gap-1 mb-1">
                        <CheckCircle2 className="size-3.5" />
                        Completed
                      </span>
                      <p className="text-muted-foreground">{up.completedSummary}</p>
                    </div>
                  )}

                  {up.inProgressSummary && (
                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="font-bold text-primary flex items-center gap-1 mb-1">
                        <Clock className="size-3.5" />
                        In Progress
                      </span>
                      <p className="text-muted-foreground">{up.inProgressSummary}</p>
                    </div>
                  )}

                  {up.blockersSummary && (
                    <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                      <span className="font-bold text-destructive flex items-center gap-1 mb-1">
                        <AlertTriangle className="size-3.5" />
                        Blockers / Risks
                      </span>
                      <p className="text-muted-foreground">{up.blockersSummary}</p>
                    </div>
                  )}

                  {up.nextStepsSummary && (
                    <div className="p-2.5 rounded-lg bg-accent-violet/5 border border-accent-violet/20">
                      <span className="font-bold text-accent-violet flex items-center gap-1 mb-1">
                        <Sparkles className="size-3.5" />
                        Next Steps
                      </span>
                      <p className="text-muted-foreground">{up.nextStepsSummary}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Publish Update Dialog */}
      <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish Status Update</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-semibold mb-1 block">Update Title</label>
                <Input
                  placeholder="e.g. Sprint 24 Progress & Alpha Testing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Health State</label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as ProjectHealth)}
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
              <label className="text-xs font-semibold mb-1 block">General Overview</label>
              <Textarea
                rows={3}
                placeholder="High-level narrative of current project momentum"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold mb-1 block text-accent-green">
                  Completed Highlights
                </label>
                <Textarea
                  rows={2}
                  placeholder="Key deliverables finished"
                  value={completedSummary}
                  onChange={(e) => setCompletedSummary(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block text-primary">
                  In Progress
                </label>
                <Textarea
                  rows={2}
                  placeholder="Current active work"
                  value={inProgressSummary}
                  onChange={(e) => setInProgressSummary(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold mb-1 block text-destructive">
                  Blockers & Risks
                </label>
                <Textarea
                  rows={2}
                  placeholder="Any roadblocks or delays"
                  value={blockersSummary}
                  onChange={(e) => setBlockersSummary(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block text-accent-violet">
                  Next Steps
                </label>
                <Textarea
                  rows={2}
                  placeholder="Upcoming priorities"
                  value={nextStepsSummary}
                  onChange={(e) => setNextStepsSummary(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={!title.trim()}>
              Publish Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
