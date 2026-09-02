import { cn } from '@org/utils';
import type { ComponentProps, ReactNode, Ref } from 'react';
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from 'react-textarea-autosize';

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

  // Inline text affixes render inside a shared bordered box so `@` / `@gmail.com`
  // sit flush with the value, matching the platform field spec.
  if (prefix != null || suffix != null) {
    return (
      <div
        data-slot="input-affix"
        aria-invalid={invalid || undefined}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-input border border-input bg-surface text-foreground',
          sizeClasses,
          'transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast)',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
          'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-surface-muted has-[input:disabled]:text-disabled has-[input:disabled]:opacity-100',
          invalid && 'border-destructive ring-2 ring-destructive/20',
          wrapperClassName,
        )}
      >
        {prefix != null ? (
          <span className="pointer-events-none shrink-0 select-none text-subtle [&_svg]:size-3.5">
            {prefix}
          </span>
        ) : null}
        <input
          type={type}
          data-slot="input"
          aria-invalid={invalid || undefined}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-none',
            'placeholder:text-subtle disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {suffix != null ? (
          <span className="pointer-events-none shrink-0 select-none text-subtle [&_svg]:size-3.5">
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
      aria-invalid={invalid || undefined}
      className={cn(
        'min-w-0 flex w-full rounded-input border border-input bg-surface text-foreground',
        sizeClasses,
        'placeholder:text-subtle',
        'transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast) outline-none',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-100',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        'file:h-7 file:text-xs file:font-medium file:inline-flex file:border-0 file:bg-transparent file:text-foreground',
        leadingIcon && (inputSize === 'sm' ? 'pl-7' : inputSize === 'lg' ? 'pl-10' : 'pl-9'),
        trailingSlot && (inputSize === 'sm' ? 'pr-7' : inputSize === 'lg' ? 'pr-10' : 'pr-9'),
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
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle [&_svg]:size-4',
            inputSize === 'sm' ? 'left-2.5 [&_svg]:size-3.5' : 'left-3',
          )}
        >
          {leadingIcon}
        </span>
      ) : null}
      {field}
      {trailingSlot ? (
        <span className="right-2 absolute top-1/2 -translate-y-1/2 flex items-center">
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
        'inline-flex w-full items-stretch rounded-input border border-input bg-surface focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 overflow-hidden',
        className,
      )}
      {...props}
    >
      {prefixNode && (
        <div className="flex items-center px-2.5 bg-surface-raised border-r border-border text-xs text-muted-foreground select-none">
          {prefixNode}
        </div>
      )}
      <div className="flex-1 [&_input]:border-0 [&_input]:rounded-none [&_input]:focus-visible:ring-0 [&_input]:bg-transparent">
        {children}
      </div>
      {suffixNode && (
        <div className="flex items-center px-2.5 bg-surface-raised border-l border-border text-xs text-muted-foreground select-none">
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
  return (
    <TextareaAutosize
      data-slot="textarea"
      aria-invalid={invalid || undefined}
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

