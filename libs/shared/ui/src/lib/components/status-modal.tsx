import { userApi } from '@org/api-client';
import type { CurrentUser, PresenceStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  Car,
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import { useFocusStore } from './focus-mode-store.js';
import { Input } from './input.js';
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
    text: 'Deep focus / In the zone',
    durationMinutes: 60,
    durationLabel: '1 hour',
    icon: Target,
  },
];

export const POPULAR_EMOJIS = [
  '💬', '📅', '🚗', '🤒', '🌴', '🍱', '🏠', '🎯',
  '☕', '🎧', '⚡', '🔕', '🚀', '💡', '💻', '🧘',
  '🏃', '🍔', '🎉', '👋', '🔥', '✨', '🏖️', '✈️',
  '📞', '🛑', '👀', '🧠', '⭐', '🥑', '🍕', '🍻',
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

export interface StatusModalProps {
  currentUser?: CurrentUser | null;
  onUserUpdated?: (user: CurrentUser) => void;
}

export function StatusModal({ currentUser, onUserUpdated }: StatusModalProps) {
  const isOpen = useFocusStore((s) => s.isStatusModalOpen);
  const closeStatusModal = useFocusStore((s) => s.closeStatusModal);

  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('💬');
  const [selectedClearId, setSelectedClearId] = useState('today');
  const [pauseNotifications, setPauseNotifications] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatusText(currentUser?.statusText ?? '');
      setStatusEmoji(currentUser?.statusEmoji ?? '💬');
      setPauseNotifications(currentUser?.presence === 'BUSY');
      setSelectedClearId(currentUser?.statusExpiresAt ? 'custom' : 'today');
    }
  }, [isOpen, currentUser]);

  const handleApplyPreset = (preset: StatusPreset) => {
    setStatusEmoji(preset.emoji);
    setStatusText(preset.text);
    if (preset.durationMinutes === null) {
      setSelectedClearId('never');
    } else if (preset.durationMinutes === -1) {
      setSelectedClearId('today');
    } else if (preset.durationMinutes === 30) {
      setSelectedClearId('30m');
    } else if (preset.durationMinutes === 60) {
      setSelectedClearId('1h');
    }
  };

  const handleSaveStatus = async () => {
    try {
      setIsSaving(true);
      const clearOption = CLEAR_AFTER_OPTIONS.find(
        (o) => o.id === selectedClearId,
      );
      const expiresAtDate = clearOption ? clearOption.calcExpiresAt() : null;

      const updated = await userApi.updateStatus({
        statusText: statusText.trim() || null,
        statusEmoji: statusText.trim() ? statusEmoji || '💬' : null,
        statusExpiresAt: statusText.trim() && expiresAtDate ? expiresAtDate.toISOString() : null,
        presence: pauseNotifications ? ('BUSY' as PresenceStatus) : undefined,
      });

      if (onUserUpdated) {
        onUserUpdated(updated);
      }

      toast.success(
        statusText.trim() ? 'Status updated' : 'Status cleared',
      );
      closeStatusModal();
    } catch {
      toast.error('Failed to update status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStatus = async () => {
    try {
      setIsSaving(true);
      const updated = await userApi.clearStatus();
      if (onUserUpdated) {
        onUserUpdated(updated);
      }
      setStatusText('');
      setStatusEmoji('💬');
      toast.success('Status cleared');
      closeStatusModal();
    } catch {
      toast.error('Failed to clear status.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasCurrentStatus = Boolean(
    currentUser?.statusText || currentUser?.statusEmoji,
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeStatusModal()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-popover text-foreground">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Smile className="size-4.5 text-primary" />
            Set a status
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Let your workspace know what you are working on or if you are away.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Active status banner */}
          {hasCurrentStatus && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{currentUser?.statusEmoji || '💬'}</span>
                <span className="font-medium text-foreground truncate">
                  {currentUser?.statusText}
                </span>
                {currentUser?.statusExpiresAt && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="size-3" />
                    until {new Date(currentUser.statusExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearStatus}
                disabled={isSaving}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive gap-1"
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            </div>
          )}

          {/* Status text + emoji input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              What's your status?
            </label>
            <div className="flex items-center gap-2">
              <Popover
                open={isEmojiPickerOpen}
                onOpenChange={setIsEmojiPickerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-9 shrink-0 flex items-center justify-center text-lg rounded-input border border-border bg-surface hover:bg-accent transition-colors"
                    title="Select emoji"
                  >
                    {statusEmoji || '💬'}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 p-2 border-border bg-popover shadow-overlay"
                >
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 px-1">
                    Choose an emoji
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {POPULAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setStatusEmoji(emoji);
                          setIsEmojiPickerOpen(false);
                        }}
                        className={cn(
                          'size-7 flex items-center justify-center text-base rounded hover:bg-accent transition-transform hover:scale-110',
                          statusEmoji === emoji && 'bg-primary/20 ring-1 ring-primary',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="relative flex-1">
                <Input
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="What's your status?"
                  maxLength={100}
                  className="h-9 pr-7 text-xs"
                />
                {statusText && (
                  <button
                    type="button"
                    onClick={() => setStatusText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-subtle uppercase tracking-wider">
              Popular presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SLACK_STATUS_PRESETS.map((preset) => {
                const isSelected =
                  statusText === preset.text && statusEmoji === preset.emoji;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg border text-left transition-all text-xs',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary-text font-medium shadow-xs'
                        : 'border-border/60 bg-surface/50 hover:bg-surface hover:border-border text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base shrink-0">{preset.emoji}</span>
                      <span className="truncate">{preset.text}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1.5">
                      {preset.durationLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear status after */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              Clear status after
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CLEAR_AFTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedClearId(opt.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs transition-colors border',
                    selectedClearId === opt.id
                      ? 'border-primary bg-primary text-primary-foreground font-medium'
                      : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pause notifications */}
          <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none text-xs text-foreground">
            <input
              type="checkbox"
              checked={pauseNotifications}
              onChange={(e) => setPauseNotifications(e.target.checked)}
              className="rounded border-border text-primary focus:ring-ring size-4"
            />
            <span>Pause notifications (Do Not Disturb)</span>
          </label>
        </div>

        <DialogFooter className="p-4 bg-surface-muted/50 border-t border-border flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={closeStatusModal}
            disabled={isSaving}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
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
              disabled={isSaving}
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
