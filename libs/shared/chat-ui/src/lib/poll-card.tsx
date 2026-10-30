import type { MessagePoll } from '@org/types';
import { Button, Hint } from '@org/ui';
import { cn } from '@org/utils';
import { Check, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface PollCardProps {
  poll: MessagePoll;
  /** The viewer posted the poll — only they can end it early. */
  isOwn: boolean;
  /** Casts or changes the viewer's vote; an empty list withdraws it. Omit for a read-only card. */
  onVote?: (answerIds: string[]) => void | Promise<void>;
  onEnd?: () => void | Promise<void>;
  /** Resolves a voter id to a display name, for the per-answer voter hint. */
  resolveName?: (userId: string) => string;
}

/** "23h left", "3d left", "5m left" — the coarsest unit that is not zero. */
export function formatPollTimeLeft(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'Less than a minute left';
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

/** Re-renders once a minute so "time left" and expiry stay current. */
function useMinuteClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** The poll as it will look once the viewer's pending vote lands. */
function withLocalVote(poll: MessagePoll, answerIds: string[]): MessagePoll {
  const before = new Set(poll.myAnswerIds);
  const after = new Set(answerIds);
  return {
    ...poll,
    myAnswerIds: answerIds,
    totalVoters:
      poll.totalVoters - (before.size > 0 ? 1 : 0) + (after.size > 0 ? 1 : 0),
    answers: poll.answers.map((answer) => ({
      ...answer,
      votes:
        answer.votes -
        (before.has(answer.id) ? 1 : 0) +
        (after.has(answer.id) ? 1 : 0),
    })),
  };
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * A poll in the timeline: pick an answer (or several), Vote, then see the
 * results. Results are also a click away before voting, and always shown once
 * the poll has closed — with the leading answer marked.
 */
export function PollCard({
  poll: serverPoll,
  isOwn,
  onVote,
  onEnd,
  resolveName,
}: PollCardProps) {
  // Optimistic vote: shown until the tally from the server agrees with it.
  const [pendingVote, setPendingVote] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [peeking, setPeeking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pendingVote && sameIds(pendingVote, serverPoll.myAnswerIds))
      setPendingVote(null);
  }, [pendingVote, serverPoll.myAnswerIds]);

  const poll = pendingVote
    ? withLocalVote(serverPoll, pendingVote)
    : serverPoll;
  const now = useMinuteClock(!poll.closedAt);
  const closed = !!poll.closedAt || now >= poll.endsAt;
  const hasVoted = poll.myAnswerIds.length > 0;
  const canVote = !!onVote && !closed;
  const showResults = closed || (hasVoted && !changing) || peeking || !onVote;
  const multi = poll.maxSelections > 1;

  const topVotes = useMemo(
    () => Math.max(0, ...poll.answers.map((answer) => answer.votes)),
    [poll.answers],
  );

  const toggle = (id: string) => {
    if (!canVote || showResults) return;
    setSelected((current) => {
      if (current.includes(id))
        return current.filter((existing) => existing !== id);
      if (!multi) return [id];
      return current.length >= poll.maxSelections ? current : [...current, id];
    });
  };

  const submit = async (answerIds: string[]) => {
    if (!onVote) return;
    setBusy(true);
    setPendingVote(answerIds);
    try {
      await onVote(answerIds);
      setChanging(false);
      setPeeking(false);
      setSelected([]);
    } catch {
      setPendingVote(null);
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!onEnd) return;
    setBusy(true);
    try {
      await onEnd();
    } finally {
      setBusy(false);
    }
  };

  const instruction = closed
    ? 'Poll closed'
    : multi
      ? poll.maxSelections >= poll.answers.length
        ? 'Select one or more answers'
        : `Select up to ${poll.maxSelections} answers`
      : 'Select one answer';

  return (
    <div
      role="group"
      aria-label={`Poll: ${poll.question}`}
      className="mt-1 max-w-md p-4 w-full rounded-xl border border-border bg-surface shadow-xs"
    >
      <p className="text-sm font-semibold break-words text-foreground">
        {poll.question}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{instruction}</p>

      <div
        className="mt-3 space-y-2"
        role={showResults ? 'list' : multi ? 'group' : 'radiogroup'}
      >
        {poll.answers.map((answer) => {
          const isSelected = selected.includes(answer.id);
          const isMine = poll.myAnswerIds.includes(answer.id);
          const percent =
            poll.totalVoters > 0
              ? Math.round((answer.votes / poll.totalVoters) * 100)
              : 0;
          const isWinner = closed && topVotes > 0 && answer.votes === topVotes;
          const voters = resolveName
            ? answer.voterIds.slice(0, 10).map(resolveName).join(', ') +
              (answer.voterIds.length > 10
                ? ` and ${answer.voterIds.length - 10} more`
                : '')
            : '';

          if (showResults) {
            const row = (
              <div
                role="listitem"
                className={cn(
                  'px-3 py-2.5 relative overflow-hidden rounded-lg border',
                  isMine ? 'border-primary/50' : 'border-border',
                  'bg-surface-raised',
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'inset-y-0 left-0 ease-out absolute transition-[width] duration-500',
                    isMine || isWinner
                      ? 'bg-primary/15'
                      : 'bg-foreground/[0.06]',
                  )}
                  style={{ width: `${percent}%` }}
                />
                <div className="gap-3 relative flex items-center justify-between">
                  <span className="gap-2 min-w-0 text-sm font-medium flex items-center text-foreground">
                    {answer.emoji ? (
                      <span aria-hidden>{answer.emoji}</span>
                    ) : null}
                    <span className="truncate">{answer.text}</span>
                    {isWinner ? (
                      <Trophy
                        className="size-3.5 shrink-0 text-warning-text"
                        aria-label="Top answer"
                      />
                    ) : null}
                    {isMine ? (
                      <Check
                        className="size-3.5 shrink-0 text-primary-text"
                        aria-label="Your vote"
                      />
                    ) : null}
                  </span>
                  <span className="gap-2 text-xs flex shrink-0 items-center text-muted-foreground tabular-nums">
                    <span>
                      {answer.votes} {answer.votes === 1 ? 'vote' : 'votes'}
                    </span>
                    <span className="w-9 font-semibold text-right text-foreground">
                      {percent}%
                    </span>
                  </span>
                </div>
              </div>
            );
            return voters ? (
              <Hint key={answer.id} label={voters}>
                {row}
              </Hint>
            ) : (
              <div key={answer.id}>{row}</div>
            );
          }

          return (
            <button
              key={answer.id}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              disabled={!canVote || busy}
              onClick={() => toggle(answer.id)}
              className={cn(
                'gap-3 px-3 py-2.5 text-sm font-medium flex w-full items-center justify-between rounded-lg border text-left transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-surface-raised text-foreground hover:border-border-strong hover:bg-accent',
                'disabled:cursor-not-allowed disabled:opacity-70',
              )}
            >
              <span className="gap-2 min-w-0 flex items-center">
                {answer.emoji ? <span aria-hidden>{answer.emoji}</span> : null}
                <span className="truncate">{answer.text}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'size-5 flex shrink-0 items-center justify-center border-2 transition-colors',
                  multi ? 'rounded-md' : 'rounded-full',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/50',
                )}
              >
                {isSelected ? <Check className="size-3 stroke-[3]" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 gap-2 flex flex-wrap items-center justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">
            {poll.totalVoters} {poll.totalVoters === 1 ? 'vote' : 'votes'}
          </span>
          <span aria-hidden> · </span>
          {closed ? 'Final results' : formatPollTimeLeft(poll.endsAt - now)}
        </p>

        {canVote ? (
          <div className="gap-1.5 flex items-center">
            {showResults ? (
              <>
                {peeking && !hasVoted ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPeeking(false)}
                  >
                    Back to vote
                  </Button>
                ) : null}
                {hasVoted ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void submit([])}
                    >
                      Remove vote
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setSelected(poll.myAnswerIds);
                        setChanging(true);
                      }}
                    >
                      Change vote
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {changing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setChanging(false);
                      setSelected([]);
                    }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPeeking(true)}
                  >
                    Show results
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={
                    selected.length === 0 || sameIds(selected, poll.myAnswerIds)
                  }
                  loading={busy}
                  onClick={() => void submit(selected)}
                >
                  Vote
                </Button>
              </>
            )}
            {isOwn && onEnd ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void end()}
              >
                End poll
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
