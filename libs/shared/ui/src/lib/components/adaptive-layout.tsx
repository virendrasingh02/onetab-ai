import { cn } from '@org/utils';
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface AdaptiveLayoutProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'content'> {
  sidebar?: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
  /** Container width, px, below which the columns stack (default 640). */
  collapseBelowWidth?: number;
  /** Side column widths while side by side, e.g. `240` or `'15rem'`. */
  sidebarWidth?: number | string;
  asideWidth?: number | string;
  isSidebarOpen?: boolean;
  isAsideOpen?: boolean;
  stackDirection?: 'col' | 'col-reverse';
}

/**
 * Sidebar / content / aside columns that stack once the *container* (not the
 * viewport) gets narrow — so it adapts inside split views and side panels too.
 */
export const AdaptiveLayout = forwardRef<ElementRef<'div'>, AdaptiveLayoutProps>(
  (
    {
      sidebar,
      content,
      aside,
      collapseBelowWidth = 640,
      sidebarWidth = 240,
      asideWidth = 300,
      isSidebarOpen = true,
      isAsideOpen = true,
      stackDirection = 'col',
      className,
      ...props
    },
    forwardedRef,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    // `null` until measured: render side by side, the common desktop case.
    const [containerWidth, setContainerWidth] = useState<number | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    useIsomorphicLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      setContainerWidth(el.getBoundingClientRect().width);
      if (typeof ResizeObserver === 'undefined') return;

      // Observer callbacks already run once per frame, before paint.
      const observer = new ResizeObserver(([entry]) => {
        if (entry) setContainerWidth(entry.contentRect.width);
      });
      observer.observe(el);

      return () => observer.disconnect();
    }, []);

    const isStacked =
      containerWidth !== null &&
      containerWidth > 0 &&
      containerWidth < collapseBelowWidth;

    const toCss = (width: number | string) =>
      typeof width === 'number' ? `${width}px` : width;

    return (
      <div
        ref={setRefs}
        data-slot="adaptive-layout"
        data-stacked={isStacked}
        className={cn(
          'relative flex w-full h-full min-w-0 min-h-0',
          isStacked
            ? cn(
                'overflow-y-auto',
                stackDirection === 'col' ? 'flex-col' : 'flex-col-reverse',
              )
            : 'flex-row overflow-hidden',
          className,
        )}
        {...props}
      >
        {sidebar && isSidebarOpen && (
          <div
            data-slot="adaptive-layout-sidebar"
            style={isStacked ? undefined : { width: toCss(sidebarWidth) }}
            className={cn('shrink-0 min-w-0 min-h-0', isStacked ? 'w-full' : 'h-full')}
          >
            {sidebar}
          </div>
        )}

        <div
          data-slot="adaptive-layout-content"
          className={cn('flex-1 min-w-0 min-h-0', isStacked ? 'w-full' : 'h-full overflow-hidden')}
        >
          {content}
        </div>

        {aside && isAsideOpen && (
          <div
            data-slot="adaptive-layout-aside"
            style={isStacked ? undefined : { width: toCss(asideWidth) }}
            className={cn('shrink-0 min-w-0 min-h-0', isStacked ? 'w-full' : 'h-full')}
          >
            {aside}
          </div>
        )}
      </div>
    );
  },
);

AdaptiveLayout.displayName = 'AdaptiveLayout';
