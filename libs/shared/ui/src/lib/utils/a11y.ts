import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';

/**
 * Screen reader announcement priority.
 * - 'polite': Waits for the user to pause speaking (default, for updates, toasts, state changes).
 * - 'assertive': Interrupts immediately (for critical errors or time-sensitive alerts).
 */
export type AnnouncePriority = 'polite' | 'assertive';

let liveRegionContainer: HTMLDivElement | null = null;
let politeRegion: HTMLDivElement | null = null;
let assertiveRegion: HTMLDivElement | null = null;

function ensureLiveRegions(): { polite: HTMLDivElement; assertive: HTMLDivElement } | null {
  if (typeof document === 'undefined') return null;

  if (!liveRegionContainer || !document.body.contains(liveRegionContainer)) {
    liveRegionContainer = document.createElement('div');
    liveRegionContainer.setAttribute('data-a11y-live-region-container', 'true');
    liveRegionContainer.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

    politeRegion = document.createElement('div');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.setAttribute('role', 'status');

    assertiveRegion = document.createElement('div');
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.setAttribute('role', 'alert');

    liveRegionContainer.appendChild(politeRegion);
    liveRegionContainer.appendChild(assertiveRegion);
    document.body.appendChild(liveRegionContainer);
  }

  return { polite: politeRegion!, assertive: assertiveRegion! };
}

/**
 * Announces a text message to screen readers using an off-screen live region.
 */
export function announceToScreenReader(
  message: string,
  priority: AnnouncePriority = 'polite',
): void {
  if (!message || typeof document === 'undefined') return;

  const regions = ensureLiveRegions();
  if (!regions) return;

  const target = priority === 'assertive' ? regions.assertive : regions.polite;

  // Clear and update on next tick so consecutive identical messages are announced
  target.textContent = '';
  window.setTimeout(() => {
    target.textContent = message;
  }, 50);
}

/**
 * Generates a stable unique ID with an optional prefix for form controls,
 * descriptions, and ARIA relationships.
 */
export function useAccessibleId(prefix = 'a11y'): string {
  const reactId = useId();
  return `${prefix}-${reactId.replace(/:/g, '')}`;
}

/**
 * Returns whether the user has requested reduced motion in their system preferences.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(listener);
      return () => mediaQuery.removeListener(listener);
    }

    return undefined;
  }, []);

  return prefersReducedMotion;
}

export interface FocusManagementOptions {
  /** If true, activates focus trap inside `containerRef`. */
  trap?: boolean;
  /** Whether to restore focus to previously active element on unmount/deactivation. */
  restoreFocus?: boolean;
  /** Element to focus initially when active. Defaults to first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Manages focus trapping and focus restoration for modal overlays, dialogs, and drawers.
 */
export function useFocusManagement<T extends HTMLElement = HTMLElement>(
  containerRef: RefObject<T | null>,
  options: FocusManagementOptions = {},
) {
  const { trap = false, restoreFocus = true, initialFocusRef } = options;
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!trap || typeof document === 'undefined') return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Initial focus
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        container.focus?.();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (restoreFocus && previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [trap, restoreFocus, containerRef, initialFocusRef]);
}

export interface KeyboardNavigationOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onSelect?: (index: number) => void;
  onEscape?: () => void;
}

/**
 * Arrow-key roving keyboard navigation hook for lists, tabs, and menus.
 */
export function useKeyboardNavigation(
  itemCount: number,
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  options: KeyboardNavigationOptions = {},
) {
  const { orientation = 'vertical', loop = true, onSelect, onEscape } = options;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (itemCount === 0) return;

      const isNext =
        (orientation === 'vertical' && e.key === 'ArrowDown') ||
        (orientation === 'horizontal' && e.key === 'ArrowRight') ||
        (orientation === 'both' && (e.key === 'ArrowDown' || e.key === 'ArrowRight'));

      const isPrev =
        (orientation === 'vertical' && e.key === 'ArrowUp') ||
        (orientation === 'horizontal' && e.key === 'ArrowLeft') ||
        (orientation === 'both' && (e.key === 'ArrowUp' || e.key === 'ArrowLeft'));

      if (isNext) {
        e.preventDefault();
        const nextIndex = activeIndex + 1;
        if (nextIndex < itemCount) {
          setActiveIndex(nextIndex);
        } else if (loop) {
          setActiveIndex(0);
        }
      } else if (isPrev) {
        e.preventDefault();
        const prevIndex = activeIndex - 1;
        if (prevIndex >= 0) {
          setActiveIndex(prevIndex);
        } else if (loop) {
          setActiveIndex(itemCount - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(itemCount - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (onSelect) {
          e.preventDefault();
          onSelect(activeIndex);
        }
      } else if (e.key === 'Escape') {
        onEscape?.();
      }
    },
    [itemCount, activeIndex, setActiveIndex, orientation, loop, onSelect, onEscape],
  );

  return { handleKeyDown };
}
