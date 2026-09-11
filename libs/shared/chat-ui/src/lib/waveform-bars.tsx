import { cn } from '@org/utils';

export interface WaveformBarsProps {
  /** Normalised 0..1 samples. Rendered as a flat 32-bar placeholder when
   *  there's nothing meaningful to show yet (fewer than 2 samples). */
  samples: number[];
  /** 0..1 playback progress — bars up to this fraction render as "played". */
  progress?: number;
  /** In-progress recording: every bar reads as active rather than tracking a
   *  playback cursor, since there's no "played" position while capturing. */
  live?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * One waveform-bar renderer shared by the sent voice-message bubble, the
 * live in-progress recording view, and the preview-before-send view — so
 * there is exactly one implementation of "a row of bars" rather than three
 * near-identical copies of the same JSX.
 */
export function WaveformBars({
  samples,
  progress = 0,
  live = false,
  className,
  'aria-label': ariaLabel,
}: WaveformBarsProps) {
  const bars =
    samples.length > 1 ? samples : Array.from({ length: 32 }, () => 0.35);

  return (
    <div
      className={cn('h-8 flex flex-1 items-center gap-px', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {bars.map((sample, index) => {
        const played = live || index / bars.length <= progress;
        return (
          <span
            key={index}
            className={cn(
              'flex-1 rounded-full',
              played ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
            style={{ height: `${Math.max(10, sample * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
