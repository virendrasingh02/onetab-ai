import { createContext, useContext } from 'react';
import type { EdgeRouting } from './edge-routing.js';

export type WorkflowDirection = 'horizontal' | 'vertical';
/** The canvas-wide edge routing (a connection may override it). */
export type WorkflowEdgeStyle = EdgeRouting;

export interface WorkflowLayoutContextValue {
  direction: WorkflowDirection;
  edgeStyle: WorkflowEdgeStyle;
  setDirection?: (dir: WorkflowDirection) => void;
  setEdgeStyle?: (style: WorkflowEdgeStyle) => void;
  updateNodeMetadata?: (
    nodeId: string,
    patch: { title?: string; label?: string; description?: string; subtitle?: string },
  ) => void;
}

export const WorkflowLayoutContext = createContext<WorkflowLayoutContextValue>({
  direction: 'horizontal',
  edgeStyle: 'smooth',
});

export const useWorkflowLayout = () => useContext(WorkflowLayoutContext);
