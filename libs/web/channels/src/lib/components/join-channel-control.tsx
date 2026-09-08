import { TEMP_MEMBERSHIP_PRESETS } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@org/ui';
import { ChevronDown, Clock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useJoinChannel } from '../use-channels.js';

export interface JoinChannelControlProps {
  workspaceId: string | undefined;
  channelId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onJoined?: () => void;
}

/**
 * "Join" split button for a public channel: the main press joins permanently,
 * the caret offers timed joins — 24h / 48h / 1 week / custom (brief §8).
 */
export function JoinChannelControl({
  workspaceId,
  channelId,
  size = 'sm',
  className,
  onJoined,
}: JoinChannelControlProps) {
  const join = useJoinChannel(workspaceId);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('12');
  const [customUnit, setCustomUnit] = useState<'hours' | 'days'>('hours');

  const doJoin = (durationHours?: number) =>
    join.mutate(
      { channelId, durationHours },
      { onSuccess: () => onJoined?.() },
    );

  const submitCustom = (event: FormEvent) => {
    event.preventDefault();
    const n = Number(customValue);
    if (!Number.isFinite(n) || n <= 0) return;
    doJoin(customUnit === 'days' ? n * 24 : n);
    setCustomOpen(false);
  };

  return (
    <>
      <div className={`inline-flex ${className ?? ''}`}>
        <Button
          size={size}
          disabled={join.isPending}
          onClick={() => doJoin()}
          className="rounded-r-none"
        >
          Join
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size={size}
              disabled={join.isPending}
              aria-label="Join for a limited time"
              className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="gap-1.5 flex items-center text-[11px] uppercase tracking-wide text-muted-foreground">
              <Clock className="size-3" />
              Join temporarily
            </DropdownMenuLabel>
            {TEMP_MEMBERSHIP_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.hours}
                className="text-xs"
                onSelect={() => doJoin(preset.hours)}
              >
                For {preset.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs"
              onSelect={() => setCustomOpen(true)}
            >
              Custom…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-xs">
          <form onSubmit={submitCustom}>
            <DialogHeader>
              <DialogTitle>Join temporarily</DialogTitle>
              <DialogDescription>
                You will be removed automatically when the time is up.
              </DialogDescription>
            </DialogHeader>
            <div className="gap-2 px-6 py-4 flex items-center">
              <Input
                type="number"
                min={1}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="w-24"
                autoFocus
              />
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
                {(['hours', 'days'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setCustomUnit(unit)}
                    aria-pressed={customUnit === unit}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                      customUnit === unit
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={join.isPending}>
                Join
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
