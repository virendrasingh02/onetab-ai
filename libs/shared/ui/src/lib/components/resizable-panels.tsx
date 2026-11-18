import { cn } from '@org/utils';
import type { ComponentProps, ReactNode } from 'react';
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type Layout,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';

/*
 * Resizable layout primitives, built on `react-resizable-panels`.
 *
 * Why a library rather than the hand-rolled pointer handlers this replaced:
 * the old versions pushed every `pointermove` through React state in the
 * component that owned the layout, so dragging a handle re-rendered the whole
 * subtree (for the app shell: sidebar, routed page and side rail) once per
 * frame. The library resizes panels by writing flex styles directly and only
 * calls back into React when the drag ends (`onLayoutChanged`), so a drag
 * costs layout + paint and nothing else. It also brings pixel / percentage /
 * rem constraints, collapsible panels, pointer capture (drags survive
 * crossing an iframe), enlarged touch hit targets and the WAI-ARIA
 * window-splitter keyboard model for free.
 *
 * Re-exported types so callers never import the library directly.
 */
export type {
  GroupImperativeHandle as ResizableGroupHandle,
  Layout as ResizableLayout,
  LayoutChangedMeta as ResizableLayoutChangedMeta,
  PanelImperativeHandle as ResizablePanelHandle,
  PanelSize as ResizablePanelSize,
} from 'react-resizable-panels';
export { useGroupRef, usePanelRef } from 'react-resizable-panels';

export type ResizableGroupProps = GroupProps;

/** A row (or column) of `ResizablePanel`s separated by `ResizableHandle`s. */
export function ResizableGroup({ className, ...props }: ResizableGroupProps) {
  return (
    <Group className={cn('min-h-0 min-w-0 h-full w-full', className)} {...props} />
  );
}

export type ResizablePanelProps = PanelProps;

/**
 * One resizable pane. Sizes are pixels when numeric and percentages when a
 * unitless string (`"30"`), or any CSS length with a unit (`"18rem"`).
 *
 * ⚠️ `className` lands on the panel's inner element, so it can carry borders,
 * rounding and overflow without fighting the flex sizing on the outer one.
 */
export function ResizablePanel({ className, ...props }: ResizablePanelProps) {
  return <Panel className={cn('min-h-0 min-w-0', className)} {...props} />;
}

export interface ResizableHandleProps extends SeparatorProps {
  /** Show the pill on hover / focus / drag. Defaults to `true`. */
  withGrip?: boolean;
  /**
   * Make the handle a 6px gutter between two separately boxed panels (the app
   * shell) instead of a 1px divider between flush ones. A gutter draws no line
   * at all — the gap between the boxes is the divider.
   */
  gutter?: boolean;
}

/**
 * The draggable divider between two panels.
 *
 * At rest it is invisible (a gutter) or a plain 1px border line (a flush
 * divider). Hovering, focusing or dragging fades in a single small rounded
 * pill at its centre — no coloured line, no icon. The library tags the
 * element with `data-separator="inactive|hover|focus|active|disabled"` and
 * `aria-orientation`; styling keys off those attributes instead of React
 * state, so hovering or dragging never re-renders anything. The library
 * enlarges the hit target beyond the element (10px fine pointer / 20px touch).
 */
export function ResizableHandle({
  withGrip = true,
  gutter = false,
  className,
  children,
  ...props
}: ResizableHandleProps) {
  return (
    <Separator
      className={cn(
        'group/handle relative z-20 flex shrink-0 items-center justify-center outline-none select-none',
        /* aria-orientation="vertical" ⇒ panes side by side. */
        gutter
          ? 'aria-[orientation=vertical]:w-1.5 aria-[orientation=horizontal]:h-1.5'
          : 'bg-border aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px',
        'aria-[orientation=vertical]:self-stretch aria-[orientation=horizontal]:w-full',
        className,
      )}
      {...props}
    >
      {withGrip ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute rounded-full bg-muted-foreground/20 opacity-0',
            'transition-[opacity,background-color] duration-(--duration-fast) ease-standard',
            'group-aria-[orientation=vertical]/handle:h-7 group-aria-[orientation=vertical]/handle:w-[3px]',
            'group-aria-[orientation=horizontal]/handle:h-[3px] group-aria-[orientation=horizontal]/handle:w-7',
            'group-data-[separator=hover]/handle:opacity-100',
            'group-data-[separator=focus]/handle:opacity-100 group-data-[separator=focus]/handle:bg-ring/60',
            'group-data-[separator=active]/handle:opacity-100 group-data-[separator=active]/handle:bg-muted-foreground/40',
            'group-data-[separator=disabled]/handle:hidden',
          )}
        />
      ) : null}
      {children}
    </Separator>
  );
}

export interface ResizablePanelsProps
  extends Omit<ComponentProps<'div'>, 'ref' | 'onResize'> {
  orientation?: 'horizontal' | 'vertical';
  defaultSizes?: [number, number]; // Percentages, e.g. [30, 70]
  minSizes?: [number, number]; // Percentages, e.g. [15, 15]
  leftOrTop: ReactNode;
  rightOrBottom: ReactNode;
  /** Called once a resize settles (pointer released / key pressed), in percentages. */
  onSizesChange?: (sizes: [number, number]) => void;
  paneOneClassName?: string;
  paneTwoClassName?: string;
  handleClassName?: string;
}

const PANE_ONE = 'pane-one';
const PANE_TWO = 'pane-two';

/**
 * Two-pane convenience wrapper over the primitives above. Double-click the
 * handle to return to `defaultSizes`.
 */
export function ResizablePanels({
  orientation = 'horizontal',
  defaultSizes = [50, 50],
  minSizes = [15, 15],
  leftOrTop,
  rightOrBottom,
  onSizesChange,
  className,
  paneOneClassName,
  paneTwoClassName,
  handleClassName,
  ...props
}: ResizablePanelsProps) {
  const handleLayoutChanged = (layout: Layout) => {
    const one = layout[PANE_ONE];
    const two = layout[PANE_TWO];
    if (one === undefined || two === undefined) return;
    onSizesChange?.([one, two]);
  };

  return (
    <ResizableGroup
      orientation={orientation}
      onLayoutChanged={onSizesChange ? handleLayoutChanged : undefined}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ResizablePanel
        id={PANE_ONE}
        defaultSize={`${defaultSizes[0]}%`}
        minSize={`${minSizes[0]}%`}
        className={cn('overflow-auto scrollbar-subtle', paneOneClassName)}
      >
        {leftOrTop}
      </ResizablePanel>
      <ResizableHandle
        aria-label={`Resize ${orientation === 'horizontal' ? 'columns' : 'rows'}`}
        className={handleClassName}
      />
      <ResizablePanel
        id={PANE_TWO}
        defaultSize={`${defaultSizes[1]}%`}
        minSize={`${minSizes[1]}%`}
        className={cn('overflow-auto scrollbar-subtle', paneTwoClassName)}
      >
        {rightOrBottom}
      </ResizablePanel>
    </ResizableGroup>
  );
}

export const ResizablePanelLayout = ResizablePanels;
