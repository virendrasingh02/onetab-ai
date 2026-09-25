import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  contextMenuPointFromEvent,
  type ContextMenuPoint,
} from '../context-menu.js';
import { Drawer } from '../drawer.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../dropdown-menu.js';
import { KbdShortcut } from '../kbd.js';
import { menuDestructiveClasses } from '../menu-styles.js';
import {
  actionKey,
  collectEntityActions,
  resolveActionSections,
  runEntityAction,
  usePendingActions,
  type EntityAction,
} from './action-model.js';

export type ActionList = readonly (EntityAction | null | undefined | false)[];

/* -------------------------------------------------------------------------- */
/* Shared row content                                                         */
/* -------------------------------------------------------------------------- */

function ActionRowContent({
  action,
  pending,
  showShortcut = true,
}: {
  action: EntityAction;
  pending: boolean;
  showShortcut?: boolean;
}) {
  const Icon = action.icon;
  return (
    <>
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
      >
        {pending ? (
          <Loader2 className="animate-spin" />
        ) : Icon ? (
          <Icon />
        ) : action.checked ? (
          <Check />
        ) : null}
      </span>
      <span className="min-w-0 flex flex-1 flex-col text-left">
        <span className="truncate">{action.label}</span>
        {action.description ? (
          <span className="mt-0.5 whitespace-normal text-[11px] font-normal leading-normal text-muted-foreground">
            {action.description}
          </span>
        ) : null}
      </span>
      {action.hint ? (
        <span className="ml-auto pl-2 text-[10px] font-normal text-muted-foreground tabular-nums">
          {action.hint}
        </span>
      ) : null}
      {action.checked && Icon ? (
        <Check aria-hidden className="ml-auto size-3.5 text-foreground" />
      ) : null}
      {showShortcut && action.shortcut && !action.children ? (
        <span className="ml-auto inline-flex items-center pl-3">
          <KbdShortcut keys={action.shortcut} size="xs" variant="muted" />
        </span>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Menu (context + dropdown) renderer                                         */
/* -------------------------------------------------------------------------- */

type MenuKind = 'context' | 'dropdown';

const PARTS = {
  context: {
    Item: ContextMenuItem,
    Separator: ContextMenuSeparator,
    Sub: ContextMenuSub,
    SubTrigger: ContextMenuSubTrigger,
    SubContent: ContextMenuSubContent,
  },
  dropdown: {
    Item: DropdownMenuItem,
    Separator: DropdownMenuSeparator,
    Sub: DropdownMenuSub,
    SubTrigger: DropdownMenuSubTrigger,
    SubContent: DropdownMenuSubContent,
  },
} as const;

function MenuActionItems({
  actions,
  kind,
  scope,
  onRun,
}: {
  actions: ActionList;
  kind: MenuKind;
  scope?: string;
  onRun: (action: EntityAction) => void;
}) {
  const sections = useMemo(() => resolveActionSections(actions), [actions]);
  const pending = usePendingActions((s) => s.pending);
  const { Item, Separator, Sub, SubTrigger, SubContent } = PARTS[kind];

  return (
    <>
      {sections.map((section, index) => (
        <Fragment key={section.key}>
          {index > 0 ? <Separator /> : null}
          {section.items.map((action) => {
            const isPending = Boolean(pending[actionKey(scope, action.id)]);
            if (action.children) {
              const Icon = action.icon;
              return (
                <Sub key={action.id}>
                  <SubTrigger
                    disabled={action.disabled}
                    title={action.disabled ? action.disabledReason : undefined}
                    className="gap-2"
                  >
                    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
                      {Icon ? <Icon /> : null}
                    </span>
                    <span className="flex-1 truncate text-left">{action.label}</span>
                  </SubTrigger>
                  <SubContent className="min-w-48">
                    <MenuActionItems
                      actions={action.children}
                      kind={kind}
                      scope={scope}
                      onRun={onRun}
                    />
                  </SubContent>
                </Sub>
              );
            }
            return (
              <Item
                key={action.id}
                data-action-id={action.id}
                disabled={action.disabled || isPending}
                aria-busy={isPending || undefined}
                title={action.disabled ? action.disabledReason : undefined}
                className={cn(
                  action.description && 'items-start',
                  action.destructive && menuDestructiveClasses,
                )}
                onSelect={() => onRun(action)}
              >
                <ActionRowContent action={action} pending={isPending} />
              </Item>
            );
          })}
        </Fragment>
      ))}
    </>
  );
}

/** Normalises a displayed shortcut to the single key that triggers it in-menu. */
function menuKeyFor(shortcut: EntityAction['shortcut']): string | null {
  if (!shortcut) return null;
  const keys = Array.isArray(shortcut) ? shortcut : [shortcut];
  if (keys.length !== 1) return null;
  const key = keys[0].toLowerCase();
  if (key === 'del' || key === 'delete') return 'delete';
  return key.length === 1 ? key : null;
}

/**
 * With a menu open, a single-letter shortcut shown beside an item runs it — the
 * letters are real, not decoration. Handled before Radix's type-ahead so "e"
 * never merely moves focus to the first item starting with E.
 */
function useMenuShortcutHandler(actions: ActionList, onRun: (a: EntityAction) => void) {
  return useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const pressed =
        event.key === 'Delete' || event.key === 'Backspace' ? 'delete' : event.key.toLowerCase();
      const match = resolveActionSections(actions)
        .flatMap((s) => s.items)
        .find((a) => !a.disabled && !a.children && menuKeyFor(a.shortcut) === pressed);
      if (!match) return;
      event.preventDefault();
      onRun(match);
    },
    [actions, onRun],
  );
}

/* -------------------------------------------------------------------------- */
/* Touch action sheet                                                         */
/* -------------------------------------------------------------------------- */

export interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ActionList;
  title?: ReactNode;
  scope?: string;
}

/**
 * The touch counterpart to the context menu: the same actions as a bottom
 * sheet with thumb-sized rows. Submenus drill in (with a back row) rather than
 * fly out, since there is nowhere on a phone for a flyout to go.
 */
export function ActionSheet({ open, onOpenChange, actions, title, scope }: ActionSheetProps) {
  const [trail, setTrail] = useState<EntityAction[]>([]);
  const pending = usePendingActions((s) => s.pending);

  useEffect(() => {
    if (!open) setTrail([]);
  }, [open]);

  const current = trail.length > 0 ? (trail[trail.length - 1].children ?? []) : actions;
  const sections = useMemo(() => resolveActionSections(current), [current]);

  const run = (action: EntityAction) => {
    if (action.children) {
      setTrail((t) => [...t, action]);
      return;
    }
    onOpenChange(false);
    void runEntityAction(action, scope);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      position="bottom"
      title={trail.length > 0 ? trail[trail.length - 1].label : title}
      showCloseButton={false}
      className="p-3 pt-6"
    >
      <div role="menu" aria-label={typeof title === 'string' ? title : 'Actions'} className="flex flex-col">
        {trail.length > 0 ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => setTrail((t) => t.slice(0, -1))}
            className="flex min-h-11 items-center gap-3 rounded-btn px-3 text-sm text-muted-foreground active:bg-accent"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back
          </button>
        ) : null}
        {sections.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 ? <div role="separator" className="-mx-3 my-1 h-px bg-border" /> : null}
            {section.items.map((action) => {
              const isPending = Boolean(pending[actionKey(scope, action.id)]);
              const inert = action.disabled || isPending;
              return (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  data-action-id={action.id}
                  disabled={inert}
                  aria-busy={isPending || undefined}
                  onClick={() => run(action)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-btn px-3 text-left text-sm font-medium outline-none',
                    'active:bg-accent focus-visible:bg-accent disabled:opacity-40',
                    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
                    action.destructive &&
                      'text-destructive [&_svg]:text-destructive active:bg-destructive/10',
                  )}
                >
                  <ActionRowContent action={action} pending={isPending} showShortcut={false} />
                  {action.children ? <ChevronRight className="ml-auto" aria-hidden /> : null}
                  {action.disabled && action.disabledReason ? (
                    <span className="sr-only">{action.disabledReason}</span>
                  ) : null}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/* Right-click / long-press wrapper                                           */
/* -------------------------------------------------------------------------- */

const LONG_PRESS_MS = 450;
const LONG_PRESS_TOLERANCE = 10;

/** Right-clicks that should keep the browser's own menu (copy, spellcheck…). */
function wantsNativeMenu(event: ReactMouseEvent, host: Element): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) {
    return true;
  }
  if (target.closest('[data-native-context-menu]')) return true;
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (host.contains(range.commonAncestorContainer)) return true;
  }
  return false;
}

export interface EntityContextMenuProps {
  /** The actions — or a function producing them, evaluated only when opened. */
  actions: ActionList | (() => ActionList);
  /** Pulls in actions other modules registered for this entity type. */
  entityType?: string;
  entity?: unknown;
  /** Dedupe scope for in-flight actions — usually the entity id. */
  scope?: string;
  /** Title of the touch action sheet, e.g. the entity's name. */
  label?: ReactNode;
  disabled?: boolean;
  /**
   * Open the touch action sheet on a long-press. Turn off where a touch-hold
   * already means something else (a drag handle) — the row's "⋯" button then
   * stays the touch entry point. Right-click and the Menu key still work.
   */
  longPress?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** A single element; right-click / long-press / Menu-key handling is merged onto it. */
  children: ReactElement;
}

/**
 * Gives any element a contextual menu of `actions`:
 *
 * - right-click, or the keyboard Menu key / Shift+F10 on the focused element,
 *   opens a menu at the pointer (or under the element);
 * - a touch long-press opens the same actions as a bottom sheet.
 *
 * The child keeps its own markup (the handlers are merged onto it, so `<li>`
 * rows stay `<li>`) and stays text-selectable: a right-click inside an input,
 * or over a live text selection, falls through to the browser's menu so Copy
 * still works. Nested wrappers resolve to the innermost one.
 *
 * Nothing is rendered until the menu opens, so it is safe on every row of a
 * virtualized list.
 */
export function EntityContextMenu({
  actions,
  entityType,
  entity,
  scope,
  label,
  disabled = false,
  longPress = true,
  onOpenChange,
  children,
}: EntityContextMenuProps) {
  const [mode, setMode] = useState<'menu' | 'sheet' | null>(null);
  const [position, setPosition] = useState<ContextMenuPoint>({ x: 0, y: 0 });
  const hostRef = useRef<HTMLElement | null>(null);
  const press = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    x: number;
    y: number;
    fired: boolean;
    touchAt: number;
  }>({ timer: null, x: 0, y: 0, fired: false, touchAt: 0 });

  useEffect(() => () => {
    if (press.current.timer) clearTimeout(press.current.timer);
  }, []);

  const setOpenMode = useCallback(
    (next: 'menu' | 'sheet' | null) => {
      setMode(next);
      onOpenChange?.(next !== null);
    },
    [onOpenChange],
  );

  const resolved = useMemo<ActionList>(() => {
    if (mode === null) return [];
    const base = typeof actions === 'function' ? actions() : actions;
    return collectEntityActions(entityType, entity, base);
  }, [mode, actions, entityType, entity]);

  const run = useCallback(
    (action: EntityAction) => {
      setOpenMode(null);
      void runEntityAction(action, scope);
    },
    [scope, setOpenMode],
  );
  const onMenuKeyDown = useMenuShortcutHandler(resolved, run);

  const cancelPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };

  const handlers = {
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      if (disabled || event.defaultPrevented) return;
      const host = event.currentTarget;
      if (wantsNativeMenu(event, host)) return;
      event.preventDefault();
      event.stopPropagation();
      hostRef.current = host;
      // Android raises contextmenu for a touch long-press too; route it to the
      // sheet (and let the long-press timer's own open be a no-op).
      if (Date.now() - press.current.touchAt < 1500) {
        if (!longPress) return;
        cancelPress();
        press.current.fired = true;
        setOpenMode('sheet');
        return;
      }
      setPosition(contextMenuPointFromEvent(event));
      setOpenMode('menu');
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === 'mouse') return;
      press.current.touchAt = Date.now();
      if (!longPress) return;
      press.current.fired = false;
      press.current.x = event.clientX;
      press.current.y = event.clientY;
      hostRef.current = event.currentTarget;
      cancelPress();
      press.current.timer = setTimeout(() => {
        press.current.timer = null;
        press.current.fired = true;
        try {
          navigator.vibrate?.(10);
        } catch {
          /* vibrate throws in some cross-origin iframes */
        }
        setOpenMode('sheet');
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (!press.current.timer) return;
      if (
        Math.abs(event.clientX - press.current.x) > LONG_PRESS_TOLERANCE ||
        Math.abs(event.clientY - press.current.y) > LONG_PRESS_TOLERANCE
      ) {
        cancelPress();
      }
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    // The tap that ends a long-press must not also activate the row (follow a
    // link, open a message) underneath the sheet it just opened.
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
      if (!press.current.fired) return;
      press.current.fired = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return (
    <>
      <Slot {...handlers} data-context-menu-state={mode ? 'open' : undefined}>
        {children}
      </Slot>
      {mode === 'menu' ? (
        <ContextMenu
          open
          position={position}
          onOpenChange={(open) => {
            if (!open) setOpenMode(null);
          }}
        >
          <ContextMenuContent
            className="w-60"
            onKeyDown={onMenuKeyDown}
            onCloseAutoFocus={(event) => {
              // Hand focus back to the row only if the action didn't move it
              // somewhere on purpose (an editor, a dialog).
              event.preventDefault();
              const active = document.activeElement;
              if (!active || active === document.body) {
                (hostRef.current as HTMLElement | null)?.focus?.({ preventScroll: true });
              }
            }}
          >
            <MenuActionItems actions={resolved} kind="context" scope={scope} onRun={run} />
          </ContextMenuContent>
        </ContextMenu>
      ) : null}
      {mode === 'sheet' ? (
        <ActionSheet
          open
          onOpenChange={(open) => {
            if (!open) setOpenMode(null);
          }}
          actions={resolved}
          title={label}
          scope={scope}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* "⋯" dropdown                                                               */
/* -------------------------------------------------------------------------- */

export interface ActionDropdownMenuProps {
  /** The actions — or a function producing them, evaluated only when opened. */
  actions: ActionList | (() => ActionList);
  entityType?: string;
  entity?: unknown;
  scope?: string;
  /** The button that opens the menu (wrapped in `DropdownMenuTrigger asChild`). */
  trigger: ReactElement;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  contentClassName?: string;
  modal?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rendered above the actions (a header, a quick-reaction strip). */
  header?: ReactNode;
}

/**
 * The same action list behind a "⋯" button — so a row's overflow menu and its
 * right-click menu are literally the same data and cannot disagree.
 */
export function ActionDropdownMenu({
  actions,
  entityType,
  entity,
  scope,
  trigger,
  align = 'end',
  side = 'bottom',
  contentClassName,
  modal,
  open: openProp,
  onOpenChange,
  header,
}: ActionDropdownMenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const resolved = useMemo(
    () =>
      open
        ? collectEntityActions(
            entityType,
            entity,
            typeof actions === 'function' ? actions() : actions,
          )
        : [],
    [open, entityType, entity, actions],
  );
  const run = useCallback(
    (action: EntityAction) => {
      setOpen(false);
      void runEntityAction(action, scope);
    },
    [scope, setOpen],
  );
  const onKeyDown = useMenuShortcutHandler(resolved, run);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={modal}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className={cn('w-60', contentClassName)}
        onKeyDown={onKeyDown}
      >
        {header}
        <MenuActionItems actions={resolved} kind="dropdown" scope={scope} onRun={run} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */
/* Controlled menu at a point                                                 */
/* -------------------------------------------------------------------------- */

export interface ActionContextMenuProps {
  /** Where to open (viewport coordinates); `null` keeps the menu closed. */
  at: ContextMenuPoint | null;
  onClose: () => void;
  actions: ActionList | (() => ActionList);
  entityType?: string;
  entity?: unknown;
  scope?: string;
}

/**
 * The same menu as `EntityContextMenu`, opened by the caller at a point — for
 * surfaces that report "this item was right-clicked here" rather than letting
 * us wrap the item (a React Flow node, a canvas shape, a chart segment).
 */
export function ActionContextMenu({
  at,
  onClose,
  actions,
  entityType,
  entity,
  scope,
}: ActionContextMenuProps) {
  const resolved = useMemo<ActionList>(() => {
    if (!at) return [];
    const base = typeof actions === 'function' ? actions() : actions;
    return collectEntityActions(entityType, entity, base);
  }, [at, actions, entityType, entity]);

  const run = useCallback(
    (action: EntityAction) => {
      onClose();
      void runEntityAction(action, scope);
    },
    [onClose, scope],
  );
  const onKeyDown = useMenuShortcutHandler(resolved, run);

  if (!at) return null;
  return (
    <ContextMenu
      open
      position={at}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ContextMenuContent className="w-60" onKeyDown={onKeyDown}>
        <MenuActionItems actions={resolved} kind="context" scope={scope} onRun={run} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
