import type { CurrentUser, PresenceStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  Car,
  CalendarClock,
  Clock,
  Coffee,
  HeartPulse,
  Laptop,
  MessageSquare,
  Palmtree,
  Smile,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './button.js';
import { AppSelect } from './app-select.js';
import { Switch } from './primitives.js';
import { DateTimePicker, parseDateTimeValue } from './date-time-picker.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import { EmojiPicker } from './emoji-gif-picker/emoji-picker.js';
import { useStatusModalStore } from './status-modal-store.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

export interface StatusPreset {
  id: string;
  emoji: string;
  text: string;
  durationMinutes: number | null; // null = don't clear, or minutes
  durationLabel: string;
  icon?: React.ElementType;
}

export const SLACK_STATUS_PRESETS: StatusPreset[] = [
  {
    id: 'meeting',
    emoji: '💬',
    text: 'In a meeting',
    durationMinutes: 60,
    durationLabel: '1 hour',
    icon: MessageSquare,
  },
  {
    id: 'commuting',
    emoji: '🚗',
    text: 'Commuting',
    durationMinutes: 30,
    durationLabel: '30 minutes',
    icon: Car,
  },
  {
    id: 'sick',
    emoji: '🤒',
    text: 'Out sick',
    durationMinutes: -1, // End of day
    durationLabel: 'Today',
    icon: HeartPulse,
  },
  {
    id: 'vacation',
    emoji: '🌴',
    text: 'Vacationing',
    durationMinutes: null,
    durationLabel: "Don't clear",
    icon: Palmtree,
  },
  {
    id: 'lunch',
    emoji: '🍱',
    text: 'Out for lunch',
    durationMinutes: 60,
    durationLabel: '1 hour',
    icon: Coffee,
  },
  {
    id: 'remote',
    emoji: '🏠',
    text: 'Working remotely',
    durationMinutes: -1,
    durationLabel: 'Today',
    icon: Laptop,
  },
  {
    id: 'focus',
    emoji: '🎯',
    text: 'Deep focus',
    durationMinutes: 60,
    durationLabel: '1 hour',
    icon: Target,
  },
];

export interface ClearOption {
  id: string;
  label: string;
  calcExpiresAt: () => Date | null;
}

export const CLEAR_AFTER_OPTIONS: ClearOption[] = [
  {
    id: 'never',
    label: "Don't clear",
    calcExpiresAt: () => null,
  },
  {
    id: '30m',
    label: '30 minutes',
    calcExpiresAt: () => new Date(Date.now() + 30 * 60 * 1000),
  },
  {
    id: '1h',
    label: '1 hour',
    calcExpiresAt: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    id: '4h',
    label: '4 hours',
    calcExpiresAt: () => new Date(Date.now() + 4 * 60 * 60 * 1000),
  },
  {
    id: 'today',
    label: 'Today (Midnight)',
    calcExpiresAt: () => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    },
  },
  {
    id: 'week',
    label: 'This week (Sunday)',
    calcExpiresAt: () => {
      const d = new Date();
      const day = d.getDay();
      const diff = (7 - day) % 7;
      d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
      d.setHours(23, 59, 59, 999);
      return d;
    },
  },
];

/**
 * Publishing a status is the caller's job, not this library's.
 *
 * `@org/ui` is presentational and may not reach for `@org/api-client` — the
 * module boundaries enforce it — so the shell, which already owns the signed-in
 * user, passes the two operations in.
 */
export interface StatusPublisher {
  onSaveStatus?: (input: {
    statusEmoji?: string | null;
    statusText?: string | null;
    statusExpiresAt?: string | null;
    presence?: PresenceStatus;
  }) => Promise<CurrentUser>;
  onClearStatus?: () => Promise<CurrentUser>;
}

export interface StatusModalProps extends StatusPublisher {
  currentUser?: CurrentUser | null;
  onUserUpdated?: (user: CurrentUser) => void;
  /** Opens the "Scheduled statuses" manager (brief §9). Hidden when omitted. */
  onManageSchedules?: () => void;
}

const MAX_STATUS_LENGTH = 100;
const DEFAULT_EMOJI = '💬';

/** Special choices beside {@link CLEAR_AFTER_OPTIONS}. */
const KEEP_ID = 'keep';
const CUSTOM_ID = 'custom';

