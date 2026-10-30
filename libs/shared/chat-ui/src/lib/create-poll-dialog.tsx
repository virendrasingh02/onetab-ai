import { POLL_LIMITS, type PollDraft } from '@org/types';
import {
  AppSelect,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Hint,
  Input,
  UnifiedEmojiPickerPopover,
} from '@org/ui';
import { cn } from '@org/utils';
import { BarChart3, Plus, SmilePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

const HOUR = 3_600_000;

const DURATIONS = [
  { value: String(HOUR), label: '1 hour' },
  { value: String(4 * HOUR), label: '4 hours' },
  { value: String(8 * HOUR), label: '8 hours' },
  { value: String(24 * HOUR), label: '24 hours' },
  { value: String(3 * 24 * HOUR), label: '3 days' },
  { value: String(7 * 24 * HOUR), label: '1 week' },
  { value: String(14 * 24 * HOUR), label: '2 weeks' },
];

interface AnswerRow {
  key: number;
  text: string;
  emoji?: string;
}

export interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Posts the poll. The dialog stays open (and keeps the draft) if it throws. */
  onCreate: (draft: PollDraft) => void | Promise<void>;
  /** Pre-fills the question — e.g. from `/poll Lunch?`. */
  initialQuestion?: string;
  /** Where it will be posted, for the description line. */
  targetName?: string;
}

let nextKey = 0;
const blankAnswer = (): AnswerRow => ({ key: nextKey++, text: '' });

