import { cn } from '@org/utils';
import { CheckCircle2 } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Label } from './primitives.js';

export interface FieldProps
  extends Omit<ComponentProps<'div'>, 'children' | 'prefix'> {
  /** Field label. Omit for a bare control with only a hint/error line. */
  label?: ReactNode;
  /** Adds a red `*` after the label. */
  required?: boolean;
  /** Adds a muted "(optional)" tag after the label. Ignored when `required`. */
  optional?: boolean;
  /** Muted helper text under the control. Hidden while `error` or `success` is set. */
  hint?: ReactNode;
  /** Red helper text under the control; also turns the label red. */
  error?: ReactNode;
  /** Green helper text under the control — e.g. "Username is available." */
  success?: ReactNode;
  /** Right-aligned node in the label row — e.g. a "Forgot password?" link or a counter. */
  labelAside?: ReactNode;
  /** Explicit id for the control. Auto-generated and injected into a single child otherwise. */
  htmlFor?: string;
  labelClassName?: string;
  children: ReactNode;
}

/**
 * The platform field wrapper: label (+ required `*` / optional tag), a control,
 * and a single message line that resolves error → success → hint. When
 * `children` is a single element it receives `id`, `aria-invalid` and
 * `aria-describedby` automatically.
 */
export function Field({
  label,
  required,
  optional,
  hint,
  error,
  success,
  labelAside,
  htmlFor,
  className,
  labelClassName,
  children,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const message = error ?? success ?? hint;
  const messageId = message ? `${controlId}-field-msg` : undefined;

  const control =
    isValidElement(children) && (children.props as { id?: string }).id == null
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: controlId,
          'aria-invalid': error
            ? true
            : (children.props as Record<string, unknown>)['aria-invalid'],
          'aria-describedby':
            [
              (children.props as Record<string, unknown>)['aria-describedby'],
              messageId,
            ]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      : children;

  return (
    <div className={cn('grid gap-1.5', className)} {...props}>
      {label != null || labelAside != null ? (
        <div className="flex items-center justify-between gap-2">
          {label != null ? (
            <Label
              htmlFor={controlId}
              className={cn(
                'gap-1 text-xs font-semibold text-foreground',
                error && 'text-destructive',
                labelClassName,
              )}
            >
              {label}
              {required ? (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              ) : optional ? (
                <span className="font-normal text-subtle">(optional)</span>
              ) : null}
            </Label>
          ) : (
            <span />
          )}
          {labelAside}
        </div>
      ) : null}

      {control}

      {message ? (
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn(
            'flex items-center gap-1 text-[11px] leading-snug',
            error
              ? 'font-medium text-destructive'
              : success
                ? 'text-success-text'
                : 'text-muted-foreground',
          )}
        >
          {!error && success ? (
            <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          ) : null}
          {message}
        </p>
      ) : null}
    </div>
  );
}
