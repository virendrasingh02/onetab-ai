import { cn } from '@org/utils';
import * as MenuPrimitive from '@radix-ui/react-menu';
import { Slot } from '@radix-ui/react-slot';
import { Check, ChevronRight, Circle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { KbdShortcut } from './kbd.js';
import {
  menuDestructiveClasses,
  menuIndicator,
  menuIndicatorInset,
  menuItemClasses,
  menuLabelClasses,
  menuSeparatorClasses,
  menuSurfaceBase,
} from './menu-styles.js';

/* -------------------------------------------------------------------------- */
/* Context Menu State & Trigger                                               */
/* -------------------------------------------------------------------------- */

export interface ContextMenuPoint {
  x: number;
  y: number;
}

type Point = ContextMenuPoint;

interface ContextMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  position: Point;
  setPosition: (point: Point) => void;
  handleContextMenu: (e: ReactMouseEvent) => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

/**
 * Where a `contextmenu` event should anchor the menu.
 *
 * A pointer right-click carries real coordinates. The keyboard gesture (the
 * Menu key, Shift+F10) raises the same event but browsers report it at 0,0 —
 * or at the focused element's corner — so anchor that one under the element
 * that has focus instead of the top-left of the viewport.
 */
export function contextMenuPointFromEvent(
  e: Pick<ReactMouseEvent, 'clientX' | 'clientY' | 'currentTarget' | 'target'>,
): Point {
  if (e.clientX !== 0 || e.clientY !== 0) return { x: e.clientX, y: e.clientY };
  const el =
    (e.target instanceof Element ? e.target : null) ??
    (e.currentTarget instanceof Element ? e.currentTarget : null);
  const rect = el?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return { x: rect.left + Math.min(16, rect.width / 2), y: rect.bottom };
}

export interface ContextMenuProps {
  children: ReactNode;
  modal?: boolean;
  dir?: 'ltr' | 'rtl';
  /** Controlled open state. Leave unset to let the menu manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Controlled anchor point (viewport coordinates). */
  position?: Point;
}

export function ContextMenu({
  children,
  modal = true,
  dir,
  open: openProp,
  onOpenChange,
  position: positionProp,
}: ContextMenuProps) {
  const [openState, setOpenState] = useState(false);
  const [positionState, setPosition] = useState<Point>({ x: 0, y: 0 });
  const open = openProp ?? openState;
  const position = positionProp ?? positionState;

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPosition(contextMenuPointFromEvent(e));
      setOpen(true);
    },
    [setOpen],
  );

  return (
    <ContextMenuContext.Provider
      value={{ open, setOpen, position, setPosition, handleContextMenu }}
    >
      <MenuPrimitive.Root open={open} onOpenChange={setOpen} modal={modal} dir={dir}>
        {children}
      </MenuPrimitive.Root>
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps extends ComponentPropsWithoutRef<'div'> {
  disabled?: boolean;
  /**
   * Merge the right-click handling onto the single child instead of wrapping
   * it in a `<div>` — for list rows (`<li>`, `<article>`) whose markup must not
   * change, and whose text must stay selectable.
   */
  asChild?: boolean;
}

export const ContextMenuTrigger = forwardRef<HTMLDivElement, ContextMenuTriggerProps>(
  ({ disabled = false, asChild = false, onContextMenu, className, children, ...props }, ref) => {
    const context = useContext(ContextMenuContext);

    const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onContextMenu?.(e);
      if (e.defaultPrevented && e.isPropagationStopped()) return;
      context?.handleContextMenu(e);
    };

    const Comp = asChild ? Slot : 'div';

    return (
      <Comp
        ref={ref}
        data-slot="context-menu-trigger"
        data-state={context?.open ? 'open' : 'closed'}
        onContextMenu={handleContextMenu}
        className={asChild ? className : cn('select-none', className)}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

ContextMenuTrigger.displayName = 'ContextMenuTrigger';

/* -------------------------------------------------------------------------- */
/* Context Menu Content & Sub-components                                      */
/* -------------------------------------------------------------------------- */

export interface ContextMenuContentProps
  extends ComponentPropsWithoutRef<typeof MenuPrimitive.Content> {
  collisionPadding?: number;
}

export const ContextMenuContent = forwardRef<
  ElementRef<typeof MenuPrimitive.Content>,
  ContextMenuContentProps
>(({ className, collisionPadding = 8, align = 'start', ...props }, ref) => {
  const context = useContext(ContextMenuContext);

  const virtualRef = useRef({
    getBoundingClientRect: () => {
      const { x, y } = context?.position ?? { x: 0, y: 0 };
      return {
        width: 0,
        height: 0,
        top: y,
        right: x,
        bottom: y,
        left: x,
        x,
        y,
        toJSON: () => ({}),
      } as DOMRect;
    },
  });

  return (
    <>
      <MenuPrimitive.Anchor virtualRef={virtualRef} />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          ref={ref}
          data-slot="context-menu-content"
          align={align}
          collisionPadding={collisionPadding}
          className={cn(
            menuSurfaceBase,
            'max-h-(--radix-menu-content-available-height)',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Portal>
    </>
  );
});

ContextMenuContent.displayName = 'ContextMenuContent';

export const ContextMenuGroup = MenuPrimitive.Group;
export const ContextMenuPortal = MenuPrimitive.Portal;
export const ContextMenuSub = MenuPrimitive.Sub;
export const ContextMenuRadioGroup = MenuPrimitive.RadioGroup;

export interface ContextMenuItemProps
  extends ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  inset?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
  shortcut?: string | string[];
}

export const ContextMenuItem = forwardRef<
  ElementRef<typeof MenuPrimitive.Item>,
  ContextMenuItemProps
>(({ className, inset, destructive, icon, shortcut, children, ...props }, ref) => {
  return (
    <MenuPrimitive.Item
      ref={ref}
      data-slot="context-menu-item"
      data-variant={destructive ? 'destructive' : 'default'}
      className={cn(
        menuItemClasses,
        inset && menuIndicatorInset,
        destructive && menuDestructiveClasses,
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="size-4 shrink-0 text-muted-foreground [&_svg]:size-4 flex items-center justify-center">
          {icon}
        </span>
      )}
      {icon || shortcut ? (
        <span className="flex-1 text-left truncate">{children}</span>
      ) : (
        children
      )}
      {shortcut && (
        <span className="ml-auto inline-flex items-center pl-3">
          <KbdShortcut keys={shortcut} size="xs" variant="muted" />
        </span>
      )}
    </MenuPrimitive.Item>
  );
});

ContextMenuItem.displayName = 'ContextMenuItem';

export type ContextMenuCheckboxItemProps =
  ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem>;

export const ContextMenuCheckboxItem = forwardRef<
  ElementRef<typeof MenuPrimitive.CheckboxItem>,
  ContextMenuCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => {
  return (
    <MenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="context-menu-checkbox-item"
      className={cn(menuItemClasses, menuIndicatorInset, className)}
      checked={checked}
      {...props}
    >
      <span className={menuIndicator}>
        <MenuPrimitive.ItemIndicator>
          <Check className="size-3.5 text-foreground" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
});

ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

export type ContextMenuRadioItemProps =
  ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>;

export const ContextMenuRadioItem = forwardRef<
  ElementRef<typeof MenuPrimitive.RadioItem>,
  ContextMenuRadioItemProps
>(({ className, children, ...props }, ref) => {
  return (
    <MenuPrimitive.RadioItem
      ref={ref}
      data-slot="context-menu-radio-item"
      className={cn(menuItemClasses, menuIndicatorInset, className)}
      {...props}
    >
      <span className={menuIndicator}>
        <MenuPrimitive.ItemIndicator>
          <Circle className="size-1.5 fill-current text-foreground" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
});

ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

export interface ContextMenuLabelProps
  extends ComponentPropsWithoutRef<typeof MenuPrimitive.Label> {
  inset?: boolean;
}

export const ContextMenuLabel = forwardRef<
  ElementRef<typeof MenuPrimitive.Label>,
  ContextMenuLabelProps
>(({ className, inset, ...props }, ref) => {
  return (
    <MenuPrimitive.Label
      ref={ref}
      data-slot="context-menu-label"
      className={cn(menuLabelClasses, inset && menuIndicatorInset, className)}
      {...props}
    />
  );
});

ContextMenuLabel.displayName = 'ContextMenuLabel';

export type ContextMenuSeparatorProps =
  ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>;

export const ContextMenuSeparator = forwardRef<
  ElementRef<typeof MenuPrimitive.Separator>,
  ContextMenuSeparatorProps
>(({ className, ...props }, ref) => {
  return (
    <MenuPrimitive.Separator
      ref={ref}
      data-slot="context-menu-separator"
      className={cn(menuSeparatorClasses, className)}
      {...props}
    />
  );
});

ContextMenuSeparator.displayName = 'ContextMenuSeparator';

export interface ContextMenuShortcutProps extends ComponentProps<'span'> {
  keys?: string[] | string;
}

export function ContextMenuShortcut({
  className,
  keys,
  children,
  ...props
}: ContextMenuShortcutProps) {
  if (keys) {
    return (
      <span className={cn('pl-3 ml-auto inline-flex items-center', className)} {...props}>
        <KbdShortcut keys={keys} size="xs" variant="muted" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'pl-3 font-normal tracking-wide ml-auto font-mono text-[10px] text-subtle inline-flex items-center gap-1',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <KbdShortcut shortcut={children} size="xs" variant="muted" />
      ) : (
        children
      )}
    </span>
  );
}

export interface ContextMenuSubTriggerProps
  extends ComponentPropsWithoutRef<typeof MenuPrimitive.SubTrigger> {
  inset?: boolean;
}

export const ContextMenuSubTrigger = forwardRef<
  ElementRef<typeof MenuPrimitive.SubTrigger>,
  ContextMenuSubTriggerProps
>(({ className, inset, children, ...props }, ref) => {
  return (
    <MenuPrimitive.SubTrigger
      ref={ref}
      data-slot="context-menu-sub-trigger"
      className={cn(
        menuItemClasses,
        'data-[state=open]:bg-accent',
        inset && menuIndicatorInset,
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="size-3.5 ml-auto shrink-0 text-subtle" />
    </MenuPrimitive.SubTrigger>
  );
});

ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

export interface ContextMenuSubContentProps
  extends ComponentPropsWithoutRef<typeof MenuPrimitive.SubContent> {
  collisionPadding?: number;
}

export const ContextMenuSubContent = forwardRef<
  ElementRef<typeof MenuPrimitive.SubContent>,
  ContextMenuSubContentProps
>(({ className, collisionPadding = 8, ...props }, ref) => {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        ref={ref}
        data-slot="context-menu-sub-content"
        collisionPadding={collisionPadding}
        className={cn(
          menuSurfaceBase,
          'max-h-(--radix-menu-content-available-height)',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
});

ContextMenuSubContent.displayName = 'ContextMenuSubContent';