export function CreatePollDialog({
  open,
  onOpenChange,
  onCreate,
  initialQuestion,
  targetName,
}: CreatePollDialogProps) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<AnswerRow[]>(() => [
    blankAnswer(),
    blankAnswer(),
  ]);
  const [duration, setDuration] = useState(String(24 * HOUR));
  const [multi, setMulti] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emojiFor, setEmojiFor] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const answerRefs = useRef(new Map<number, HTMLInputElement>());
  const focusKey = useRef<number | null>(null);

  // A fresh draft each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setQuestion(initialQuestion?.slice(0, POLL_LIMITS.questionLength) ?? '');
    setAnswers([blankAnswer(), blankAnswer()]);
    setDuration(String(24 * HOUR));
    setMulti(false);
    setTouched(false);
  }, [open, initialQuestion]);

  useEffect(() => {
    if (focusKey.current == null) return;
    answerRefs.current.get(focusKey.current)?.focus();
    focusKey.current = null;
  }, [answers]);

  const filled = answers.filter((answer) => answer.text.trim());
  const normalised = filled.map((answer) => answer.text.trim().toLowerCase());
  const duplicate = normalised.find(
    (text, index) => normalised.indexOf(text) !== index,
  );
  const questionError =
    touched && !question.trim() ? 'Ask a question.' : undefined;
  const answersError =
    duplicate != null
      ? 'Each answer must be different.'
      : touched && filled.length < POLL_LIMITS.minAnswers
        ? `Add at least ${POLL_LIMITS.minAnswers} answers.`
        : undefined;
  const canPost =
    !!question.trim() &&
    filled.length >= POLL_LIMITS.minAnswers &&
    duplicate == null;

  const update = (key: number, patch: Partial<AnswerRow>) =>
    setAnswers((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const addAnswer = () => {
    if (answers.length >= POLL_LIMITS.maxAnswers) return;
    const row = blankAnswer();
    focusKey.current = row.key;
    setAnswers((rows) => [...rows, row]);
  };

  const removeAnswer = (key: number) =>
    setAnswers((rows) =>
      rows.length > POLL_LIMITS.minAnswers
        ? rows.filter((row) => row.key !== key)
        : rows,
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canPost || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        question: question.trim(),
        answers: filled.map((answer) => ({
          text: answer.text.trim(),
          emoji: answer.emoji,
        })),
        maxSelections: multi ? filled.length : 1,
        durationMs: Number(duration),
      });
      onOpenChange(false);
    } catch {
      // The host reports the failure; keep the draft so nothing is retyped.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <div className="gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <BarChart3 className="size-4" aria-hidden />
              </div>
              <div>
                <DialogTitle>Create a poll</DialogTitle>
                <DialogDescription>
                  {targetName
                    ? `Ask a question — everyone in ${targetName} can vote.`
                    : 'Ask a question and let everyone vote.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <Field
              label="Question"
              required
              error={questionError}
              labelAside={
                <span className="text-xs text-muted-foreground tabular-nums">
                  {question.length} / {POLL_LIMITS.questionLength}
                </span>
              }
            >
              <Input
                value={question}
                maxLength={POLL_LIMITS.questionLength}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What question do you want to ask?"
                inputSize="lg"
                autoFocus
              />
            </Field>

            <Field
              label="Answers"
              required
              error={answersError}
              htmlFor="poll-answer-0"
            >
              <div className="space-y-2">
                {answers.map((answer, index) => (
                  <div key={answer.key} className="gap-2 flex items-center">
                    <UnifiedEmojiPickerPopover
                      open={emojiFor === answer.key}
                      onOpenChange={(next) =>
                        setEmojiFor(next ? answer.key : null)
                      }
                      side="bottom"
                      align="start"
                      closeOnEmojiSelect
                      onEmojiSelect={(emoji) =>
                        update(answer.key, { emoji: emoji.emoji })
                      }
                    >
                      <button
                        type="button"
                        aria-label={
                          answer.emoji
                            ? `Change emoji ${answer.emoji}`
                            : 'Add an emoji'
                        }
                        className={cn(
                          'size-9 text-base flex shrink-0 items-center justify-center rounded-input border border-input bg-surface transition-colors hover:bg-accent',
                          'focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none',
                        )}
                      >
                        {answer.emoji ?? (
                          <SmilePlus
                            className="size-4 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </button>
                    </UnifiedEmojiPickerPopover>
                    <Input
                      id={index === 0 ? 'poll-answer-0' : undefined}
                      ref={(node: HTMLInputElement | null) => {
                        if (node) answerRefs.current.set(answer.key, node);
                        else answerRefs.current.delete(answer.key);
                      }}
                      aria-label={`Answer ${index + 1}`}
                      value={answer.text}
                      maxLength={POLL_LIMITS.answerLength}
                      onChange={(event) =>
                        update(answer.key, { text: event.target.value })
                      }
                      onKeyDown={(event) => {
                        // Enter moves on to the next answer, adding one at the end.
                        if (
                          event.key !== 'Enter' ||
                          event.nativeEvent.isComposing
                        )
                          return;
                        event.preventDefault();
                        const next = answers[index + 1];
                        if (next) answerRefs.current.get(next.key)?.focus();
                        else if (answer.text.trim()) addAnswer();
                      }}
                      placeholder={`Answer ${index + 1}`}
                      inputSize="lg"
                      trailingSlot={
                        <Hint label="Remove answer">
                          <button
                            type="button"
                            aria-label={`Remove answer ${index + 1}`}
                            disabled={answers.length <= POLL_LIMITS.minAnswers}
                            onClick={() => removeAnswer(answer.key)}
                            className="size-6 flex items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </Hint>
                      }
                    />
                  </div>
                ))}
                {answers.length < POLL_LIMITS.maxAnswers ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      leadingIcon={<Plus className="size-3.5" aria-hidden />}
                      onClick={addAnswer}
                    >
                      Add another answer
                    </Button>
                  </div>
                ) : null}
              </div>
            </Field>

            <Field label="Duration">
              <AppSelect
                value={duration}
                onValueChange={setDuration}
                options={DURATIONS}
              />
            </Field>
          </DialogBody>

          <DialogFooter className="sm:justify-between">
            <label className="gap-2 text-sm flex cursor-pointer items-center text-foreground select-none">
              <Checkbox
                checked={multi}
                onCheckedChange={(value) => setMulti(value === true)}
              />
              Allow multiple answers
            </label>
            <div className="gap-2 flex">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                disabled={touched && !canPost}
              >
                Post
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
