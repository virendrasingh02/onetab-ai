import {
  MAX_SCHEDULED_STATUSES,
  type ScheduledStatusRecurrenceValue,
  type ScheduledStatusView,
} from '@org/types';
import {
  Button,
  confirm,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import type { CreateScheduledStatusInput } from '@org/validation';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  useScheduledStatuses,
  useScheduledStatusMutations,
} from '../use-scheduled-statuses.js';

export interface ScheduledStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RECURRENCES: {
  value: ScheduledStatusRecurrenceValue;
  label: string;
}[] = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays' },
  { value: 'WEEKLY', label: 'Weekly' },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const toHHMM = (m: number | null | undefined) =>
  m == null
    ? ''
    : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (s: string): number | null => {
  const [h, mn] = s.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(mn) ? h * 60 + mn : null;
};
const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : '';
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function summarize(s: ScheduledStatusView): string {
  if (s.recurrence === 'ONE_TIME') {
    if (!s.startAt || !s.endAt) return 'One time';
    const d = (v: string) =>
      new Date(v).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    return `${d(s.startAt)} → ${d(s.endAt)}`;
  }
  const range = `${toHHMM(s.startMinute)} – ${toHHMM(s.endMinute)}`;
  if (s.recurrence === 'DAILY') return `Every day · ${range}`;
  if (s.recurrence === 'WEEKDAYS') return `Weekdays · ${range}`;
  const days = s.daysOfWeek
    .slice()
    .sort()
    .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
    .join(', ');
  return `${days || 'Weekly'} · ${range}`;
}

interface DraftState {
  label: string;
  statusText: string;
  statusEmoji: string;
  presence: 'NONE' | 'BUSY' | 'AWAY';
  priority: number;
  recurrence: ScheduledStatusRecurrenceValue;
  startLocal: string;
  endLocal: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  boundFrom: string;
  boundUntil: string;
}

function emptyDraft(): DraftState {
  return {
    label: '',
    statusText: '',
    statusEmoji: '📅',
    presence: 'NONE',
    priority: 0,
    recurrence: 'WEEKDAYS',
    startLocal: '',
    endLocal: '',
    startTime: '09:00',
    endTime: '11:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    boundFrom: '',
    boundUntil: '',
  };
}

function draftFrom(s: ScheduledStatusView): DraftState {
  return {
    label: s.label,
    statusText: s.statusText,
    statusEmoji: s.statusEmoji ?? '📅',
    presence: s.presence === 'BUSY' ? 'BUSY' : s.presence === 'AWAY' ? 'AWAY' : 'NONE',
    priority: s.priority,
    recurrence: s.recurrence,
    startLocal: toLocalInput(s.startAt),
    endLocal: toLocalInput(s.endAt),
    startTime: toHHMM(s.startMinute) || '09:00',
    endTime: toHHMM(s.endMinute) || '11:00',
    daysOfWeek: s.daysOfWeek.length ? s.daysOfWeek : [1, 2, 3, 4, 5],
    boundFrom: toDateInput(s.activeFrom),
    boundUntil: toDateInput(s.activeUntil),
  };
}

function toInput(d: DraftState): CreateScheduledStatusInput {
  const common = {
    label: d.label.trim() || d.statusText.trim() || 'Scheduled status',
    statusText: d.statusText.trim(),
    statusEmoji: d.statusEmoji.trim() || null,
    presence: d.presence === 'NONE' ? null : d.presence,
    priority: d.priority,
    timezone: browserTz(),
  };
  if (d.recurrence === 'ONE_TIME') {
    return {
      ...common,
      recurrence: 'ONE_TIME',
      startAt: d.startLocal ? new Date(d.startLocal).toISOString() : null,
      endAt: d.endLocal ? new Date(d.endLocal).toISOString() : null,
    } as CreateScheduledStatusInput;
  }
  return {
    ...common,
    recurrence: d.recurrence,
    startMinute: fromHHMM(d.startTime),
    endMinute: fromHHMM(d.endTime),
    daysOfWeek: d.recurrence === 'WEEKLY' ? d.daysOfWeek : [],
    activeFrom: d.boundFrom
      ? new Date(`${d.boundFrom}T00:00:00`).toISOString()
      : null,
    activeUntil: d.boundUntil
      ? new Date(`${d.boundUntil}T23:59:59`).toISOString()
      : null,
  } as CreateScheduledStatusInput;
}

