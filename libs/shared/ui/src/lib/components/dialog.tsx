import { cn } from '@org/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { ScrollArea } from './scroll-area.js';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        // 40%, not 60%: a scrim tuned for a near-black app reads as a blackout
        // over a white one. The blur is what separates the layers here.
        'inset-0 bg-black/40 fixed z-50 backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-(--duration-base)',
        className,
      )}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentProps<
  typeof DialogPrimitive.Content
> {
  /** Hide the built-in close button when the footer owns dismissal. */
  hideCloseButton?: boolean;
}

export function DialogContent({
  className,
  children,
  hideCloseButton = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'max-w-lg sm:w-full fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden',
          'bg-popover text-popover-foreground',
          '-translate-x-1/2 -translate-y-1/2',
          'rounded-dialog border border-border shadow-overlay',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98',
          'duration-(--duration-base) ease-standard outline-none',
          className,
        )}
        {...props}
      >
        {/*
          A tall dialog scrolls inside itself, as before — but through the
          shared ScrollArea, so its bar matches the rest of the app. The close
          button sits outside it and therefore stays put while the body scrolls
          instead of sliding off the top.
        */}
        <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
        {hideCloseButton ? null : (
          <DialogPrimitive.Close
            className={cn(
              'top-3.5 right-3.5 p-1 absolute rounded-btn text-muted-foreground',
              'transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:outline-none',
              'disabled:pointer-events-none',
            )}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('gap-1 p-5 pb-2 flex flex-col', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'gap-2 p-5 pt-2 sm:flex-row sm:justify-end flex flex-col-reverse',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'text-sm font-semibold tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}
