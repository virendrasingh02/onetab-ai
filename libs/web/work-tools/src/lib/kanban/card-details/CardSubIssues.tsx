import type { Task } from '@org/types';
import { UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { ListTree, Plus, Sparkles, Unlink } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { StatusIcon } from '../kanban-icons.js';
import { ProgressBar, Section, SectionAction } from './primitives.js';

export interface CardSubIssuesProps {
  subIssues: Task[];
  canCreate: boolean;
  canEdit: boolean;
  aiBusy: boolean;
  canOpen: (taskId: string) => boolean;
  onOpen: (taskId: string) => void;
  onToggleDone: (task: Task) => void;
  onUnlink: (taskId: string) => void;
  onAdd: (title: string) => void;
  onBreakDown: () => void;
}

export function CardSubIssues({
  subIssues,
  canCreate,
  canEdit,
  aiBusy,
  canOpen,
  onOpen,
  onToggleDone,
  onUnlink,
  onAdd,
  onBreakDown,
}: CardSubIssuesProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const done = subIssues.filter((sub) => sub.status === 'DONE').length;

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const title = text.trim();
    if (!title) return;
    onAdd(title);
    setText('');
  };

  if (subIssues.length === 0 && !canCreate) return null;

  return (
    <Section
      title="Sub-issues"
      icon={ListTree}
      summary={subIssues.length > 0 ? `${done}/${subIssues.length}` : undefined}
      action={
        canCreate ? (
          <>
            {subIssues.length === 0 ? (
              <SectionAction
                icon={Sparkles}
                onClick={onBreakDown}
                disabled={aiBusy}
                className="text-accent-violet hover:text-accent-violet"
              >
                Break down
              </SectionAction>
            ) : null}
            <SectionAction icon={Plus} onClick={() => setAdding(true)}>
              Add sub-issue
            </SectionAction>
          </>
        ) : null
      }
    >
      {subIssues.length > 0 || adding ? (
        <div>
          <ProgressBar done={done} total={subIssues.length} />
          {subIssues.map((sub) => {
            const isDone = sub.status === 'DONE';
            const openable = canOpen(sub.id);
            return (
              <div
                key={sub.id}
                className="group min-h-8 gap-2 px-1 flex items-center rounded-md transition-colors hover:bg-accent/40"
              >
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onToggleDone(sub)}
                  aria-label={
                    isDone
                      ? `Mark ${sub.title} as not done`
                      : `Mark ${sub.title} as done`
                  }
                  className="size-4 grid shrink-0 place-items-center"
                >
                  <StatusIcon
                    status={sub.status}
                    className="size-3.5"
                    showTooltip={false}
                  />
                </button>
                <button
                  type="button"
                  disabled={!openable}
                  onClick={() => onOpen(sub.id)}
                  className="min-w-0 gap-2 text-sm flex flex-1 items-center text-left disabled:cursor-default"
                >
                  {sub.identifier ? (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {sub.identifier}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'truncate',
                      isDone && 'text-muted-foreground line-through',
                      openable && 'group-hover:underline',
                    )}
                  >
                    {sub.title}
                  </span>
                </button>
                {sub.assignee ? (
                  <UserAvatar
                    name={sub.assignee.displayName ?? sub.assignee.name}
                    seed={sub.assignee.id}
                    src={sub.assignee.avatarUrl ?? undefined}
                    size="xs"
                  />
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onUnlink(sub.id)}
                    aria-label={`Detach ${sub.title} from this task`}
                    title="Detach from this task"
                    className="rounded p-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                  >
                    <Unlink className="size-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
          {adding ? (
            <form onSubmit={handleAdd} className="gap-2 px-1 flex items-center">
              <Plus
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                autoFocus
                value={text}
                maxLength={200}
                aria-label="New sub-issue title"
                placeholder="Sub-issue title, then Enter"
                onChange={(event) => setText(event.target.value)}
                onBlur={() => {
                  if (!text.trim()) setAdding(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setText('');
                    setAdding(false);
                  }
                }}
                className="h-8 min-w-0 text-sm flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
