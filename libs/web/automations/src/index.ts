export {
  useWorkflowExecutions,
  useWorkflowMutations,
  useWorkflows,
  useWorkspaceExecutions,
  useAutomationOverview,
  useAutomationSchedules,
  useAutomationErrors,
  useAutomationCatalog,
  triggerWebhook,
} from './lib/use-automations.js';

export { WorkflowListView, type WorkflowItem } from './lib/WorkflowListView.js';
export { WorkflowCanvasView } from './lib/WorkflowCanvasView.js';
export { buildWorkflowActions, downloadWorkflowConfig, type WorkflowActionOptions } from './lib/workflow-actions.js';
export { WORKFLOW_TEMPLATES, type WorkflowTemplate } from './lib/workflow-templates.js';
export { NODE_CATALOG, WORKFLOW_EVENTS, type NodeCatalogItem, type WorkflowField } from './lib/workflow-catalog.js';

/* Unified Automation Center (15-tab hub) */
export * from './lib/center/index.js';

/* AI Agent Studio — agents described in words, planned, run and reviewed. */
export { StudioHome } from './lib/studio/StudioHome.js';
export { useAgentFavorites } from './lib/studio/use-studio.js';
export { AgentLibrary, TemplateGallery } from './lib/studio/AgentLibrary.js';
export { AgentCreatePage } from './lib/studio/AgentCreatePage.js';
export { AgentDetailPage } from './lib/studio/AgentDetailPage.js';
export { PlanEditor, type PlanEditorProps } from './lib/studio/plan-editor/PlanEditor.js';

