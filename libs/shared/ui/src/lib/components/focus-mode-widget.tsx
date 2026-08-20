import type { CurrentUser, PresenceStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  CheckCircle2,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Plus,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
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
import { FOCUS_SOUND_OPTIONS, type FocusSoundType } from './focus-audio.js';
import { useFocusStore } from './focus-mode-store.js';
import { Input } from './input.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

export interface FocusDurationOption {
  minutes: number;
  label: string;
  icon: string;
  badge?: string;
}

export const FOCUS_DURATION_OPTIONS: FocusDurationOption[] = [
  { minutes: 25, label: 'Pomodoro', icon: '🍅', badge: 'Standard' },
  { minutes: 45, label: 'Deep Work', icon: '⚡', badge: 'Popular' },
  { minutes: 60, label: 'Power Hour', icon: '🎯' },
  { minutes: 90, label: 'Flow State', icon: '🚀' },
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

export interface FocusModeWidgetProps extends StatusPublisher {
  currentUser?: CurrentUser | null;
  onUserUpdated?: (user: CurrentUser) => void;
}

export function FocusModeWidget({
  currentUser: _currentUser,
  onUserUpdated,
  onSaveStatus,
  onClearStatus,
}: FocusModeWidgetProps) {
  const {
    isActive,
    isPaused,
    totalSeconds,
    remainingSeconds,
    taskObjective,
    soundType,
    soundVolume,
    isFocusModalOpen,
    autoSetSlackStatus,
    startFocus,
    pauseFocus,
    resumeFocus,
    stopFocus,
    addTime,
    setSound,
    setVolume,
    tick,
    closeFocusModal,
  } = useFocusStore();

  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [objectiveInput, setObjectiveInput] = useState('');
  const [selectedSound, setSelectedSound] = useState<FocusSoundType>('none');
  const [selectedVolume, setSelectedVolume] = useState(0.5);
  const [syncStatus, setSyncStatus] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Timer interval
  useEffect(() => {
    if (!isActive || isPaused) return;

    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, tick]);

  // Handle session start
  const handleStartSession = async () => {
    const mins = customMinutes ? parseInt(customMinutes, 10) : selectedMinutes;
    if (isNaN(mins) || mins <= 0) return;

    const finalMins = Math.min(mins, 180);
    const objective = objectiveInput.trim();

    startFocus({
      durationMinutes: finalMins,
      taskObjective: objective,
      soundType: selectedSound,
      soundVolume: selectedVolume,
      autoSetSlackStatus: syncStatus,
    });

    if (syncStatus && onSaveStatus) {
      try {
        const expiresAt = new Date(Date.now() + finalMins * 60 * 1000);
        const updated = await onSaveStatus({
          statusEmoji: '🎯',
          statusText: objective ? `Focusing on ${objective}` : 'In Focus Mode',
          statusExpiresAt: expiresAt.toISOString(),
          presence: 'BUSY' as PresenceStatus,
        });
        if (onUserUpdated) onUserUpdated(updated);
      } catch {
        // ignore status sync error
      }
    }

    toast.success(`Focus mode started for ${finalMins} minutes! 🎯`);
  };

  // Handle session stop
  const handleStopSession = async (completed = false) => {
    stopFocus(completed);

    if (autoSetSlackStatus && onClearStatus) {
      try {
        const updated = await onClearStatus();
        if (onUserUpdated) onUserUpdated(updated);
      } catch {
        // ignore status clear error
      }
    }

    if (completed) {
      toast.success('🎉 Great job! Focus session completed!');
    } else {
      toast.info('Focus session ended');
    }
  };

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent =
    totalSeconds > 0
      ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100
      : 0;

  return (
    <>
      {/* Focus Launcher Dialog */}
      <Dialog
        open={isFocusModalOpen}
        onOpenChange={(open) => !open && closeFocusModal()}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-popover text-foreground">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <DialogTitle className="gap-2 text-base font-semibold flex items-center">
              <Sparkles className="size-4.5 text-primary" />
              Start a Focus Session
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Block distractions, sync your status, and enter flow state.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* Duration Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Session Duration
              </label>
              <div className="sm:grid-cols-4 gap-2 grid grid-cols-2">
                {FOCUS_DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => {
                      setSelectedMinutes(opt.minutes);
                      setCustomMinutes('');
                    }}
                    className={cn(
                      'p-2.5 gap-1 flex flex-col items-center rounded-lg border text-center transition-all',
                      selectedMinutes === opt.minutes && !customMinutes
                        ? 'font-semibold shadow-xs border-primary bg-primary/10 text-primary-text ring-1 ring-primary'
                        : 'border-border bg-surface text-foreground hover:bg-accent',
                    )}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-xs">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {opt.minutes} min
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Minutes Input */}
              <div className="gap-2 pt-1 flex items-center">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  placeholder="Custom minutes (e.g. 30)"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>

            {/* Task Objective */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                What are you focusing on? (Optional)
              </label>
              <Input
                placeholder="e.g. Review pull request, Write product spec…"
                value={objectiveInput}
                onChange={(e) => setObjectiveInput(e.target.value)}
                maxLength={60}
                className="h-8 text-xs"
              />
            </div>

            {/* Ambient Soundscape Synthesizer */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center justify-between text-foreground">
                <span className="gap-1.5 flex items-center">
                  <Music className="size-3.5 text-primary" />
                  Ambient Background Sound
                </span>
                <span className="text-[10px] text-subtle">
                  Web Audio Synthesizer
                </span>
              </label>

              <div className="sm:grid-cols-3 gap-1.5 grid grid-cols-2">
                {FOCUS_SOUND_OPTIONS.map((snd) => (
                  <button
                    key={snd.id}
                    type="button"
                    onClick={() => setSelectedSound(snd.id)}
                    className={cn(
                      'p-2 gap-2 text-xs flex items-center rounded-lg border text-left transition-all',
                      selectedSound === snd.id
                        ? 'font-medium border-primary bg-primary/10 text-primary-text ring-1 ring-primary'
                        : 'border-border bg-surface text-foreground hover:bg-accent',
                    )}
                  >
                    <span className="text-base">{snd.icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{snd.name}</div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedSound !== 'none' && (
                <div className="gap-2 pt-1.5 px-1 flex items-center">
                  <Volume2 className="size-3.5 text-muted-foreground" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selectedVolume}
                    onChange={(e) =>
                      setSelectedVolume(parseFloat(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-border accent-primary"
                  />
                </div>
              )}
            </div>

            {/* Sync Slack Status and DND */}
            <div className="pt-1 space-y-2 border-t border-border">
              <label className="gap-2 text-xs flex cursor-pointer items-center text-foreground select-none">
                <input
                  type="checkbox"
                  checked={syncStatus}
                  onChange={(e) => setSyncStatus(e.target.checked)}
                  className="rounded size-4 border-border text-primary focus:ring-ring"
                />
                <span className="gap-1.5 flex items-center">
                  <Target className="size-3.5 text-primary" />
                  Auto-set Slack status to 🎯 In Focus Mode & DND
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="p-4 flex items-center justify-between border-t border-border bg-surface-muted/50">
            <Button variant="ghost" size="sm" onClick={closeFocusModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartSession}
              className="text-xs px-4 gap-1.5"
            >
              <Play className="size-3.5" />
              Start Focus Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Focus Floating Widget */}
      {isActive && (
        <div
          className={cn(
            'fixed z-50 transition-all duration-200',
            isMinimized
              ? 'bottom-4 right-4'
              : 'bottom-6 right-6 max-w-sm w-[calc(100vw-2rem)]',
          )}
        >
          {isMinimized ? (
            /* Minimized Focus Pill */
            <div
              onClick={() => setIsMinimized(false)}
              className="group gap-2.5 px-3.5 py-2 backdrop-blur-md flex cursor-pointer items-center rounded-full border border-primary/40 bg-surface/95 text-foreground shadow-overlay transition-all hover:scale-105 hover:border-primary"
            >
              <div className="size-4 relative flex items-center justify-center">
                <div className="size-3 animate-ping absolute rounded-full bg-primary opacity-75" />
                <span className="text-xs">🎯</span>
              </div>
              <span className="text-xs font-semibold font-mono text-primary">
                {formatTime(remainingSeconds)}
              </span>
              <Maximize2 className="size-3 text-muted-foreground group-hover:text-foreground" />
            </div>
          ) : (
            /* Full Focus Card */
            <div className="rounded-2xl backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 overflow-hidden border border-border bg-popover/95 text-foreground duration-200">
              {/* Header */}
              <div className="px-3.5 py-2 text-xs flex items-center justify-between border-b border-border bg-surface-muted/50">
                <div className="gap-1.5 font-medium flex items-center text-foreground">
                  <span className="size-2 animate-pulse rounded-full bg-success" />
                  Focus Mode Active
                </div>
                <div className="gap-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Minimize"
                  >
                    <Minimize2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStopSession(false)}
                    className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="End Session"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col items-center text-center">
                {/* Circular Progress & Timer */}
                <div className="size-28 my-1 relative flex items-center justify-center">
                  <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      className="text-border"
                      strokeWidth="6"
                      stroke="currentColor"
                      fill="transparent"
                      r="42"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className="text-primary transition-all duration-1000 ease-linear"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 42}
                      strokeDashoffset={
                        2 * Math.PI * 42 * (1 - progressPercent / 100)
                      }
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="42"
                      cx="50"
                      cy="50"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold tracking-tight font-mono text-foreground">
                      {formatTime(remainingSeconds)}
                    </span>
                    <span className="font-medium text-[10px] text-muted-foreground uppercase">
                      {isPaused ? 'Paused' : 'Focusing'}
                    </span>
                  </div>
                </div>

                {/* Task Objective */}
                {taskObjective ? (
                  <div className="mt-1 mb-2 px-2 py-0.5 font-medium gap-1 flex max-w-full items-center truncate rounded-full bg-primary/10 text-[11px] text-primary-text">
                    <Target className="size-3 shrink-0" />
                    <span className="truncate">{taskObjective}</span>
                  </div>
                ) : (
                  <div className="mt-1 mb-2 text-[11px] text-muted-foreground">
                    Deep Work in Progress
                  </div>
                )}

                {/* Controls */}
                <div className="gap-2 mt-2 flex items-center">
                  {/* Pause / Resume */}
                  <Button
                    variant={isPaused ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => (isPaused ? resumeFocus() : pauseFocus())}
                    className="h-8 px-3 text-xs gap-1.5"
                  >
                    {isPaused ? (
                      <>
                        <Play className="size-3.5" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="size-3.5" /> Pause
                      </>
                    )}
                  </Button>

                  {/* +5 mins */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addTime(5)}
                    className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    title="Add 5 minutes"
                  >
                    <Plus className="size-3.5" /> 5m
                  </Button>

                  {/* Sound control popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-8 px-2.5 text-xs gap-1',
                          soundType !== 'none'
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                        title="Ambient Sound"
                      >
                        {soundType !== 'none' ? (
                          <Volume2 className="size-3.5" />
                        ) : (
                          <VolumeX className="size-3.5" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      className="w-56 p-2 border-border bg-popover"
                    >
                      <div className="font-semibold mb-1.5 px-1 text-[11px] text-muted-foreground">
                        Ambient Soundscape
                      </div>
                      <div className="space-y-1">
                        {FOCUS_SOUND_OPTIONS.map((snd) => (
                          <button
                            key={snd.id}
                            type="button"
                            onClick={() => setSound(snd.id)}
                            className={cn(
                              'p-1.5 rounded text-xs flex w-full items-center justify-between transition-colors',
                              soundType === snd.id
                                ? 'font-medium bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-accent',
                            )}
                          >
                            <span className="gap-2 flex items-center">
                              <span>{snd.icon}</span>
                              <span>{snd.name}</span>
                            </span>
                            {soundType === snd.id && (
                              <CheckCircle2 className="size-3 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                      {soundType !== 'none' && (
                        <div className="pt-2 mt-2 gap-2 px-1 flex items-center border-t border-border">
                          <Volume2 className="size-3 text-muted-foreground" />
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={soundVolume}
                            onChange={(e) =>
                              setVolume(parseFloat(e.target.value))
                            }
                            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-border accent-primary"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  {/* Finish Session */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStopSession(true)}
                    className="h-8 px-2.5 text-xs text-success hover:bg-success/10 hover:text-success"
                    title="Complete Session"
                  >
                    <CheckCircle2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
