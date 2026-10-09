import { createContext, useContext } from 'react';

export type WorkflowDirection = 'horizontal' | 'vertical';
export type WorkflowEdgeStyle = 'smooth' | 'step';

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
