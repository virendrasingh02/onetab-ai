import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  HEALTHY: 'On track',
  AT_RISK: 'At risk',
  OFF_TRACK: 'Off track',
  COMPLETED: 'Completed',
};

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
    <div className="gap-6 p-4 max-w-4xl mx-auto flex h-full w-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Updates</h2>
          <p className="text-xs mt-0.5 text-muted-foreground">
            Progress and blockers for {projectName}. Publishing sets the
            project's health.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsPublishOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Publish update
        </Button>
      </div>

      {/* Updates Stream */}
      <div className="gap-4 flex flex-col">
        {updates.length === 0 ? (
          <EmptyState
            icon={<HeartPulse />}
            title="No updates yet"
            description="Share where the project stands so everyone sees the same picture."
          />
        ) : (
          updates.map((up) => (
            <Card
              key={up.id}
              className="overflow-hidden border border-border/60 bg-card/80 shadow-xs"
            >
              <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/40 bg-muted/20">
                <div className="gap-3 flex items-center">
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
                    <div className="gap-2 flex items-center">
                      <span className="text-xs font-bold text-foreground">
                        {up.author?.displayName ||
                          up.author?.name ||
                          'Team Member'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(up.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold mt-0.5 text-foreground">
                      {up.title}
                    </CardTitle>
                  </div>
                </div>

                <span
                  className={cn(
                    'font-semibold px-2.5 py-0.5 rounded-full border text-[10px]',
                    up.status === ProjectHealth.HEALTHY &&
                      'border-accent-green/30 bg-accent-green-soft text-accent-green',
                    up.status === ProjectHealth.AT_RISK &&
                      'border-accent-amber/30 bg-accent-amber-soft text-accent-amber',
                    up.status === ProjectHealth.OFF_TRACK &&
                      'border-destructive/30 bg-destructive/10 text-destructive',
                    up.status === ProjectHealth.COMPLETED &&
                      'border-accent-blue/30 bg-accent-blue-soft text-accent-blue',
                  )}
                >
                  {HEALTH_LABELS[up.status]}
                </span>
              </CardHeader>

              <CardContent className="p-4 gap-3 text-xs flex flex-col">
                {up.body && (
                  <p className="leading-relaxed whitespace-pre-line text-muted-foreground">
                    {up.body}
                  </p>
                )}

                {/* 4 Pillars Breakdown */}
                <div className="sm:grid-cols-2 gap-3 pt-2 grid grid-cols-1">
                  {up.completedSummary && (
                    <div className="p-2.5 rounded-lg border border-accent-green/20 bg-accent-green/5">
                      <span className="font-bold gap-1 mb-1 flex items-center text-accent-green">
                        <CheckCircle2 className="size-3.5" />
                        Completed
                      </span>
                      <p className="text-muted-foreground">
                        {up.completedSummary}
                      </p>
                    </div>
                  )}

                  {up.inProgressSummary && (
                    <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5">
                      <span className="font-bold gap-1 mb-1 flex items-center text-primary">
                        <Clock className="size-3.5" />
                        In Progress
                      </span>
                      <p className="text-muted-foreground">
                        {up.inProgressSummary}
                      </p>
                    </div>
                  )}

                  {up.blockersSummary && (
                    <div className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/5">
                      <span className="font-bold gap-1 mb-1 flex items-center text-destructive">
                        <AlertTriangle className="size-3.5" />
                        Blockers / Risks
                      </span>
                      <p className="text-muted-foreground">
                        {up.blockersSummary}
                      </p>
                    </div>
                  )}

                  {up.nextStepsSummary && (
                    <div className="p-2.5 rounded-lg border border-accent-violet/20 bg-accent-violet/5">
                      <span className="font-bold gap-1 mb-1 flex items-center text-accent-violet">
                        <Sparkles className="size-3.5" />
                        Next Steps
                      </span>
                      <p className="text-muted-foreground">
                        {up.nextStepsSummary}
                      </p>
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
            <DialogTitle>Publish update</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-3 flex flex-col">
            <div className="gap-2 grid grid-cols-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold mb-1 block">
                  Title
                </label>
                <Input
                  placeholder="e.g. Sprint 24 Progress & Alpha Testing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">
                  Health
                </label>
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
                        {HEALTH_LABELS[h]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block">
                Summary
              </label>
              <Textarea
                rows={3}
                placeholder="High-level narrative of current project momentum"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="gap-2 grid grid-cols-2">
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

            <div className="gap-2 grid grid-cols-2">
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
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={!title.trim()}>
              Publish update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
