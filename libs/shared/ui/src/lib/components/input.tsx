import { cn } from '@org/utils';
import type { ComponentProps, ReactNode, Ref } from 'react';
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from 'react-textarea-autosize';

export interface InputProps extends ComponentProps<'input'> {
  /** Decoration rendered inside the field, before the text. */
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  invalid?: boolean;
  /**
   * Classes for the positioning wrapper that a decorated field renders.
   *
   * Width has to land on the wrapper, not the field: the field is `w-full`
   * inside it, so a `w-64` passed through `className` is overridden by the
   * wrapper's own `w-full` and the control silently stays full-bleed. Ignored
   * when the field has no decoration and so renders no wrapper.
   */
  wrapperClassName?: string;
}

export function Input({
  className,
  type = 'text',
  leadingIcon,
  trailingSlot,
  invalid,
  wrapperClassName,
  ...props
}: InputProps) {
  const field = (
    <input
      type={type}
      data-slot="input"
      aria-invalid={invalid || undefined}
      className={cn(
        // Tokens, not literals — the field was pinned to a dark ramp
        // (#111113 on #27272A) and stayed dark on the light canvas.
        'h-8 min-w-0 px-3 py-1 text-xs flex w-full rounded-input border border-input bg-surface text-foreground',
        'placeholder:text-subtle',
        'transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast) outline-none',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-100',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        'file:h-7 file:text-xs file:font-medium file:inline-flex file:border-0 file:bg-transparent file:text-foreground',
        leadingIcon && 'pl-9',
        trailingSlot && 'pr-9',
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailingSlot) return field;

  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      {leadingIcon ? (
        <span
          aria-hidden
          className="left-3 [&_svg]:size-4 pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle"
        >
          {leadingIcon}
        </span>
      ) : null}
      {field}
      {trailingSlot ? (
        <span className="right-2 absolute top-1/2 -translate-y-1/2">
          {trailingSlot}
        </span>
      ) : null}
    </div>
  );
}

export type TextareaProps = TextareaAutosizeProps & {
  invalid?: boolean;
  /*
   * `TextareaAutosizeProps` drops `ref` — the underlying component is a
   * `forwardRef`, so its prop type never carried one. Under the React 19 ref
   * contract a caller's `ref` is just a prop that gets spread through, so the
   * type is all that was missing.
   */
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({
  className,
  invalid,
  rows,
  minRows,
  ...props
}: TextareaProps) {
  return (
    <TextareaAutosize
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      /*
       * Autosize writes the measured height as `!important` inline style, which
       * outranks the `rows` attribute the browser would otherwise size from —
       * so every `rows={n}` call site collapsed to one line. `rows` always
       * meant "start this tall", which is exactly `minRows`.
       */
      minRows={minRows ?? rows ?? 2}
      className={cn(
        'min-h-16 px-3 py-2 text-xs flex w-full rounded-input border border-input bg-surface text-foreground',
        'resize-none placeholder:text-subtle',
        'transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast) outline-none',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-100',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}