function describeExpiry(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (date.toDateString() === now.toDateString()) return `today at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `tomorrow at ${time}`;
  }
  return `${date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })} at ${time}`;
}

export function StatusModal({
  currentUser,
  onUserUpdated,
  onSaveStatus,
  onClearStatus,
  onManageSchedules,
}: StatusModalProps) {
  const isOpen = useStatusModalStore((s) => s.isStatusModalOpen);
  const closeStatusModal = useStatusModalStore((s) => s.closeStatusModal);

  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState(DEFAULT_EMOJI);
  const [selectedClearId, setSelectedClearId] = useState('today');
  const [customExpiry, setCustomExpiry] = useState<string | undefined>();
  const [pauseNotifications, setPauseNotifications] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // The status's current expiry, if it hasn't lapsed — lets "keep" survive a
  // save instead of silently turning an expiring status into a permanent one.
  const currentExpiry = useMemo(() => {
    const d = currentUser?.statusExpiresAt
      ? new Date(currentUser.statusExpiresAt)
      : null;
    return d && d.getTime() > Date.now() ? d : null;
  }, [currentUser?.statusExpiresAt]);

  const hasCurrentStatus = Boolean(
    currentUser?.statusText || currentUser?.statusEmoji,
  );
  const wasPaused = currentUser?.presence === 'BUSY';

  useEffect(() => {
    if (!isOpen) return;
    setStatusText(currentUser?.statusText ?? '');
    setStatusEmoji(currentUser?.statusEmoji ?? DEFAULT_EMOJI);
    setPauseNotifications(currentUser?.presence === 'BUSY');
    setCustomExpiry(undefined);
    setIsEmojiPickerOpen(false);
    setSelectedClearId(
      currentUser?.statusText && currentExpiry
        ? KEEP_ID
        : currentUser?.statusText
          ? 'never'
          : 'today',
    );
    // Re-seed only when the modal opens; later user refreshes must not
    // clobber what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleApplyPreset = (preset: StatusPreset) => {
    setStatusEmoji(preset.emoji);
    setStatusText(preset.text);
    if (preset.durationMinutes === null) setSelectedClearId('never');
    else if (preset.durationMinutes === -1) setSelectedClearId('today');
    else if (preset.durationMinutes === 30) setSelectedClearId('30m');
    else if (preset.durationMinutes === 60) setSelectedClearId('1h');
    else if (preset.durationMinutes === 240) setSelectedClearId('4h');
  };

  const trimmedText = statusText.trim();

  /** Resolves the chosen "clear after" into a concrete moment (or none). */
  const resolveExpiry = (): Date | null => {
    if (selectedClearId === KEEP_ID) return currentExpiry;
    if (selectedClearId === CUSTOM_ID) {
      return parseDateTimeValue(customExpiry) ?? null;
    }
    return (
      CLEAR_AFTER_OPTIONS.find(
        (o) => o.id === selectedClearId,
      )?.calcExpiresAt() ?? null
    );
  };

  const customInvalid =
    selectedClearId === CUSTOM_ID &&
    (!customExpiry ||
      (parseDateTimeValue(customExpiry)?.getTime() ?? 0) <= Date.now());

  const canSave =
    !isSaving &&
    !customInvalid &&
    (trimmedText.length > 0 ||
      hasCurrentStatus ||
      pauseNotifications !== wasPaused);

  const finish = (updated: CurrentUser, message: string) => {
    onUserUpdated?.(updated);
    toast.success(message);
    closeStatusModal();
  };

  const handleSaveStatus = async () => {
    if (!onSaveStatus || !canSave) return;
    try {
      setIsSaving(true);
      const expiresAt = trimmedText ? resolveExpiry() : null;
      // Unticking DND must hand presence back, or BUSY sticks forever.
      const presence: PresenceStatus | undefined = pauseNotifications
        ? 'BUSY'
        : wasPaused
          ? 'ONLINE'
          : undefined;
      const updated = await onSaveStatus({
        statusText: trimmedText || null,
        statusEmoji: trimmedText ? statusEmoji || DEFAULT_EMOJI : null,
        statusExpiresAt: expiresAt ? expiresAt.toISOString() : null,
        presence,
      });
      finish(updated, trimmedText ? 'Status updated' : 'Status cleared');
    } catch {
      toast.error('Failed to update status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStatus = async () => {
    if (!onClearStatus) return;
    try {
      setIsSaving(true);
      const updated = await onClearStatus();
      setStatusText('');
      setStatusEmoji(DEFAULT_EMOJI);
      finish(updated, 'Status cleared');
    } catch {
      toast.error('Failed to clear status.');
    } finally {
      setIsSaving(false);
    }
  };

  const clearChoices: { id: string; label: string }[] = [
    ...(currentExpiry && currentUser?.statusText
      ? [{ id: KEEP_ID, label: `Keep (${describeExpiry(currentExpiry)})` }]
      : []),
    ...CLEAR_AFTER_OPTIONS.map(({ id, label }) => ({ id, label })),
    { id: CUSTOM_ID, label: 'Custom…' },
  ];

  const expiryPreview = (() => {
    if (!trimmedText) return null;
    if (selectedClearId === 'never') return "Won't clear automatically";
    const when = resolveExpiry();
    return when ? `Clears ${describeExpiry(when)}` : null;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeStatusModal()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-popover text-foreground">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <DialogTitle className="gap-2 text-base font-semibold flex items-center">
            <Smile className="size-4.5 text-primary" />
            Set a status
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Let your workspace know what you are working on or if you are away.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {hasCurrentStatus && (
            <div className="p-2.5 text-xs flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5">
              <div className="gap-2 min-w-0 flex items-center">
                <span className="text-base">
                  {currentUser?.statusEmoji || DEFAULT_EMOJI}
                </span>
                <span className="font-medium truncate text-foreground">
                  {currentUser?.statusText}
                </span>
                {currentExpiry && (
                  <span className="gap-1 flex shrink-0 items-center text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    until {describeExpiry(currentExpiry)}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearStatus}
                disabled={isSaving}
                className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="status-modal-text"
              className="text-xs font-medium text-foreground"
            >
              What's your status?
            </label>
            <div className="gap-1 pl-1 pr-2 flex h-10 items-center rounded-input border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring/30">
              <Popover
                open={isEmojiPickerOpen}
                onOpenChange={setIsEmojiPickerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-8 text-lg flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent"
                    title="Select emoji"
                    aria-label="Select emoji"
                  >
                    {statusEmoji || DEFAULT_EMOJI}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto overflow-hidden p-0 border-border bg-popover shadow-overlay"
                >
                  <div className="w-80 max-w-[calc(100vw-1rem)]">
                    <EmojiPicker
                      showPreview={false}
                      onEmojiSelect={(emoji) => {
                        setStatusEmoji(emoji.emoji);
                        setIsEmojiPickerOpen(false);
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <input
                id="status-modal-text"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void handleSaveStatus();
                  }
                }}
                placeholder="In a meeting, working remotely…"
                maxLength={MAX_STATUS_LENGTH}
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle"
              />
              {statusText && (
                <>
                  <span
                    className={cn(
                      'text-[10px] shrink-0 tabular-nums',
                      statusText.length > MAX_STATUS_LENGTH - 15
                        ? 'text-warning'
                        : 'text-subtle',
                    )}
                  >
                    {MAX_STATUS_LENGTH - statusText.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatusText('')}
                    aria-label="Clear text"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-medium tracking-wider text-[11px] text-subtle uppercase">
              Suggestions
            </span>
            <div className="gap-1.5 flex flex-wrap">
              {SLACK_STATUS_PRESETS.map((preset) => {
                const isSelected =
                  statusText === preset.text && statusEmoji === preset.emoji;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    aria-pressed={isSelected}
                    title={`Clears: ${preset.durationLabel}`}
                    className={cn(
                      'gap-1.5 py-1 pr-3 pl-2 text-xs flex items-center rounded-full border transition-colors',
                      isSelected
                        ? 'font-medium border-primary bg-primary/10 text-primary-text'
                        : 'border-border bg-surface text-foreground hover:bg-accent',
                    )}
                  >
                    <span className="text-sm">{preset.emoji}</span>
                    {preset.text}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="gap-3 flex items-center justify-between">
              <span className="text-xs font-medium gap-1.5 flex items-center text-foreground">
                <Clock className="size-3.5 text-muted-foreground" />
                Clear after
              </span>
              <AppSelect
                value={selectedClearId}
                onValueChange={setSelectedClearId}
                options={clearChoices.map(({ id, label }) => ({
                  value: id,
                  label,
                }))}
                aria-label="Clear status after"
                size="sm"
                className="w-52"
              />
            </div>
            {selectedClearId === CUSTOM_ID && (
              <DateTimePicker
                value={customExpiry}
                onChange={setCustomExpiry}
                disablePast
                placeholder="Pick when to clear"
                aria-label="Clear status at"
              />
            )}
            {customInvalid ? (
              <p className="gap-1 text-[11px] flex items-center text-muted-foreground">
                <CalendarClock className="size-3" />
                Choose a time in the future.
              </p>
            ) : (
              expiryPreview && (
                <p className="text-[11px] text-muted-foreground">
                  {expiryPreview}
                </p>
              )
            )}
          </div>

          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            <label
              htmlFor="status-modal-dnd"
              className="gap-3 px-3 py-2.5 flex cursor-pointer items-center justify-between select-none"
            >
              <span className="text-xs">
                <span className="font-medium text-foreground">
                  Pause notifications
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Do Not Disturb — you'll show as busy until you turn it off.
                </span>
              </span>
              <Switch
                id="status-modal-dnd"
                checked={pauseNotifications}
                onCheckedChange={setPauseNotifications}
              />
            </label>
            {onManageSchedules && (
              <button
                type="button"
                onClick={() => {
                  closeStatusModal();
                  onManageSchedules();
                }}
                className="gap-2.5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent/50 flex w-full items-center justify-between"
              >
                <span>
                  <span className="font-medium text-foreground">
                    Scheduled statuses
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Set your status automatically on a schedule
                  </span>
                </span>
                <span className="text-[11px] font-medium text-primary">
                  Manage
                </span>
              </button>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="p-4 flex flex-row items-center justify-between border-t border-border bg-surface-muted/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={closeStatusModal}
            disabled={isSaving}
          >
            Cancel
          </Button>

          <div className="gap-2 flex items-center">
            {hasCurrentStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearStatus}
                disabled={isSaving}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                Clear status
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveStatus}
              disabled={!canSave}
              className="text-xs px-4"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
