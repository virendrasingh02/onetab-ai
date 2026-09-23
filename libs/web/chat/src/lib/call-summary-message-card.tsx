import { Badge, Button, Card, Dialog, DialogContent } from '@org/ui';
import { cn } from '@org/utils';
import { CheckCircle2, Clock, FileText, ListTodo, PhoneCall, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { CallSummaryView } from './call-summary-view.js';
import { useCall, useCallSummary } from './use-calls.js';

export interface CallSummaryMessageCardProps {
  workspaceId: string;
  callId: string;
  title?: string;
  durationSeconds?: number;
  participantsCount?: number;
  onViewSummary?: () => void;
  className?: string;
}

export function CallSummaryMessageCard({
  workspaceId,
  callId,
  title,
  durationSeconds,
  participantsCount,
  onViewSummary,
  className,
}: CallSummaryMessageCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: call } = useCall(workspaceId, callId);
  const { data: summary } = useCallSummary(workspaceId, callId);

  const displayTitle = title || call?.title || 'Team Call';

  // Compute duration from timestamps if not provided as a prop
  const computedDuration = call
    ? call.endedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : 0
    : 0;
  const effectiveDuration = durationSeconds ?? computedDuration;
  const effectiveParticipants = participantsCount ?? call?.participants?.length ?? 1;
  const notesCount = call?._count?.notes ?? 0;
  const actionItemsCount = call?._count?.actionItems ?? 0;
  const decisionsCount = call?._count?.decisions ?? 0;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOpen = () => {
    if (onViewSummary) {
      onViewSummary();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <Card
        className={cn(
          'p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3.5 max-w-md shadow-sm hover:border-border transition-all select-none',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <PhoneCall className="size-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-foreground truncate">
                {displayTitle}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDuration(effectiveDuration)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="size-3" />
                  {effectiveParticipants} {effectiveParticipants === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>

          <Badge variant="outline" className="text-[10px] gap-1 border-primary/20 text-primary shrink-0">
            <Sparkles className="size-2.5 text-primary" />
            AI Summary
          </Badge>
        </div>

        {/* Highlights Preview if summary exists */}
        {summary?.overview ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic bg-muted/20 p-2 rounded-lg">
            "{summary.overview}"
          </p>
        ) : null}

        {/* Stats Pills */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground overflow-x-auto scrollbar-none">
          {actionItemsCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              <ListTodo className="size-3" />
              {actionItemsCount} Action {actionItemsCount === 1 ? 'Item' : 'Items'}
            </span>
          )}
          {decisionsCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
              <CheckCircle2 className="size-3" />
              {decisionsCount} {decisionsCount === 1 ? 'Decision' : 'Decisions'}
            </span>
          )}
          {notesCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <FileText className="size-3" />
              {notesCount} {notesCount === 1 ? 'Note' : 'Notes'}
            </span>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-1 flex items-center justify-between gap-2 border-t border-border/50">
          <Button
            size="sm"
            onClick={handleOpen}
            className="w-full gap-1.5 text-xs h-8"
          >
            <Sparkles className="size-3.5" />
            View AI Call Summary & Notes
          </Button>
        </div>
      </Card>

      {/* Embedded Summary Dialog */}
      {!onViewSummary && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border shadow-2xl">
            <CallSummaryView
              workspaceId={workspaceId}
              callId={callId}
              onClose={() => setIsOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
