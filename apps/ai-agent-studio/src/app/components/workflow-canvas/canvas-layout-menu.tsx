import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
} from '@org/ui';
import {
  CornerDownRight,
  Lock,
  MoveHorizontal,
  MoveVertical,
  Network,
  Route,
  Rows3,
  Slash,
  SlidersHorizontal,
  Spline,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { LayoutArrange, LayoutSpacing } from './auto-layout.js';
import {
  EDGE_ROUTING_HINTS,
  EDGE_ROUTING_LABELS,
  isEdgeRouting,
} from './edge-routing.js';
import type {
  WorkflowDirection,
  WorkflowEdgeStyle,
} from './workflow-layout-context.js';

/** How Auto Layout arranges the canvas; saved with the graph so each agent keeps its own. */
export interface LayoutPrefs {
  arrange: LayoutArrange;
  spacing: LayoutSpacing;
}

export const DEFAULT_LAYOUT_PREFS: LayoutPrefs = {
  arrange: 'layered',
  spacing: 'comfortable',
};

/**
 * The member's last-used canvas style, for agents that haven't chosen their own.
 * Direction isn't here: it belongs to where an agent's cards already sit.
 */
export type CanvasLayoutDefaults = Partial<LayoutPrefs> & {
  edgeStyle?: WorkflowEdgeStyle;
};

export const isLayoutArrange = (v: unknown): v is LayoutArrange =>
  v === 'layered' || v === 'tree';
export const isLayoutSpacing = (v: unknown): v is LayoutSpacing =>
  v === 'compact' || v === 'comfortable' || v === 'spacious';

export function parseCanvasLayoutDefaults(
  raw: unknown,
): CanvasLayoutDefaults | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { edgeStyle, arrange, spacing } = raw as Record<string, unknown>;
  return {
    ...(isEdgeRouting(edgeStyle) ? { edgeStyle } : {}),
    ...(isLayoutArrange(arrange) ? { arrange } : {}),
    ...(isLayoutSpacing(spacing) ? { spacing } : {}),
  };
}

const DIRECTION_OPTIONS: {
  value: WorkflowDirection;
  label: string;
  icon: ReactNode;
}[] = [
  { value: 'horizontal', label: 'Horizontal', icon: <MoveHorizontal /> },
  { value: 'vertical', label: 'Vertical', icon: <MoveVertical /> },
];

const ARRANGE_OPTIONS: {
  value: LayoutArrange;
  label: string;
  icon: ReactNode;
  hint: string;
}[] = [
  {
    value: 'layered',
    label: 'Layered flow',
    icon: <Rows3 />,
    hint: 'Columns by step order, fewest crossing wires',
  },
  {
    value: 'tree',
    label: 'Tree',
    icon: <Network />,
    hint: 'Each step centred over the branches it starts',
  },
];

const SPACING_OPTIONS: { value: LayoutSpacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

const ROUTING_ICONS: Record<WorkflowEdgeStyle, ReactNode> = {
  smooth: <Spline />,
  step: <CornerDownRight />,
  smart: <Route />,
  straight: <Slash />,
};
const ROUTING_OPTIONS = (Object.keys(ROUTING_ICONS) as WorkflowEdgeStyle[]).map(
  (value) => ({
    value,
    label: EDGE_ROUTING_LABELS[value],
    hint: EDGE_ROUTING_HINTS[value],
    icon: ROUTING_ICONS[value],
  }),
);

function LayoutSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="gap-1.5 flex flex-col">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}

export interface CanvasLayoutMenuProps {
  direction: WorkflowDirection;
  edgeStyle: WorkflowEdgeStyle;
  prefs: LayoutPrefs;
  isLocked: boolean;
  /** Whether a change saves itself, or waits for the Save button. */
  autoSaved: boolean;
  onChangeDirection?: (direction: WorkflowDirection) => void;
  onChangeEdgeStyle?: (style: WorkflowEdgeStyle) => void;
  onChangePrefs?: (patch: Partial<LayoutPrefs>) => void;
}

/** The toolbar's layout panel. It stays open so each choice can be seen on the canvas. */
export function CanvasLayoutMenu({
  direction,
  edgeStyle,
  prefs,
  isLocked,
  autoSaved,
  onChangeDirection,
  onChangeEdgeStyle,
  onChangePrefs,
}: CanvasLayoutMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Layout options"
          aria-label="Layout options"
          className="rounded-xl data-[state=open]:bg-surface-raised"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        aria-label="Layout options"
        className="w-80 gap-3.5 flex flex-col"
      >
        <LayoutSection title="Direction">
          <SegmentedControl
            aria-label="Layout direction"
            layout="fill"
            disabled={isLocked}
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={(value) => onChangeDirection?.(value)}
          />
        </LayoutSection>
        <LayoutSection
          title="Arrangement"
          hint={ARRANGE_OPTIONS.find((o) => o.value === prefs.arrange)?.hint}
        >
          <SegmentedControl
            aria-label="Arrangement"
            layout="fill"
            disabled={isLocked}
            options={ARRANGE_OPTIONS}
            value={prefs.arrange}
            onChange={(arrange) => onChangePrefs?.({ arrange })}
          />
        </LayoutSection>
        <LayoutSection title="Spacing">
          <SegmentedControl
            aria-label="Spacing"
            layout="fill"
            disabled={isLocked}
            options={SPACING_OPTIONS}
            value={prefs.spacing}
            onChange={(spacing) => onChangePrefs?.({ spacing })}
          />
        </LayoutSection>
        <LayoutSection
          title="Edge routing"
          hint={EDGE_ROUTING_HINTS[edgeStyle]}
        >
          <SegmentedControl
            aria-label="Edge routing"
            layout="tiles"
            disabled={isLocked}
            options={ROUTING_OPTIONS}
            value={edgeStyle}
            onChange={(value) => onChangeEdgeStyle?.(value)}
          />
        </LayoutSection>
        <p className="gap-1.5 pt-3 text-xs flex items-center border-t border-border text-muted-foreground">
          {isLocked ? (
            <>
              <Lock className="size-3 shrink-0" />
              The canvas is locked, so its layout can't change.
            </>
          ) : autoSaved ? (
            'Saved with this agent automatically.'
          ) : (
            'Save the agent to keep these changes.'
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}
