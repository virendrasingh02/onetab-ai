import { cn } from '@org/utils';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

/**
 * Edge-anchored panel. Built on the Dialog primitive so it inherits focus
 * trapping, scroll locking and Escape handling.
 */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

const sheetVariants = cva(
  [
    'gap-4 ease-in-out fixed z-50 flex flex-col bg-background shadow-overlay transition',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:duration-200 data-[state=open]:duration-300',
  ],
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top h-auto border-b',
        bottom:
          'inset-x-0 bottom-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom h-auto border-t',
        left: 'inset-y-0 left-0 sm:max-w-sm data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left h-full w-3/4 border-r',
        right:
          'inset-y-0 right-0 sm:max-w-sm data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right h-full w-3/4 border-l',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export interface SheetContentProps
  extends
    ComponentProps<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  hideCloseButton?: boolean;
}

export function SheetContent({
  className,
  children,
  side,
  hideCloseButton = false,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetPrimitive.Overlay
        className={cn(
          'inset-0 bg-black/40 fixed z-50 backdrop-blur-[2px]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {hideCloseButton ? null : (
          <SheetPrimitive.Close
            className={cn(
              'top-4 right-4 p-1 absolute rounded-md opacity-70 transition-opacity hover:opacity-100',
              'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
            )}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('gap-1.5 px-6 pt-6 flex flex-col', className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('gap-2 px-6 pb-6 mt-auto flex flex-col', className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-base font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
