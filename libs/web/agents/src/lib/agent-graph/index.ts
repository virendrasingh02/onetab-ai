/**
 * The agent-graph builder: model, state, canvas nodes, palette and inspector.
 *
 * `AgentEditorView` is the consumer; the barrel keeps its import list to one
 * line and marks where the module boundary is.
 */

export {
  CATEGORY_LABEL,
  NODE_ACCENTS,
  NODE_CATEGORIES,
  NODE_KINDS,
  NODE_SPECS,
  PALETTE_ORDER,
  accentFor,
  coerceFieldValue,
  defaultConfigFor,
  isAgentNodeKind,
  isFieldVisible,
  labelKey,
  specFor,
  type AgentNodeKind,
  type ConfigValue,
  type FieldCondition,
  type FieldSpec,
  type OptionSource,
  type NodeAccent,
  type NodeAccentName,
  type NodeCategory,
  type NodeConfig,
  type NodeHandles,
  type NodeKindSpec,
} from './agent-graph-model.js';

export {
  HANDLE,
  summarise,
  tidyLayout,
  useAgentGraph,
  validateGraph,
  type AgentFlowNode,
  type AgentGraph,
  type AgentNodeData,
  type AgentSummary,
  type GraphIssue,
} from './use-agent-graph.js';

export {
  AgentFlowNodeCard,
  NodeIssueProvider,
  nodeTypes,
  type NodeIssueMap,
} from './agent-flow-nodes.js';

export {
  AgentNodePalette,
  NODE_DRAG_TYPE,
  type AgentNodePaletteProps,
} from './AgentNodePalette.js';

export { AgentInspector, type AgentInspectorProps } from './AgentInspector.js';

export {
  AgentBuilderOptionsProvider,
  BuilderOptionSelect,
  useAgentBuilderOptions,
  type BuilderOption,
  type BuilderOptions,
} from './agent-builder-options.js';
