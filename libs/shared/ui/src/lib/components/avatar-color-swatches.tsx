import { AVATAR_PALETTE } from '@org/design-system';
import { cn } from '@org/utils';
import { Check } from 'lucide-react';
import { Hint } from './tooltip.js';

export interface AvatarColorSwatchesProps {
  /** The selected palette slot. */
  value: number;
  onChange: (slot: number) => void;
  disabled?: boolean;
  /** Accessible name for the group, e.g. "Avatar colour". */
  label: string;
  className?: string;
}

/**
 * The avatar palette as a radio group of gradient swatches — the one picker
 * for a person's colour (profile) and a workspace's tile colour (settings).
 */
export function AvatarColorSwatches({
  value,
  onChange,
  disabled,
  label,
  className,
}: AvatarColorSwatchesProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {AVATAR_PALETTE.map((swatch, slot) => {
        const selected = slot === value;
        return (
          <Hint key={swatch.name} label={swatch.name} side="top">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={swatch.name}
              disabled={disabled}
              onClick={() => !selected && onChange(slot)}
              className={cn(
                'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
                selected && 'ring-2 ring-foreground',
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, ${swatch.from} 0%, ${swatch.to} 100%)`,
              }}
            >
              {selected ? (
                <Check className="size-3.5 text-white" strokeWidth={3} />
              ) : null}
            </button>
          </Hint>
        );
      })}
    </div>
  );
}
