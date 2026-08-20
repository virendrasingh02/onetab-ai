import { cn } from '@org/utils';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import SimpleBar from 'simplebar-react';

/**
 * The one scroll container in the app.
 *
 * Native scrollbars are three different widgets: a 15px always-on gutter that
 * steals layout width on Windows, an overlay bar on macOS, and something else
 * again on Linux/Chrome. `::-webkit-scrollbar` (theme.css) paints the first two
 * but Firefox only honours `scrollbar-width`/`scrollbar-color`, so the same
 * panel never looked the same in two browsers.
 *
 * SimpleBar keeps the *native* scrolling — no hijacked wheel, no re-implemented
 * momentum, no virtualisation surprises — and only replaces the bar itself with
 * a DOM element we can theme. So every browser shows the identical overlay
 * thumb, it costs no layout width, and it fades in on hover/scroll.
 *
 * Two things to know when using it:
 *
 *  - Padding belongs in `contentClassName`, not `className`. SimpleBar's mask
 *    is absolutely positioned against the root's *padding box*, so padding on
 *    the root is painted over rather than respected.
 *  - The element that scrolls is not the root. Reach it with `viewportRef`
 *    (`scrollTop`, `scrollTo`) or `viewportProps` (`onScroll`).
 */
export interface ScrollAreaProps extends Omit<
  ComponentProps<typeof SimpleBar>,
  'children' | 'scrollableNodeProps' | 'ref'
> {
  children?: ReactNode;
  /** Classes for the scrolled content. Put padding and spacing here. */
  contentClassName?: string;
  /** The element that actually scrolls — for reading or setting scroll offset. */
  viewportRef?: RefObject<HTMLDivElement | null>;
  /** Extra props for the scrolling element, e.g. `onScroll` or `tabIndex`. */
  viewportProps?: Omit<ComponentProps<'div'>, 'ref' | 'children'>;
}

export function ScrollArea({
  className,
  contentClassName,
  children,
  viewportRef,
  viewportProps,
  ...options
}: ScrollAreaProps) {
  return (
    <SimpleBar
      data-slot="scroll-area"
      /*
        SimpleBar's own auto-hide is off on purpose. Its rule is "hide ~175ms
        after the pointer stops moving near the track", so the bar vanishes
        while you are still reading the thing you are scrolling, and moving the
        cursor over the *content* hides it again. With autoHide off the class
        stays put and visibility becomes a plain `:hover` question answered in
        CSS — shown the whole time the pointer is inside the container, gone the
        moment it leaves. See the SimpleBar skin in theme.css.
      */
      autoHide={false}
      className={cn('min-h-0', className)}
      {...options}
    >
      {/*
        The render-prop form rather than plain children: SimpleBar's default
        markup stamps `role="region"`, `aria-label="simple bar"` *and*
        `tabIndex={0}` onto the scrolling div. That would register every scroll
        container in the app as an identically-named landmark, and put a tab
        stop in front of the content it wraps — which is how a dialog ends up
        autofocusing its scroll box instead of its first field.

        Owning the element ourselves drops all three and lets a caller's ref sit
        alongside SimpleBar's own. A region whose content has no focusable
        children of its own does still need to be keyboard-scrollable; give it
        `viewportProps={{ tabIndex: 0 }}`.
      */}
      {({ scrollableNodeProps, contentNodeProps }) => (
        <div
          tabIndex={-1}
          {...viewportProps}
          className={cn(
            scrollableNodeProps.className,
            'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            viewportProps?.className,
          )}
          ref={(node) => {
            scrollableNodeProps.ref.current = node ?? undefined;
            if (viewportRef) viewportRef.current = node;
          }}
        >
          <div
            className={cn(contentNodeProps.className, contentClassName)}
            ref={(node) => {
              contentNodeProps.ref.current = node ?? undefined;
            }}
          >
            {children}
          </div>
        </div>
      )}
    </SimpleBar>
  );
}
