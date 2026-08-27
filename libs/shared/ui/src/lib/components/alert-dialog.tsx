import { cn } from '@org/utils';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { ComponentProps } from 'react';
import { buttonVariants } from './button.js';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export function AlertDialogOverlay({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        'inset-0 bg-black/40 fixed z-50 backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-(--duration-base)',
        className,
      )}
      {...props}
    />
  );
}

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'max-w-md sm:w-full fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden',
          'bg-popover text-popover-foreground',
          '-translate-x-1/2 -translate-y-1/2',
          'rounded-dialog border border-border shadow-overlay p-6 gap-4',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98',
          'duration-(--duration-base) ease-standard outline-none',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('gap-1.5 flex flex-col text-left', className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        'gap-2 sm:flex-row sm:justify-end flex flex-col-reverse mt-2',
        className,
      )}
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-sm font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-xs text-muted-foreground leading-relaxed', className)}
      {...props}
    />
  );
}

export function AlertDialogAction({
  className,
  variant = 'primary',
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & {
  variant?: 'primary' | 'destructive' | 'outline' | 'secondary';
}) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant: variant === 'primary' ? 'primary' : variant }), className)}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  );
}
