export {
  useAgentLogs,
  useAgentMutations,
  useAgents,
  useWorkspaceAgentLogs,
} from './lib/use-agents.js';

export { AgentMarketplaceView, AgentAvatar } from './lib/AgentMarketplaceView.js';
/*
 * The unified agent editor (AI Workspace → Agents → an agent). It replaced the
 * in-app Agent Builder, the standalone Agent Studio's agent screens and the
 * agent monitor (runs now live in the AI Workspace's Runs view).
 */
export { AgentEditorView, type AgentEditorViewProps } from './lib/editor/AgentEditorView.js';
export { AIEntityRunsList } from './lib/editor/AIEntityRunsList.js';
export {
  AgentBuilderOptionsProvider,
  BuilderOptionSelect,
  useAgentBuilderOptions,
  type OptionSource,
} from './lib/agent-graph/index.js';
export { AgentChatView } from './lib/AgentChatView.js';
export { AgentProfileRightPanel } from './lib/AgentProfileRightPanel.js';
export { AIEntityAvatar, type AIEntityAvatarProps } from './lib/shared/ai-entity-avatar.js';
export { AIEntityStatus, type AIEntityStatusProps } from './lib/shared/ai-entity-status.js';
export { AIEntityRow, type AIEntityRowProps } from './lib/shared/ai-entity-row.js';
export { AIModeAgentBuilderModal, type AIModeAgentBuilderModalProps } from './lib/editor/AIModeAgentBuilderModal.js';

export * from './lib/marketplace/index.js';
