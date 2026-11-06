import { cn } from '@org/utils';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

const WIDE_QUERY = '(min-width: 768px)';

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether there is room for the properties rail beside the main column. */
export function useIsWideViewport(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

/** A titled block of property rows; every block after the first gets a rule. */
export function PropertyGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="pt-4 first:pt-0 border-t border-border/60 first:border-t-0"
    >
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

/**
 * One label/value line of the properties rail. The label holds the height of
 * one row, so it stays on the first line when the value wraps, as tags do.
 * Inside a narrow `@container`, such as the side panel, the label gives up its
 * icon so the value keeps enough room.
 */
export function PropertyRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="gap-2 grid grid-cols-[7.25rem_minmax(0,1fr)] items-start @max-[18rem]:grid-cols-[5.25rem_minmax(0,1fr)] @max-[18rem]:gap-1">
      <span className="h-9 gap-2 text-sm flex items-center text-muted-foreground">
        <Icon className="size-4 shrink-0 @max-[18rem]:hidden" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <div className="min-h-9 min-w-0 gap-1 flex items-center">{children}</div>
    </div>
  );
}

interface ValueButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** An unset value, drawn quieter than a real one. */
  empty?: boolean;
}

/**
 * The clickable value in a property row. Refs and props reach the button
 * because each one is the `asChild` trigger of a picker.
 */
export const ValueButton = forwardRef<HTMLButtonElement, ValueButtonProps>(
  function ValueButton({ empty, className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        className={cn(
          'h-8 min-w-0 gap-2 px-2 text-sm font-medium inline-flex max-w-full items-center overflow-hidden rounded-md whitespace-nowrap @max-[18rem]:px-1',
          'transition-colors duration-(--duration-fast) outline-none',
          'hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-default disabled:hover:bg-transparent',
          empty ? 'text-muted-foreground' : 'text-foreground',
          className,
        )}
      >
        {children}
      </button>
    );
  },
);

/** A small icon action after a value, such as clearing or opening it. */
export const ValueAction = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon }
>(function ValueAction({ icon: Icon, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        'size-7 inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground',
        'transition-colors duration-(--duration-fast) outline-none',
        'hover:bg-accent/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
});

/** A titled block of the main column that can be folded away. */
export function Section({
  title,
  icon: Icon,
  summary,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  /** Short count beside the title, e.g. "2/5". */
  summary?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <div className="min-h-7 gap-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="min-w-0 gap-1.5 text-sm font-semibold flex items-center rounded-md text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast)',
              open && 'rotate-90',
            )}
          />
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{title}</span>
          {summary ? (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {summary}
            </span>
          ) : null}
        </button>
        {action ? (
          <div className="gap-1 flex shrink-0 items-center">{action}</div>
        ) : null}
      </div>
      {open && children ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}

/** A quiet text action in a section header. */
export const SectionAction = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon }
>(function SectionAction({ icon: Icon, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        'h-7 gap-1 px-1.5 text-xs font-medium inline-flex items-center rounded-md text-muted-foreground',
        'transition-colors duration-(--duration-fast) outline-none',
        'hover:bg-accent/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>{children}</span>
    </button>
  );
});

/** A thin done/total bar for a list of work. */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} of ${total} done`}
      className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-success transition-[width] duration-(--duration-base)"
        style={{ width: `${(done / total) * 100}%` }}
      />
    </div>
  );
}
