import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import {
  createContext,
  use,
  useId,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Label } from './primitives.js';

/**
 * React Hook Form bindings.
 *
 * `FormField` wires a field name through context so `FormLabel`, `FormControl`
 * and `FormMessage` can derive matching ids and ARIA wiring without the caller
 * repeating the name at every level.
 */
export const Form = FormProvider;

interface FormFieldContextValue {
  name: string;
}
const FormFieldContext = createContext<FormFieldContextValue | null>(null);

interface FormItemContextValue {
  id: string;
}
const FormItemContext = createContext<FormItemContextValue | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext>
  );
}

export function useFormField() {
  const fieldContext = use(FormFieldContext);
  const itemContext = use(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext?.name as string });

  if (!fieldContext) {
    throw new Error('useFormField must be used within a <FormField>.');
  }
  if (!itemContext) {
    throw new Error('useFormField must be used within a <FormItem>.');
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

export function FormItem({ className, ...props }: ComponentProps<'div'>) {
  const id = useId();
  return (
    <FormItemContext value={{ id }}>
      <div
        data-slot="form-item"
        className={cn('grid gap-2', className)}
        {...props}
      />
    </FormItemContext>
  );
}

export function FormLabel({
  className,
  ...props
}: ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();
  return (
    <Label
      data-error={!!error}
      className={cn('data-[error=true]:text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

export function FormControl(props: ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot
      id={formItemId}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      id={formDescriptionId}
      className={cn('text-muted-foreground text-xs', className)}
      {...props}
    />
  );
}

export function FormMessage({
  className,
  children,
  ...props
}: ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? '') : children;

  // Render nothing rather than an empty <p> that would take up layout space.
  if (!body) return null;

  return (
    <p
      id={formMessageId}
      role="alert"
      className={cn('text-destructive text-xs font-medium', className)}
      {...props}
    >
      {body}
    </p>
  );
}

export interface FormErrorProps {
  /** Server-side / submission error not attached to a single field. */
  error?: string | null;
  children?: ReactNode;
}

/** Banner for form-level failures (bad credentials, conflict, rate limit). */
export function FormError({ error, children }: FormErrorProps) {
  const message = error ?? children;
  if (!message) return null;
  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
    >
      {message}
    </div>
  );
}
