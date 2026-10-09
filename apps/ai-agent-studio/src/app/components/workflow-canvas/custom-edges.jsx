import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  Position,
  useStore,
} from '@xyflow/react';
import { X, Sliders } from 'lucide-react';
import {
  decodeRects,
  encodeRects,
  nearRoute,
  polylineToRoundedPath,
  resolveEdgeRouting,
  routeAroundObstacles,
} from './edge-routing';

/** Unit vector pointing out of a handle on this side of a card. */
const OUTWARD = {
  [Position.Left]: [-1, 0],
  [Position.Right]: [1, 0],
  [Position.Top]: [0, -1],
  [Position.Bottom]: [0, 1],
};
/** How far a wire runs straight out of a handle before it bends. */
const MIN_HANDLE_REACH = 40;

/**
 * A bezier whose ends always leave and enter along the handle's side.
 * React Flow's own bezier scales its control points with the gap between the
 * cards, so two cards placed close together (or offset vertically) got a wire
 * that left the handle almost straight up or down. Here the reach is at
 * least MIN_HANDLE_REACH, growing with the distance and with how far the
 * target sits behind the source (a back-edge loops around instead of cutting
 * through the cards).
 *
 * @returns {[string, number, number]} path, label x, label y
 */
export function getFlowBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }) {
  const [sx, sy] = OUTWARD[sourcePosition] ?? OUTWARD[Position.Right];
  const [tx, ty] = OUTWARD[targetPosition] ?? OUTWARD[Position.Left];
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  // Distance along the source's direction: negative when the target is "behind" it
  const along = dx * sx + dy * sy;
  const reach = Math.max(MIN_HANDLE_REACH, along > 0 ? along / 2 : Math.min(-along / 2 + MIN_HANDLE_REACH, 160));
  const c1x = sourceX + sx * reach;
  const c1y = sourceY + sy * reach;
  const c2x = targetX + tx * reach;
  const c2y = targetY + ty * reach;
  // Midpoint of a cubic bezier (t = 0.5), for the edge's label and buttons
  const labelX = 0.125 * sourceX + 0.375 * c1x + 0.375 * c2x + 0.125 * targetX;
  const labelY = 0.125 * sourceY + 0.375 * c1y + 0.375 * c2y + 0.125 * targetY;
  return [`M${sourceX},${sourceY} C${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`, labelX, labelY];
}

/** Arrowhead length and half-width, in canvas px. */
const ARROW_LENGTH = 8;
const ARROW_HALF_WIDTH = 4.5;
/**
 * Wires end at the outer edge of a handle's 32px hit area, which sits ~9px
 * before the visible 14px dot (see FlowHandle in custom-nodes). Pushing the
 * tip in by that much makes the arrow fill the gap and touch the dot.
 */
const HANDLE_DOT_INSET = 9;

/**
 * A filled arrowhead whose tip sits on the target handle, pointing into the
 * card along the handle's side (wires always enter perpendicular to it).
 */
export function EdgeArrowhead({ x: endX, y: endY, position = Position.Left, direction, color, opacity = 1, inset = HANDLE_DOT_INSET }) {
  const [ox, oy] = OUTWARD[position] ?? OUTWARD[Position.Left];
  // Travel direction is into the card: the opposite of the handle's outward
  // vector, unless the wire arrives at an angle (a straight wire)
  const [dx, dy] = direction ?? [-ox, -oy];
  const x = endX + dx * inset;
  const y = endY + dy * inset;
  const baseX = x - dx * ARROW_LENGTH;
  const baseY = y - dy * ARROW_LENGTH;
  const px = -dy * ARROW_HALF_WIDTH;
  const py = dx * ARROW_HALF_WIDTH;
  return (
    <path
      d={`M${x},${y} L${baseX + px},${baseY + py} L${baseX - px},${baseY - py} Z`}
      fill={color}
      opacity={opacity}
      style={{ transition: 'fill 150ms ease', pointerEvents: 'none' }}
    />
  );
}

/** Unit vector from (x1, y1) towards (x2, y2), or undefined when they coincide. */
function unitVector(x1, y1, x2, y2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return len > 0 ? [(x2 - x1) / len, (y2 - y1) / len] : undefined;
}

/**
 * The cards near a wire, packed into a string so the store selector only
 * re-renders this edge when one of *them* moves or resizes.
 */
function selectObstacleKey(state, from, to) {
  const rects = [];
  for (const node of state.nodeLookup.values()) {
    if (node.hidden) continue;
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    if (!width || !height) continue;
    const { x, y } = node.internals.positionAbsolute;
    const rect = { x, y, width, height };
    if (nearRoute(rect, from, to)) rects.push(rect);
  }
  return encodeRects(rects);
}

/**
 * The path for one wire under the given routing.
 *
 * @returns {{ path: string; labelX: number; labelY: number; arrowDirection?: [number, number] }}
 */
