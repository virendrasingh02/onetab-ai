import { cn } from '@org/utils';
import type { ComponentProps, ReactNode } from 'react';

export interface InputProps extends ComponentProps<'input'> {
  /** Decoration rendered inside the field, before the text. */
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  invalid?: boolean;
}

export function Input({
  className,
  type = 'text',
  leadingIcon,
  trailingSlot,
  invalid,
  ...props
}: InputProps) {
  const field = (
    <input
      type={type}
      data-slot="input"
      aria-invalid={invalid || undefined}
      className={cn(
        'border-[#27272A] bg-[#111113] text-[#FAFAFA] flex h-[36px] w-full min-w-0 rounded-[8px] border px-3 py-1 text-xs',
        'placeholder:text-[#71717A]',
        'transition-all duration-[120ms] outline-none',
        'focus-visible:border-[#6E56CF] focus-visible:ring-1 focus-visible:ring-[#6E56CF]/40',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'aria-invalid:border-[#E5484D] aria-invalid:ring-[#E5484D]/25',
        'file:text-[#FAFAFA] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium',
        leadingIcon && 'pl-9',
        trailingSlot && 'pr-9',
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailingSlot) return field;

  return (
    <div className="relative w-full">
      {leadingIcon ? (
        <span
          aria-hidden
          className="text-[#71717A] pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 [&_svg]:size-4"
        >
          {leadingIcon}
        </span>
      ) : null}
      {field}
      {trailingSlot ? (
        <span className="absolute top-1/2 right-2 -translate-y-1/2">
          {trailingSlot}
        </span>
      ) : null}
    </div>
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      className={cn(
        'border-[#27272A] bg-[#111113] text-[#FAFAFA] flex min-h-16 w-full rounded-[8px] border px-3 py-2 text-xs',
        'placeholder:text-[#71717A] field-sizing-content resize-none',
        'transition-all duration-[120ms] outline-none',
        'focus-visible:border-[#6E56CF] focus-visible:ring-1 focus-visible:ring-[#6E56CF]/40',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'aria-invalid:border-[#E5484D] aria-invalid:ring-[#E5484D]/25',
        className,
      )}
      {...props}
    />
  );
}
