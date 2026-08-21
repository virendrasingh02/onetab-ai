import { cn } from '@org/utils';
import { X } from 'lucide-react';
import {
  useEffect,
  type ComponentProps,
  type ReactNode,
} from 'react';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position?: 'bottom' | 'left' | 'right';
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export function Drawer({
  open,
  onOpenChange,
  position = 'bottom',
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const positionClasses = {
    bottom:
      'inset-x-0 bottom-0 max-h-[85vh] rounded-t-dialog border-t animate-in slide-in-from-bottom duration-200',
    left:
      'inset-y-0 left-0 w-full max-w-sm rounded-r-dialog border-r animate-in slide-in-from-left duration-200',
    right:
      'inset-y-0 right-0 w-full max-w-sm rounded-l-dialog border-l animate-in slide-in-from-right duration-200',
  }[position];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer content */}
      <div
        className={cn(
          'fixed z-50 flex flex-col border-border bg-popover p-6 shadow-overlay text-popover-foreground overflow-hidden',
          positionClasses,
          className,
        )}
      >
        {position === 'bottom' && (
          <div className="mx-auto -mt-3 mb-4 h-1.5 w-12 rounded-full bg-border-strong" />
        )}

        {(title || description || showCloseButton) && (
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div className="space-y-1">
              {title && <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>}
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="size-7 rounded-btn inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pt-4 scrollbar-subtle">{children}</div>
      </div>
    </div>
  );
}

export function DrawerFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 pt-4 border-t border-border mt-auto', className)}
      {...props}
    />
  );
}