function useEdgeRoute(routing, { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }) {
  const isSmart = routing === 'smart';
  const obstacleKey = useStore(
    useCallback(
      (state) => (isSmart ? selectObstacleKey(state, { x: sourceX, y: sourceY }, { x: targetX, y: targetY }) : ''),
      [isSmart, sourceX, sourceY, targetX, targetY],
    ),
  );

  return useMemo(() => {
    const route = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
    if (routing === 'straight') {
      const [path, labelX, labelY] = getStraightPath(route);
      return { path, labelX, labelY, arrowDirection: unitVector(sourceX, sourceY, targetX, targetY) };
    }
    if (routing === 'smooth') {
      const [path, labelX, labelY] = getFlowBezierPath(route);
      return { path, labelX, labelY };
    }
    if (isSmart) {
      const points = routeAroundObstacles({
        source: { x: sourceX, y: sourceY },
        sourceSide: sourcePosition,
        target: { x: targetX, y: targetY },
        targetSide: targetPosition,
        obstacles: decodeRects(obstacleKey),
      });
      if (points) {
        const [path, labelX, labelY] = polylineToRoundedPath(points, 14);
        return { path, labelX, labelY };
      }
      // No way round within the search area: fall back to a plain orthogonal wire
    }
    const [path, labelX, labelY] = getSmoothStepPath({ ...route, borderRadius: 14 });
    return { path, labelX, labelY };
  }, [routing, isSmart, obstacleKey, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);
}

/**
 * Universal WorkflowEdge: Curved (bezier), Orthogonal (smooth-step), Smart
 * (orthogonal, steering around cards) or Straight routing, conditional
 * branching badges, execution animation, hover hit area, and inspect/delete
 * affordances. The routing is the connection's own `data.routing` when set,
 * else the canvas default in `data.edgeStyle`.
 *
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function WorkflowEdge(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition = Position.Right,
    targetPosition = Position.Left,
    style = {},
    markerEnd,
    data = {},
    selected,
  } = props;
  const [isHovered, setIsHovered] = useState(false);
  const isEditingLabel = Boolean(data?.isEditingLabel);

  const routing = resolveEdgeRouting(data?.routing, data?.edgeStyle ?? props.edgeStyle);
  const { path: edgePath, labelX, labelY, arrowDirection } = useEdgeRoute(routing, {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = data?.label ?? (typeof props.label === 'string' ? props.label : undefined);
  const isBranchTrue =
    label === 'True' || data?.branch === 'true' || data?.sourceHandle === 'true';
  const isBranchFalse =
    label === 'False' || data?.branch === 'false' || data?.sourceHandle === 'false';
  const isBranchFallback =
    label === 'Fallback' || data?.branch === 'fallback';
  const isRunning = data?.status === 'running';
  const isDone = data?.status === 'done';
  // A user-chosen "flowing" wire, independent of run state
  const isFlowAnimated = data?.animated === true;
  const isFlowing = isRunning || isFlowAnimated;

  // Quiet, neutral wires; colour only for meaning (branches, selection, a live run).
  const defaultStroke = isBranchTrue
    ? 'var(--color-success)'
    : isBranchFalse
    ? 'var(--color-destructive)'
    : isBranchFallback
    ? 'var(--color-warning)'
    : selected || isHovered || isRunning
    ? 'var(--color-primary)'
    : isDone
    ? 'color-mix(in oklab, var(--color-primary) 55%, var(--color-border-strong))'
    : 'var(--color-border-strong)';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected || isHovered ? 2 : 1.5,
          stroke: defaultStroke,
          strokeDasharray: isFlowing ? '6 6' : style?.strokeDasharray,
          animation: isFlowing ? 'dash 1s linear infinite' : undefined,
          transition: 'stroke 150ms ease, stroke-width 150ms ease',
        }}
        interactionWidth={28}
      />
      <EdgeArrowhead x={targetX} y={targetY} position={targetPosition} direction={arrowDirection} color={defaultStroke} />

      {/* Invisible wider stroke for effortless hover hit-testing */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          if (data?.onSelectEdge) {
            e.stopPropagation();
            data.onSelectEdge(id);
          }
        }}
        onDoubleClick={(e) => {
          if (data?.onStartLabelEdit) {
            e.stopPropagation();
            data.onStartLabelEdit(id);
          }
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1 group/edge select-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isEditingLabel ? (
            <EdgeLabelInput
              initial={label ?? ''}
              onCommit={(value) => data?.onRenameLabel?.(id, value)}
              onCancel={() => data?.onCancelLabelEdit?.()}
            />
          ) : label && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (data?.onInspect) data.onInspect(id);
              }}
              onDoubleClick={(e) => {
                if (data?.onStartLabelEdit) {
                  e.stopPropagation();
                  data.onStartLabelEdit(id);
                }
              }}
              title="Click to inspect · double-click to rename"
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border shadow-xs transition-transform hover:scale-105 cursor-pointer ${
                isBranchTrue
                  ? 'bg-success/15 text-success border-success/40'
                  : isBranchFalse
                  ? 'bg-destructive/15 text-destructive border-destructive/40'
                  : isBranchFallback
                  ? 'bg-warning/15 text-warning border-warning/40'
                  : 'bg-surface text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {label}
            </button>
          )}

          {(isHovered || selected) && !isEditingLabel && (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100">
              {data?.onInspect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onInspect(id);
                  }}
                  title="Inspect Connection Data Flow"
                  className="flex size-5 items-center justify-center rounded-full bg-surface border border-border text-muted-foreground hover:bg-surface-raised hover:text-foreground shadow-xs transition-transform hover:scale-110"
                >
                  <Sliders className="size-3" />
                </button>
              )}

              {data?.onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete(id);
                  }}
                  title="Delete Connection"
                  className="flex size-5 items-center justify-center rounded-full bg-surface border border-destructive/40 text-destructive hover:bg-destructive hover:text-white shadow-xs transition-transform hover:scale-110"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/**
 * Inline editor for a wire's label. Enter or blur saves (empty clears it),
 * Escape cancels.
 *
 * @param {{ initial: string; onCommit: (value: string) => void; onCancel: () => void }} props
 */
