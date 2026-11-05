/**
 * The workspace pages Studio hosts. They sit behind one local module so
 * `studio-core-bridge.tsx` can `lazy()` them while other Studio pages keep
 * importing these libraries statically; the module-boundary lint rule rejects
 * importing one library both ways.
 */
export {
  AgentCreatePage,
  AgentDetailPage,
  AgentLibrary,
  WorkflowCanvasView,
} from '@org/web-automations';
export { AIApprovalsSection, AIRunsSection } from '@org/web-ai';
