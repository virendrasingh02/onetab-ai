import { aiApi } from '@org/api-client';
import { Button, IconButton, KbdShortcut, Spinner, toast } from '@org/ui';
import { cn } from '@org/utils';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { EMPTY_FILTER, type BoardFilter } from './card-meta.js';

export interface SmartFilterBarProps {
  workspaceId: string | undefined;
  filter: BoardFilter;
  setFilter: Dispatch<SetStateAction<BoardFilter>>;
  /** The board's columns, as the server should name them. */
  statuses: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  milestones: string[];
  onClose: () => void;
}

const SUGGESTIONS = [
  'Assigned to me',
  'Overdue',
  'Urgent or high priority',
  'Due this week',
];

/**
 * Ask for tasks in plain words. The API turns the sentence into the same
 * facets the Filter menu sets, so the result shows up as ordinary filter chips
 * a person can adjust or clear one by one.
 */
export function SmartFilterBar({
  workspaceId,
  filter,
  setFilter,
  statuses,
  members,
  milestones,
  onClose,
}: SmartFilterBarProps) {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  const run = async (text: string) => {
    const value = text.trim();
    if (!value || !workspaceId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    try {
      const result = await aiApi.taskFilter(
        workspaceId,
        { prompt: value, statuses, members, milestones },
        controller.signal,
      );
      // A smart filter replaces the facets; the search box is the user's own.
      setFilter((prev) => ({
        ...EMPTY_FILTER,
        query: prev.query,
        status: result.status,
        priorities: result.priorities,
        memberIds: result.memberIds,
        due: result.due,
        milestones: result.milestones,
        aiQuery: result.keywords.join(' '),
        aiPrompt: value,
        aiSummary: result.summary,
      }));
      setPrompt(value);
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(
        error instanceof Error ? error.message : 'Smart filter failed. Try again.',
      );
    } finally {
      if (abortRef.current === controller) setPending(false);
    }
  };

  const applied = Boolean(filter.aiSummary);

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(prompt);
        }}
        className={cn(
          'gap-2 pl-3 pr-1 flex h-9 items-center rounded-lg border border-border bg-surface shadow-xs transition-colors',
          'focus-within:border-accent-violet/60 focus-within:ring-2 focus-within:ring-accent-violet/15',
        )}
      >
        <Sparkles className="size-4 shrink-0 text-accent-violet" aria-hidden />
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          maxLength={300}
          placeholder="Describe the tasks you want, e.g. urgent bugs assigned to me due this week"
          aria-label="Smart filter"
          className="min-w-0 flex-1 bg-transparent text-body-sm text-foreground outline-none placeholder:text-subtle"
        />
        {pending ? (
          <Spinner className="size-4 mr-2 text-muted-foreground" label="Filtering" />
        ) : prompt.trim() ? (
          <IconButton
            type="submit"
            size="icon-sm"
            variant="default"
            aria-label="Apply smart filter"
            title="Apply (Enter)"
          >
            <ArrowUp className="size-4" />
          </IconButton>
        ) : (
          <KbdShortcut keys={['Esc']} size="xs" variant="muted" className="mr-1.5" />
        )}
        <IconButton
          type="button"
          size="icon-sm"
          aria-label="Close smart filter"
          title="Close (Esc)"
          onClick={onClose}
        >
          <X className="size-4" />
        </IconButton>
      </form>

      {!applied && !prompt.trim() ? (
        <div className="gap-1.5 flex flex-wrap items-center">
          <span className="text-xs text-muted-foreground">Try</span>
          {SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => {
                setPrompt(suggestion);
                void run(suggestion);
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
