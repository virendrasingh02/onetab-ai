/**
 * Model-inference contracts, shared between the Nest AI module and the web
 * screens so a change to a response shape breaks the compile rather than the
 * screen.
 */
import type { IsoDateString } from './entities.js';

export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  provider?: AIProvider;
  model?: string;
}

export interface AIChatResponse {
  message: AIChatMessage;
}

export interface AISummaryResponse {
  summary: string;
}

export interface AITranslationResponse {
  translatedText: string;
}

export interface AIImageResponse {
  imageUrl: string;
}

export interface AIVisionResponse {
  analysis: string;
}

/** One retrieved passage from the workspace vector store. */
export interface AIRagResult {
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * A saved prompt.
 *
 * `workspaceId` is null for the system templates that ship with the platform:
 * they appear in every workspace's library and are read-only there.
 */
export interface PromptTemplate {
  id: string;
  workspaceId: string | null;
  title: string;
  category: string;
  promptText: string;
  isSystem: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
