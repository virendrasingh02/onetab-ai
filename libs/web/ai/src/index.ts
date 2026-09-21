export { AISidebar, type AISidebarProps } from './lib/AISidebar.js';
export { AIChatView } from './lib/AIChatView.js';
export { PromptLibraryView } from './lib/PromptLibraryView.js';
export { AIImageGeneratorView } from './lib/AIImageGeneratorView.js';
export { AIStudioView } from './lib/studio/AIStudioView.js';

/*
 * The transcript rows live in `@org/chat-ui` — the agent conversation renders
 * them too, and it must not depend on this library to do it. Re-exported here
 * so existing consumers keep one import.
 */
export {
  AIErrorRow,
  AIMessage,
  AIThinkingRow,
  type AIDensity,
  type AIErrorRowProps,
  type AIMessageProps,
} from '@org/chat-ui';

export { AIModelPicker, type AIModelPickerProps } from './lib/ai-model-picker.js';
export { AI_STUDIO_SLASH_COMMANDS } from './lib/ai-composer-commands.js';

export {
  useAIConversation,
  type AIConversationMessage,
  type UseAIConversationOptions,
} from './lib/use-ai-conversation.js';

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
  usePromptTemplateMutations,
  usePromptTemplates,
  type AIModelValue,
} from './lib/use-ai.js';
