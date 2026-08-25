import { cn } from '@org/utils';
import { Check } from 'lucide-react';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

interface ContextMenuContextValue {
  isOpen: boolean;
  position: { x: number; y: number };
  openMenu: (e: React.MouseEvent) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export interface ContextMenuProps {
  children: ReactNode;
}

export function ContextMenu({ children }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => closeMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleClose, true);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [isOpen, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ isOpen, position, openMenu, closeMenu }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps extends ComponentProps<'div'> {
  disabled?: boolean;
}

export function ContextMenuTrigger({
  disabled = false,
  onContextMenu,
  className,
  children,
  ...props
}: ContextMenuTriggerProps) {
  const context = useContext(ContextMenuContext);

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    onContextMenu?.(e);
    context?.openMenu(e);
  };

  return (
    <div onContextMenu={handleContextMenu} className={cn('select-none', className)} {...props}>
      {children}
    </div>
  );
}

export type ContextMenuContentProps = ComponentProps<'div'>;

export function ContextMenuContent({ className, children, ...props }: ContextMenuContentProps) {
  const context = useContext(ContextMenuContext);
  const menuRef = useRef<HTMLDivElement>(null);

  if (!context?.isOpen) return null;

  // Ensure menu doesn't overflow viewport boundaries
  const { x, y } = context.position;
  const clampedX = Math.min(x, window.innerWidth - 220);
  const clampedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      style={{ top: `${clampedY}px`, left: `${clampedX}px` }}
      className={cn(
        'fixed z-50 min-w-48 overflow-hidden rounded-popup border border-border bg-popover p-1 text-popover-foreground shadow-overlay',
        'animate-in fade-in-80 zoom-in-95 duration-100',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ContextMenuItemProps extends ComponentProps<'button'> {
  inset?: boolean;
  destructive?: boolean;
  shortcut?: string;
  icon?: ReactNode;
}

export function ContextMenuItem({
  className,
  inset,
  destructive,
  shortcut,
  icon,
  children,
  onClick,
  disabled,
  ...props
}: ContextMenuItemProps) {
  const context = useContext(ContextMenuContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(e);
    context?.closeMenu();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors duration-(--duration-fast)',
        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
        disabled && 'pointer-events-none opacity-50',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {icon && <span className="mr-2 size-4 shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
      {shortcut && <kbd className="ml-auto text-[10px] tracking-widest text-subtle">{shortcut}</kbd>}
    </button>
  );
}

export function ContextMenuSeparator({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

export function ContextMenuLabel({
  className,
  inset,
  children,
  ...props
}: ComponentProps<'div'> & { inset?: boolean }) {
  return (
    <div
      className={cn('px-2 py-1 text-[11px] font-semibold text-subtle uppercase tracking-wider', inset && 'pl-8', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContextMenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<'button'>, 'onChange'> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const context = useContext(ContextMenuContext);

  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        onCheckedChange?.(!checked);
        context?.closeMenu();
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none transition-colors duration-(--duration-fast)',
        'hover:bg-accent hover:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check className="size-4 text-primary" />}
      </span>
      <span>{children}</span>
    </button>
  );
}
