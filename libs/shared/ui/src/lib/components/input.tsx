import { cn } from '@org/utils';
import type { ComponentProps, ReactNode, Ref } from 'react';
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from 'react-textarea-autosize';

/**
 * The one look every text control shares: theme-fixed field surface, input
 * border, input radius and the brand focus ring. Inputs, textareas and
 * composite controls (chip/tag inputs, search-with-pills) all use it, so a
 * hand-rolled box can never drift from `<Input>`. `theme-fixed` keeps it the
 * same in every workspace theme; it follows light/dark mode only.
 */
export const fieldBoxClass =
  'rounded-input border border-input theme-fixed bg-field text-foreground transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast)';

/** Focus treatment for a box that wraps its input (`focus-within`). */
export const fieldBoxFocusWithinClass =
  'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25';

/** Invalid treatment for a composite box (a bare input uses `aria-invalid:`). */
export const fieldBoxInvalidClass =
  'border-destructive ring-2 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20';

/** Text/placeholder styling for an `<input>` sitting inside a field box. */
export const fieldBoxInputClass =
  'min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-foreground outline-none placeholder:text-subtle';

export interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  /** Icon rendered inside the field, before the text. */
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  /**
   * Inline text affix shown inside the field, before the value — e.g. `@` for a
   * handle. Muted and non-interactive; sits inside the same bordered box.
   */
  prefix?: ReactNode;
  /** Inline text affix shown inside the field, after the value — e.g. `@gmail.com`. */
  suffix?: ReactNode;
  invalid?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  /**
   * Classes for the positioning wrapper that a decorated field renders.
   */
  wrapperClassName?: string;
}

export function Input({
  className,
  type = 'text',
  leadingIcon,
  trailingSlot,
  prefix,
  suffix,
  invalid,
  inputSize = 'md',
  wrapperClassName,
  ...props
}: InputProps) {
  const sizeClasses = {
    sm: 'h-7 px-2.5 text-xs',
    md: 'h-8 px-3 text-xs',
    lg: 'h-9 px-3.5 text-sm',
  }[inputSize];

  const isInvalid = invalid ?? props['aria-invalid'] ?? undefined;

  // Inline text affixes render inside a shared bordered box so `@` / `@gmail.com`
  // sit flush with the value, matching the platform field spec.
  if (prefix != null || suffix != null) {
    return (
      <div
        data-slot="input-affix"
        aria-invalid={isInvalid}
        className={cn(
          'gap-1.5 flex w-full items-center',
          fieldBoxClass,
          sizeClasses,
          // Comfortable tap height on touch; the global 16px font rule below
          // `sm` needs the extra room anyway.
          'pointer-coarse:min-h-11',
          fieldBoxFocusWithinClass,
          'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-surface-muted has-[input:disabled]:text-disabled has-[input:disabled]:opacity-100',
          (invalid || isInvalid === true || isInvalid === 'true') &&
            'border-destructive ring-2 ring-destructive/20',
          wrapperClassName,
        )}
      >
        {prefix != null ? (
          <span className="[&_svg]:size-3.5 pointer-events-none shrink-0 text-subtle select-none">
            {prefix}
          </span>
        ) : null}
        <input
          type={type}
          data-slot="input"
          aria-invalid={isInvalid}
          className={cn(
            'min-w-0 p-0 flex-1 border-0 bg-transparent text-inherit outline-none',
            'placeholder:text-subtle disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {suffix != null ? (
          <span className="[&_svg]:size-3.5 pointer-events-none shrink-0 text-subtle select-none">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  }

  const field = (
    <input
      type={type}
      data-slot="input"
      aria-invalid={isInvalid}
      className={cn(
        'min-w-0 flex w-full',
        fieldBoxClass,
        sizeClasses,
        'pointer-coarse:min-h-11',
        'outline-none placeholder:text-subtle',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-100',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        'file:h-7 file:text-xs file:font-medium file:inline-flex file:border-0 file:bg-transparent file:text-foreground',
        leadingIcon &&
          (inputSize === 'sm' ? 'pl-7' : inputSize === 'lg' ? 'pl-10' : 'pl-9'),
        trailingSlot &&
          (inputSize === 'sm' ? 'pr-7' : inputSize === 'lg' ? 'pr-10' : 'pr-9'),
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
          className={cn(
            '[&_svg]:size-4 pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle',
            inputSize === 'sm' ? 'left-2.5 [&_svg]:size-3.5' : 'left-3',
          )}
        >
          {leadingIcon}
        </span>
      ) : null}
      {field}
      {trailingSlot ? (
        <span className="right-2 absolute top-1/2 flex -translate-y-1/2 items-center">
          {trailingSlot}
        </span>
      ) : null}
    </div>
  );
}

export interface InputGroupProps extends ComponentProps<'div'> {
  prefixNode?: ReactNode;
  suffixNode?: ReactNode;
}

export function InputGroup({
  className,
  prefixNode,
  suffixNode,
  children,
  ...props
}: InputGroupProps) {
  return (
    <div
      className={cn(
        'inline-flex w-full items-stretch overflow-hidden',
        fieldBoxClass,
        fieldBoxFocusWithinClass,
        className,
      )}
      {...props}
    >
      {prefixNode && (
        <div className="px-2.5 text-xs flex items-center border-r border-border bg-surface-raised text-muted-foreground select-none">
          {prefixNode}
        </div>
      )}
      <div className="flex-1 [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:focus-visible:ring-0">
        {children}
      </div>
      {suffixNode && (
        <div className="px-2.5 text-xs flex items-center border-l border-border bg-surface-raised text-muted-foreground select-none">
          {suffixNode}
        </div>
      )}
    </div>
  );
}

export type TextareaProps = TextareaAutosizeProps & {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({
  className,
  invalid,
  rows,
  minRows,
  ...props
}: TextareaProps) {
  const isInvalid = invalid !== undefined ? invalid : props['aria-invalid'];

  return (
    <TextareaAutosize
      data-slot="textarea"
      aria-invalid={isInvalid}
      minRows={minRows ?? rows ?? 2}
      className={cn(
        'min-h-16 px-3 py-2 text-xs flex w-full',
        fieldBoxClass,
        'resize-none outline-none placeholder:text-subtle',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-100',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}
