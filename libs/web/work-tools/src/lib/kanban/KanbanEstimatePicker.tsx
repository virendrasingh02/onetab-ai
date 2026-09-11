import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check } from 'lucide-react';
import React, { useState } from 'react';

export interface KanbanEstimatePickerProps {
  /** Points, or `null`/`undefined` for "no estimate". */
  estimate?: number | null;
  onEstimateChange: (estimate: number | null) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

/**
 * The Fibonacci-ish scale the spreadsheet and timeline views already print
 * estimates in ("N pts") — this is just the first place a person sets one.
 */
const SCALE = [0, 1, 2, 3, 5, 8, 13, 21];

export function KanbanEstimatePicker({
  estimate,
  onEstimateChange,
  trigger,
  align = 'start',
}: KanbanEstimatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-44 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
      >
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onEstimateChange(null);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
              estimate == null
                ? 'bg-accent text-foreground'
                : 'text-foreground/85 hover:bg-accent/60',
            )}
          >
            <span className="text-muted-foreground">No estimate</span>
            {estimate == null && <Check className="size-3.5 shrink-0 stroke-[2.5]" />}
          </button>

          {SCALE.map((points) => {
            const isSelected = estimate === points;
            return (
              <button
                key={points}
                type="button"
                onClick={() => {
                  onEstimateChange(points);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-mono font-medium transition-colors',
                  isSelected
                    ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                    : 'text-foreground/90 hover:bg-accent/60',
                )}
              >
                <span>{points} pts</span>
                {isSelected && <Check className="size-3.5 shrink-0 stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
