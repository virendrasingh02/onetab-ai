import { cn } from '@org/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';

/* -------------------------------------------------------------------------- */
/* Platform Resolution & Key Normalization                                     */
/* -------------------------------------------------------------------------- */

export type Platform = 'mac' | 'windows' | 'linux' | 'other';

/**
 * Returns detected OS platform with fallback for SSR.
 */
export function getPlatform(): Platform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'mac';
  }

  // Modern Client Hints API
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platformStr = (
    nav.userAgentData?.platform ||
    nav.platform ||
    nav.userAgent ||
    ''
  ).toLowerCase();

  if (
    platformStr.includes('mac') ||
    platformStr.includes('iphone') ||
    platformStr.includes('ipad') ||
    platformStr.includes('darwin')
  ) {
    return 'mac';
  }
  if (platformStr.includes('win')) {
    return 'windows';
  }
  if (platformStr.includes('linux') || platformStr.includes('x11')) {
    return 'linux';
  }
  return 'other';
}

/**
 * Hook for reliable OS platform detection with hydration safety.
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(() => getPlatform());

  useEffect(() => {
    setPlatform(getPlatform());
  }, []);

  return platform;
}

/**
 * Symbol & display mapping for known keys across macOS and Windows/Linux.
 */
const KEY_MAP_MAC: Record<string, string> = {
  mod: '⌘',
  cmd: '⌘',
  command: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  opt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  escape: 'Esc',
  esc: 'Esc',
  tab: '⇥',
  space: 'Space',
  backspace: '⌫',
  delete: '⌦',
  del: '⌦',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

const KEY_MAP_DEFAULT: Record<string, string> = {
  mod: 'Ctrl',
  cmd: 'Ctrl',
  command: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  opt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  return: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Del',
  del: 'Del',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

/**
 * Normalizes and formats a key name based on platform.
 */
export function formatKey(key: string, platform: Platform = getPlatform()): string {
  const trimmed = key.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  const map = platform === 'mac' ? KEY_MAP_MAC : KEY_MAP_DEFAULT;

  if (map[lower]) {
    return map[lower];
  }

  // Single character uppercase
  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }

  // Function keys F1-F12
  if (/^f[1-9][0-2]?$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Capitalize word
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Splits a shortcut string (e.g. "mod+shift+k" or "Ctrl+K" or "G then U") into structured key tokens.
 */
export function parseShortcutString(
  shortcut: string,
): Array<{ type: 'key' | 'separator'; value: string }> {
  const trimmed = shortcut.trim();
  if (!trimmed) return [];

  // Space-separated with connectors like "then", "or", "to"
  if (trimmed.includes(' ') && !trimmed.includes('+')) {
    const tokens = trimmed.split(/\s+/);
    return tokens.map((token) => {
      const lower = token.toLowerCase();
      if (lower === 'then' || lower === 'or' || lower === 'to' || token === '/' || token === '+') {
        return { type: 'separator', value: token };
      }
      return { type: 'key', value: token };
    });
  }

  // Standard plus-separated shortcuts (e.g. "Ctrl+Shift+P" or "mod+k")
  if (trimmed.includes('+')) {
    const parts = trimmed.split('+').map((p) => p.trim()).filter(Boolean);
    const result: Array<{ type: 'key' | 'separator'; value: string }> = [];
    parts.forEach((part, i) => {
      if (i > 0) {
        result.push({ type: 'separator', value: '+' });
      }
      result.push({ type: 'key', value: part });
    });
    return result;
  }

  // Single token
  return [{ type: 'key', value: trimmed }];
}

/* -------------------------------------------------------------------------- */
/* Kbd Component                                                              */
/* -------------------------------------------------------------------------- */

export const kbdVariants = cva(
  'inline-flex items-center justify-center font-medium font-sans select-none tracking-tight rounded-[4px] leading-none transition-colors duration-(--duration-fast) ease-standard',
  {
    variants: {
      variant: {
        default:
          'border border-border bg-surface-raised text-subtle shadow-[0_1px_0_0_rgba(0,0,0,0.04)] dark:text-muted-foreground',
        outline:
          'border border-border bg-transparent text-subtle dark:text-muted-foreground',
        muted:
          'border border-border/50 bg-muted/60 text-muted-foreground',
        ghost:
          'border-transparent bg-transparent text-muted-foreground',
        elevated:
          'border border-border bg-surface text-foreground shadow-xs',
      },
      size: {
        xs: 'h-4 min-w-4 px-1 text-[9px]',
        sm: 'h-[18px] min-w-[18px] px-1.5 text-[10px]',
        md: 'h-5 min-w-5 px-1.5 text-[11px]',
        lg: 'h-6 min-w-6 px-2 text-xs',
      },
      disabled: {
        true: 'opacity-50 pointer-events-none cursor-not-allowed',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
      disabled: false,
    },
  },
);

export type KbdSize = 'xs' | 'sm' | 'md' | 'lg';
export type KbdVariant = 'default' | 'outline' | 'muted' | 'ghost' | 'elevated';

export interface KbdProps
  extends ComponentPropsWithoutRef<'kbd'>,
    VariantProps<typeof kbdVariants> {
  children?: ReactNode;
  /** Optional accessible description / tooltip hint */
  tooltip?: ReactNode;
}

export const Kbd = forwardRef<ElementRef<'kbd'>, KbdProps>(
  (
    {
      className,
      variant,
      size,
      disabled,
      children,
      title,
      tooltip,
      ...props
    },
    ref,
  ) => {
    return (
      <kbd
        ref={ref}
        data-slot="kbd"
        title={typeof tooltip === 'string' ? tooltip : title}
        className={cn(kbdVariants({ variant, size, disabled, className }))}
        {...props}
      >
        {children}
      </kbd>
    );
  },
);

Kbd.displayName = 'Kbd';

/* -------------------------------------------------------------------------- */
/* KbdGroup Component                                                         */
/* -------------------------------------------------------------------------- */

export interface KbdGroupProps extends ComponentPropsWithoutRef<'span'> {
  children: ReactNode;
  /** Separator rendered between keys, e.g. "+" or "then" */
  separator?: ReactNode;
  /** Uniform size applied to children when applicable */
  size?: KbdSize;
  /** Uniform variant applied to children when applicable */
  variant?: KbdVariant;
}

export const KbdGroup = forwardRef<ElementRef<'span'>, KbdGroupProps>(
  ({ className, children, separator, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="kbd-group"
        className={cn('inline-flex items-center gap-1', className)}
        {...props}
      >
        {separator && Array.isArray(children)
          ? children.map((child, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 && (
                  <span className="font-normal text-[10px] text-muted-foreground/70 select-none px-0.5">
                    {separator}
                  </span>
                )}
                {child}
              </span>
            ))
          : children}
      </span>
    );
  },
);

KbdGroup.displayName = 'KbdGroup';

/* -------------------------------------------------------------------------- */
/* KbdShortcut Component                                                      */
/* -------------------------------------------------------------------------- */

export interface KbdShortcutProps extends ComponentPropsWithoutRef<'span'> {
  /**
   * Array of key names (e.g. `["mod", "K"]` or `["mod", "shift", "P"]`)
   * or a shortcut string (e.g. `"mod+k"` or `"Ctrl+Shift+P"` or `"G then U"`).
   */
  keys?: string[] | string;
  /** Explicit shortcut string alias */
  shortcut?: string;
  /** Separator between keys (default: none or `+` depending on format) */
  separator?: ReactNode;
  /** Kbd size token */
  size?: KbdSize;
  /** Kbd visual variant token */
  variant?: KbdVariant;
  /** Auto-hide or condense on touch/mobile screens */
  responsive?: boolean;
}

export const KbdShortcut = forwardRef<ElementRef<'span'>, KbdShortcutProps>(
  (
    {
      className,
      keys,
      shortcut,
      separator,
      size = 'sm',
      variant = 'default',
      responsive = false,
      ...props
    },
    ref,
  ) => {
    const platform = usePlatform();

    const tokens = useMemo(() => {
      const source = shortcut ?? (Array.isArray(keys) ? keys : typeof keys === 'string' ? keys : '');
      if (Array.isArray(source)) {
        return source.map((key) => ({
          type: 'key' as const,
          value: formatKey(key, platform),
        }));
      }
      if (typeof source === 'string' && source.trim()) {
        const parsed = parseShortcutString(source);
        return parsed.map((item) => ({
          type: item.type,
          value: item.type === 'key' ? formatKey(item.value, platform) : item.value,
        }));
      }
      return [];
    }, [keys, shortcut, platform]);

    if (tokens.length === 0) return null;

    const accessibleLabel = tokens
      .map((t) => (t.type === 'key' ? t.value : ' '))
      .join(' ')
      .trim();

    return (
      <span
        ref={ref}
        data-slot="kbd-shortcut"
        aria-keyshortcuts={accessibleLabel}
        className={cn(
          'inline-flex items-center gap-1',
          responsive && 'hidden sm:inline-flex',
          className,
        )}
        {...props}
      >
        {tokens.map((token, index) => {
          if (token.type === 'separator') {
            return (
              <span
                key={index}
                className="font-normal text-[10px] text-muted-foreground/70 select-none px-0.5"
                aria-hidden
              >
                {separator ?? token.value}
              </span>
            );
          }

          return (
            <Kbd key={index} size={size} variant={variant}>
              {token.value}
            </Kbd>
          );
        })}
      </span>
    );
  },
);

KbdShortcut.displayName = 'KbdShortcut';

/* -------------------------------------------------------------------------- */
/* Centralized Shortcut Registry & Keyboard Hook                              */
/* -------------------------------------------------------------------------- */

export const SHORTCUTS = {
  search: ['mod', 'K'],
  commandPalette: ['mod', 'K'],
  help: ['?'],
  shortcutsDialog: ['mod', '/'],
  newMessage: ['mod', 'N'],
  newChat: ['mod', 'O'],
  close: ['Escape'],
  save: ['mod', 'S'],
  createIssue: ['C'],
  filter: ['F'],
  switchView: ['V'],
  invite: ['I'],
} as const;

export interface ShortcutOptions {
  /** Whether the shortcut listener is active (default: true) */
  enabled?: boolean;
  /** Prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Stop propagation of the key event (default: false) */
  stopPropagation?: boolean;
  /** Allow triggering when focus is inside text inputs/textareas/contenteditable (default: false) */
  enableOnInput?: boolean;
  /** Event type to listen for (default: 'keydown') */
  eventType?: 'keydown' | 'keyup';
  /** Target element to bind (default: window) */
  target?: EventTarget | null;
}

/**
 * Centralized keyboard shortcut hook that cleanly registers, handles modifiers,
 * prevents default actions, avoids input collisions, and unbinds on unmount.
 */
export function useKeyboardShortcut(
  shortcut: string | string[],
  callback: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {},
) {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    enableOnInput = false,
    eventType = 'keydown',
    target,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const eventTarget = target ?? (typeof window !== 'undefined' ? window : null);
    if (!eventTarget) return;

    const keysArray = Array.isArray(shortcut)
      ? shortcut
      : shortcut
          .toLowerCase()
          .split('+')
          .map((k) => k.trim());

    const hasMod = keysArray.some((k) => ['mod', 'cmd', 'ctrl', 'meta'].includes(k.toLowerCase()));
    const hasShift = keysArray.some((k) => k.toLowerCase() === 'shift');
    const hasAlt = keysArray.some((k) => ['alt', 'opt', 'option'].includes(k.toLowerCase()));
    const primaryKey = keysArray
      .filter((k) => !['mod', 'cmd', 'ctrl', 'meta', 'shift', 'alt', 'opt', 'option'].includes(k.toLowerCase()))
      .pop()
      ?.toLowerCase();

    const handleKeyEvent = (event: Event) => {
      const e = event as KeyboardEvent;

      if (!enableOnInput) {
        const targetEl = e.target as HTMLElement | null;
        if (targetEl) {
          const isInput =
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl.tagName) ||
            targetEl.isContentEditable;
          if (isInput) return;
        }
      }

      const modMatched = hasMod ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
      const shiftMatched = hasShift ? e.shiftKey : true;
      const altMatched = hasAlt ? e.altKey : !e.altKey;

      const keyMatched = (() => {
        if (!primaryKey) return true;
        const eventKey = e.key.toLowerCase();
        if (primaryKey === 'escape' || primaryKey === 'esc') return eventKey === 'escape';
        if (primaryKey === 'enter' || primaryKey === 'return') return eventKey === 'enter';
        if (primaryKey === 'space') return eventKey === ' ' || eventKey === 'spacebar' || eventKey === 'space';
        if (primaryKey === 'backspace') return eventKey === 'backspace';
        if (primaryKey === 'delete' || primaryKey === 'del') return eventKey === 'delete';
        if (primaryKey === '?') return e.key === '?' || (e.shiftKey && e.key === '/');
        return eventKey === primaryKey;
      })();

      if (modMatched && shiftMatched && altMatched && keyMatched) {
        if (preventDefault) {
          e.preventDefault();
        }
        if (stopPropagation) {
          e.stopPropagation();
        }
        callback(e);
      }
    };

    eventTarget.addEventListener(eventType, handleKeyEvent);
    return () => {
      eventTarget.removeEventListener(eventType, handleKeyEvent);
    };
  }, [
    shortcut,
    callback,
    enabled,
    preventDefault,
    stopPropagation,
    enableOnInput,
    eventType,
    target,
  ]);
}