export function ScheduledStatusDialog({
  open,
  onOpenChange,
}: ScheduledStatusDialogProps) {
  const { data, isLoading } = useScheduledStatuses();
  const { create, update, remove } = useScheduledStatusMutations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);

  const items = data ?? [];
  const atLimit = items.length >= MAX_SCHEDULED_STATUSES;

  const startAdd = () => {
    setEditingId('new');
    setDraft(emptyDraft());
  };
  const startEdit = (s: ScheduledStatusView) => {
    setEditingId(s.id);
    setDraft(draftFrom(s));
  };
  const cancelForm = () => {
    setEditingId(null);
    setDraft(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.statusText.trim()) return;
    const input = toInput(draft);
    if (editingId === 'new') {
      create.mutate(input, { onSuccess: cancelForm });
    } else if (editingId) {
      update.mutate({ id: editingId, input }, { onSuccess: cancelForm });
    }
  };

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pt-5 pb-3">
          <DialogTitle className="gap-2 flex items-center text-base font-semibold">
            <CalendarClock className="size-4.5 text-primary" />
            Scheduled statuses
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Set your status automatically at a time you choose — up to{' '}
            {MAX_SCHEDULED_STATUSES}. When two overlap, the higher priority wins.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : items.length === 0 && editingId === null ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              No scheduled statuses yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <span className="text-lg">{s.statusEmoji ?? '📅'}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-xs font-medium text-foreground',
                        !s.isEnabled && 'text-muted-foreground line-through',
                      )}
                    >
                      {s.statusText}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {summarize(s)}
                      {s.priority > 0 ? ` · priority ${s.priority}` : ''}
                    </p>
                  </div>
                  <Switch
                    checked={s.isEnabled}
                    onCheckedChange={(checked) =>
                      update.mutate({
                        id: s.id,
                        input: { isEnabled: checked },
                      })
                    }
                    aria-label={`Enable ${s.label}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${s.label}`}
                    onClick={() => startEdit(s)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${s.label}`}
                    onClick={() => {
                      void confirm({
                        title: `Delete the scheduled status “${s.label}”?`,
                        description:
                          "It won't be applied on its next scheduled time. This can't be undone.",
                        confirmLabel: 'Delete',
                        destructive: true,
                      }).then((ok) => {
                        if (ok) remove.mutate(s.id);
                      });
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {draft && editingId ? (
            <form
              onSubmit={submit}
              className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={draft.statusEmoji}
                  onChange={(e) => set('statusEmoji', e.target.value)}
                  maxLength={8}
                  aria-label="Emoji"
                  className="h-8 w-14 text-center text-base"
                />
                <Input
                  value={draft.statusText}
                  onChange={(e) => set('statusText', e.target.value)}
                  placeholder="Status text (e.g. Focus time)"
                  maxLength={100}
                  className="h-8 flex-1 text-xs"
                  autoFocus
                />
              </div>

              <Input
                value={draft.label}
                onChange={(e) => set('label', e.target.value)}
                placeholder="Name for this schedule (optional)"
                maxLength={80}
                className="h-8 text-xs"
              />

              {/* Recurrence */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
                {RECURRENCES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => set('recurrence', r.value)}
                    aria-pressed={draft.recurrence === r.value}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                      draft.recurrence === r.value
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {draft.recurrence === 'ONE_TIME' ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-muted-foreground">
                    Start
                    <Input
                      type="datetime-local"
                      value={draft.startLocal}
                      onChange={(e) => set('startLocal', e.target.value)}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </label>
                  <label className="text-[11px] text-muted-foreground">
                    End
                    <Input
                      type="datetime-local"
                      value={draft.endLocal}
                      onChange={(e) => set('endLocal', e.target.value)}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      From
                      <Input
                        type="time"
                        value={draft.startTime}
                        onChange={(e) => set('startTime', e.target.value)}
                        className="mt-0.5 h-8 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      To
                      <Input
                        type="time"
                        value={draft.endTime}
                        onChange={(e) => set('endTime', e.target.value)}
                        className="mt-0.5 h-8 text-xs"
                      />
                    </label>
                  </div>

                  {draft.recurrence === 'WEEKLY' && (
                    <div className="flex gap-1">
                      {DAY_LABELS.map((label, day) => {
                        const on = draft.daysOfWeek.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              set(
                                'daysOfWeek',
                                on
                                  ? draft.daysOfWeek.filter((d) => d !== day)
                                  : [...draft.daysOfWeek, day],
                              )
                            }
                            className={cn(
                              'size-7 rounded-md text-[11px] font-medium transition-colors',
                              on
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface-raised text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      Only from (optional)
                      <Input
                        type="date"
                        value={draft.boundFrom}
                        onChange={(e) => set('boundFrom', e.target.value)}
                        className="mt-0.5 h-8 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Until (optional)
                      <Input
                        type="date"
                        value={draft.boundUntil}
                        onChange={(e) => set('boundUntil', e.target.value)}
                        className="mt-0.5 h-8 text-xs"
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <label className="text-[11px] text-muted-foreground">
                  Priority
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.priority}
                    onChange={(e) =>
                      set('priority', Number(e.target.value) || 0)
                    }
                    className="mt-0.5 h-8 w-20 text-xs"
                  />
                </label>
                <label className="flex-1 text-[11px] text-muted-foreground">
                  While active, set me to
                  <select
                    value={draft.presence}
                    onChange={(e) =>
                      set('presence', e.target.value as DraftState['presence'])
                    }
                    className="mt-0.5 h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground"
                  >
                    <option value="NONE">No change</option>
                    <option value="BUSY">Do not disturb</option>
                    <option value="AWAY">Away</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !draft.statusText.trim()}
                >
                  {editingId === 'new' ? 'Add' : 'Save'}
                </Button>
              </div>
            </form>
          ) : null}
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-border bg-surface-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">
            {items.length}/{MAX_SCHEDULED_STATUSES} used
          </p>
          <Button
            size="sm"
            onClick={startAdd}
            disabled={atLimit || editingId === 'new'}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Add schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
