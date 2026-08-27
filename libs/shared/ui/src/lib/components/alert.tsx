import { cn } from '@org/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const alertVariants = cva(
  'relative w-full rounded-card border p-4 text-xs [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-surface text-foreground border-border',
        destructive:
          'border-destructive/30 text-destructive-text bg-destructive/10 dark:bg-destructive/15 [&>svg]:text-destructive-text',
        warning:
          'border-warning/30 text-warning-text bg-warning/10 dark:bg-warning/15 [&>svg]:text-warning-text',
        success:
          'border-success/30 text-success-text bg-success/10 dark:bg-success/15 [&>svg]:text-success-text',
        info: 'border-info/30 text-info-text bg-info/10 dark:bg-info/15 [&>svg]:text-info-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: ComponentProps<'h5'>) {
  return (
    <h5
      data-slot="alert-title"
      className={cn('mb-1 font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('text-xs opacity-90 leading-relaxed', className)}
      {...props}
    />
  );
}

export { alertVariants };