function EdgeLabelInput({ initial, onCommit, onCancel }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (commit) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (commit) onCommit(value.trim());
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={60}
      placeholder="Label…"
      aria-label="Connection label"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      className="nodrag nopan h-6 w-36 rounded-full border border-primary/60 bg-surface px-2.5 text-[11px] font-medium text-foreground shadow-sm outline-none ring-2 ring-primary/30"
    />
  );
}

/**
 * Bezier Curve variation for workflow edges.
 *
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function BezierWorkflowEdge(props) {
  return <WorkflowEdge {...props} data={{ ...props.data, edgeStyle: 'smooth' }} />;
}

/**
 * Step / Orthogonal variation for workflow edges.
 *
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function StepWorkflowEdge(props) {
  return <WorkflowEdge {...props} data={{ ...props.data, edgeStyle: 'step' }} />;
}

/**
 * Straight line variation for workflow edges.
 *
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function StraightWorkflowEdge(props) {
  return <WorkflowEdge {...props} data={{ ...props.data, edgeStyle: 'straight' }} />;
}

/**
 * Smart (orthogonal, steering around cards) variation for workflow edges.
 *
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function SmartWorkflowEdge(props) {
  return <WorkflowEdge {...props} data={{ ...props.data, edgeStyle: 'smart' }} />;
}

/**
 * The wire drawn while dragging a new connection: same routing as a saved
 * edge, primary-coloured, turning green over a handle it can connect to, with
 * the arrowhead showing which way the step will run.
 *
 * @param {import('@xyflow/react').ConnectionLineComponentProps & { edgeStyle?: import('./edge-routing').EdgeRouting }} props
 */
export function WorkflowConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition = Position.Right,
  toPosition = Position.Left,
  connectionStatus,
  edgeStyle = 'smooth',
}) {
  const route = { sourceX: fromX, sourceY: fromY, sourcePosition: fromPosition, targetX: toX, targetY: toY, targetPosition: toPosition };
  // While dragging there is no target card yet, so a smart wire previews as orthogonal
  const [path] =
    edgeStyle === 'step' || edgeStyle === 'smart'
      ? getSmoothStepPath({ ...route, borderRadius: 14 })
      : edgeStyle === 'straight'
      ? getStraightPath(route)
      : getFlowBezierPath(route);
  const arrowDirection = edgeStyle === 'straight' ? unitVector(fromX, fromY, toX, toY) : undefined;
  const color =
    connectionStatus === 'valid'
      ? 'var(--color-success)'
      : connectionStatus === 'invalid'
      ? 'var(--color-destructive)'
      : 'var(--color-primary)';
  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 4" />
      {/* Free-dragging, the tip follows the cursor; snapped to a handle, it meets the dot */}
      <EdgeArrowhead
        x={toX}
        y={toY}
        position={toPosition}
        direction={arrowDirection}
        color={color}
        inset={connectionStatus ? HANDLE_DOT_INSET : 0}
      />
    </g>
  );
}

/** @type {import('@xyflow/react').EdgeTypes} */
export const STUDIO_EDGE_TYPES = {
  workflow: WorkflowEdge,
  default: WorkflowEdge,
  smoothstep: WorkflowEdge,
  step: StepWorkflowEdge,
  bezier: BezierWorkflowEdge,
  smooth: BezierWorkflowEdge,
  straight: StraightWorkflowEdge,
  smart: SmartWorkflowEdge,
  conditional: WorkflowEdge,
};
