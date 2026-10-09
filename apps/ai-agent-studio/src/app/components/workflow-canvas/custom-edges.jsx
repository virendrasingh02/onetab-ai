import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  Position,
} from '@xyflow/react';
import { X, Sliders } from 'lucide-react';

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

/**
 * Universal WorkflowEdge supporting both Smooth (Curved / Bezier) and
 * Step (Orthogonal / SmoothStep) routing, conditional branching badges,
 * execution animation, hover hit area, and inspect/delete affordances.
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

  // Check if edge style is smooth or step (defaults to smooth)
  const edgeStyle = data?.edgeStyle || props.edgeStyle || 'smooth';
  const isSmooth = edgeStyle === 'smooth';

  // Generate either Bezier (smooth) or SmoothStep (step / orthogonal) path
  const [edgePath, labelX, labelY] = isSmooth
    ? getFlowBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 14,
      });

  const label = data?.label;
  const isBranchTrue =
    label === 'True' || data?.branch === 'true' || data?.sourceHandle === 'true';
  const isBranchFalse =
    label === 'False' || data?.branch === 'false' || data?.sourceHandle === 'false';
  const isBranchFallback =
    label === 'Fallback' || data?.branch === 'fallback';
  const isRunning = data?.status === 'running';
  const isDone = data?.status === 'done';

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
          strokeDasharray: isRunning ? '6 6' : style?.strokeDasharray,
          animation: isRunning ? 'dash 1s linear infinite' : undefined,
          transition: 'stroke 150ms ease, stroke-width 150ms ease',
        }}
        interactionWidth={28}
      />

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
          {label && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (data?.onInspect) data.onInspect(id);
              }}
              title="Click to inspect connection condition"
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

          {(isHovered || selected) && (
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
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
    selected,
  } = props;
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: selected ? 2 : 1.5,
        stroke: selected ? 'var(--color-primary)' : 'var(--color-border-strong)',
      }}
    />
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
  conditional: WorkflowEdge,
};
