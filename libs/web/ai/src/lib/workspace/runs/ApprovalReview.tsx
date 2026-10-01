import { MarkdownMessage } from '@org/chat-ui';
import type { AIApprovalRequest } from '@org/types';
import { Badge, Button, Checkbox, SegmentedControl, Textarea } from '@org/ui';
import { formatRelative } from '@org/utils';
import { Check, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDecideApproval } from '../use-ai-workspace.js';

interface ReviewDescriptor {
  path: string;
  label: string;
  value: string;
}

interface DraftTask {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string | null;
}

/** A reviewed value that is a list of tasks (a "create these tasks" step). */
function parseTaskDraft(value: string): DraftTask[] | null {
  try {
    const parsed = JSON.parse(value.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((t) => t && typeof t === 'object' && typeof t.title === 'string')) {
      return parsed as DraftTask[];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * An approval an agent paused on, with what it is asking to do and — when a
 * draft comes before it — the draft itself, which the approver can edit (or,
 * for a list of tasks, trim) before approving. The edit is what the rest of
 * the run uses.
 */
export function ApprovalReview({
  workspaceId,
  approval,
  compact = false,
}: {
  workspaceId: string | undefined;
  approval: AIApprovalRequest;
  compact?: boolean;
}) {
  const decide = useDecideApproval(workspaceId);
  const review = approval.proposedPayload?.['__review'] as ReviewDescriptor | undefined;
  const taskDraft = useMemo(() => (review ? parseTaskDraft(review.value) : null), [review]);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [text, setText] = useState(review?.value ?? '');
  const [kept, setKept] = useState<boolean[]>(() => taskDraft?.map(() => true) ?? []);
  const [comment, setComment] = useState('');
  const edited = review ? (taskDraft ? kept.some((k) => !k) : text !== review.value) : false;
  const canDecide = approval.canDecide !== false;

  const submit = (decision: 'APPROVED' | 'REJECTED') => {
    const value = taskDraft ? JSON.stringify(taskDraft.filter((_, i) => kept[i]), null, 2) : text;
    decide.mutate({
      id: approval.id,
      decision,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(decision === 'APPROVED' && review && edited
        ? { revisedPayload: { ...approval.proposedPayload, __review: { ...review, value } } }
        : {}),
    });
  };

  return (
    <section
      aria-label="Approval required"
      className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-3"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Approval required</p>
          <p className="text-xs text-muted-foreground">
            {approval.actionType} · asked {formatRelative(approval.createdAt)}
          </p>
        </div>
        {edited ? <Badge variant="info" className="text-[10px]">Edited</Badge> : null}
      </div>

      {review && !compact ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{review.label}</p>
            {!taskDraft && canDecide ? (
              <SegmentedControl
                aria-label="Review the draft"
                size="sm"
                options={[
                  { value: 'preview', label: 'Preview' },
                  { value: 'edit', label: 'Edit' },
                ]}
                value={mode}
                onChange={setMode}
              />
            ) : null}
          </div>
          {taskDraft ? (
            <ul className="space-y-1.5 rounded-lg border border-border bg-surface p-2">
              {taskDraft.map((task, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id={`${approval.id}-task-${i}`}
                    checked={kept[i]}
                    disabled={!canDecide}
                    onCheckedChange={(checked) => setKept((prev) => prev.map((k, j) => (j === i ? checked === true : k)))}
                    aria-label={`Create “${task.title}”`}
                  />
                  <label htmlFor={`${approval.id}-task-${i}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-foreground">{task.title}</span>
                    {task.description || task.dueDate || task.priority ? (
                      <span className="block text-xs text-muted-foreground">
                        {[task.priority?.toLowerCase(), task.dueDate ? `due ${task.dueDate}` : null, task.description]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          ) : mode === 'edit' ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              aria-label={`Edit ${review.label}`}
            />
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-surface p-3 text-sm">
              <MarkdownMessage text={text || '_Nothing to review._'} />
            </div>
          )}
        </div>
      ) : null}

      {canDecide ? (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={1}
            placeholder="Add a note (optional)"
            aria-label="Note for the decision"
            className="text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" leadingIcon={<Check />} loading={decide.isPending && decide.variables?.decision === 'APPROVED'} onClick={() => submit('APPROVED')}>
              {edited ? 'Approve with edits' : 'Approve'}
            </Button>
            <Button size="sm" variant="outline" leadingIcon={<X />} loading={decide.isPending && decide.variables?.decision === 'REJECTED'} onClick={() => submit('REJECTED')}>
              Reject
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Waiting on {approval.requester?.name ?? 'the agent’s owner'} or a workspace admin to decide.
        </p>
      )}
    </section>
  );
}
