export { AIInfrastructureModule } from './lib/ai-infrastructure.module.js';
export {
  AIInfrastructureService,
  NEMOTRON_MODEL_ID,
  NVIDIA_BASE_URL_DEFAULT,
  AI_MODEL_REGISTRY,
  RAG_DOCS_COLLECTION,
  type ChatMessage,
  type ChatCompletionOptions,
  type VectorEmbedding,
  type VectorFilter,
  type RAGQueryResult,
} from './lib/ai-infrastructure.service.js';
export {
  QdrantVectorService,
  type VectorPoint,
  type VectorSearchHit,
} from './lib/qdrant-vector.service.js';
export { RagIngestListener } from './lib/rag-ingest.listener.js';
export { ProviderRegistryService } from './lib/provider-registry.service.js';
export { ModelRegistryService } from './lib/model-registry.service.js';
export { ModelResolverService } from './lib/model-resolver.service.js';
export { PromptTemplateService } from './lib/prompt-template.service.js';
export { AICredentialService } from './lib/ai-credential.service.js';
export { AIEncryptionService } from './lib/ai-encryption.service.js';
export * from './lib/adapters/index.js';
