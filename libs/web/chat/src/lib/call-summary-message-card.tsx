import { Badge, Button, Card, Dialog, DialogContent } from '@org/ui';
import { cn } from '@org/utils';
import { CheckCircle2, Clock, FileText, ListTodo, PhoneCall, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { CallSummaryView } from './call-summary-view.js';
import { useCallDetail, useCallSummary } from './use-calls.js';

export interface CallSummaryMessageCardProps {
  workspaceId: string;
  callId: string;
  title?: string;
  durationSeconds?: number;
  participantsCount?: number;
  onViewSummary?: () => void;
  className?: string;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * The card a finished call leaves in its conversation. Anyone who cannot see
 * the call (it was a DM they were not on) gets the card's own facts only —
 * the detail query 404s and the counts simply stay hidden.
 */
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
  const detail = useCallDetail(workspaceId, callId);
  const call = detail.data;
  const { data: summary } = useCallSummary(workspaceId, callId);

  const displayTitle = title || call?.title || 'Call';
  const measuredDuration =
    call?.endedAt != null
      ? Math.round((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000)
      : 0;
  const duration = durationSeconds ?? measuredDuration;
  const people = participantsCount ?? call?.participants.length ?? 0;
  const noteCount = call?.notes.filter((note) => note.content.trim()).length ?? 0;
  const actionCount = call?.actionItems.length ?? 0;
  const decisionCount = call?.decisions.length ?? 0;
  const generating = summary?.status === 'PROCESSING';

  const handleOpen = () => {
    if (onViewSummary) onViewSummary();
    else setIsOpen(true);
  };

  return (
    <>
      <Card
        className={cn(
          'p-4 rounded-2xl border border-border bg-surface space-y-3 max-w-md shadow-xs transition-colors hover:border-border-strong',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary-text shrink-0">
              <PhoneCall className="size-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-foreground truncate">{displayTitle}</h4>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <Clock className="size-3" />
                  {formatDuration(duration)}
                </span>
                {people > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {people} {people === 1 ? 'person' : 'people'}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <Badge variant={generating ? 'neutral' : 'primary'} className="shrink-0">
            <Sparkles />
            {generating ? 'Summarizing…' : 'AI summary'}
          </Badge>
        </div>

        {summary?.overview && !generating ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {summary.overview}
          </p>
        ) : null}

        {actionCount + decisionCount + noteCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {actionCount > 0 && (
              <Badge variant="primary">
                <ListTodo />
                {actionCount} action {actionCount === 1 ? 'item' : 'items'}
              </Badge>
            )}
            {decisionCount > 0 && (
              <Badge variant="success">
                <CheckCircle2 />
                {decisionCount} {decisionCount === 1 ? 'decision' : 'decisions'}
              </Badge>
            )}
            {noteCount > 0 && (
              <Badge variant="neutral">
                <FileText />
                {noteCount} {noteCount === 1 ? 'note' : 'notes'}
              </Badge>
            )}
          </div>
        ) : null}

        <Button
          size="sm"
          variant="secondary"
          onClick={handleOpen}
          disabled={!call}
          className="w-full gap-1.5 text-xs h-8"
        >
          <Sparkles className="size-3.5" />
          {call
            ? 'View notes & summary'
            : detail.isError
              ? 'Only people on the call can open it'
              : 'Loading…'}
        </Button>
      </Card>

      {!onViewSummary && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border shadow-overlay">
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
