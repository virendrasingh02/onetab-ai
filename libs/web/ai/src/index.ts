export { AISidebar, type AISidebarProps } from './lib/AISidebar.js';
export { AIChatView } from './lib/AIChatView.js';
export { PromptLibraryView, type PromptTemplateItem } from './lib/PromptLibraryView.js';
export { AIImageGeneratorView } from './lib/AIImageGeneratorView.js';

export {
  AI_MODELS,
  resolveModel,
  useAIChat,
  useAIImageGeneration,
  useAIRagSearch,
  useAISummarize,
  useAITranslate,
  useAIVision,
  useAIWorkspaceId,
  type AIModelValue,
} from './lib/use-ai.js';
