import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
} from '@xyflow/react';
import { X } from 'lucide-react';

export function WorkflowEdge({
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
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Generate smoothstep or bezier path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const label = data?.label;
  const isBranchTrue = label === 'True' || data?.branch === 'true';
  const isBranchFalse = label === 'False' || data?.branch === 'false';
  const isRunning = data?.status === 'running';

  const defaultStroke = isBranchTrue
    ? '#10b981'
    : isBranchFalse
    ? '#f43f5e'
    : selected
    ? '#6366f1'
    : '#818cf8';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected || isHovered ? 2.5 : 2,
          stroke: defaultStroke,
          strokeDasharray: isRunning ? '5 5' : undefined,
          animation: isRunning ? 'dash 1s linear infinite' : undefined,
          ...style,
        }}
        interactionWidth={20}
      />

      {/* Invisible wider stroke for easier hover hit-testing */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1 group/edge"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {label && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border shadow-xs transition-transform ${
                isBranchTrue
                  ? 'bg-success/10 text-success border-success/30'
                  : isBranchFalse
                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                  : 'bg-surface text-muted-foreground border-border'
              }`}
            >
              {label}
            </span>
          )}

          {(isHovered || selected) && data?.onDelete && (
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
      </EdgeLabelRenderer>
    </>
  );
}

export const STUDIO_EDGE_TYPES = {
  workflow: WorkflowEdge,
  default: WorkflowEdge,
  smoothstep: WorkflowEdge,
};
