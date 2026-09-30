/**
 * AI Agent Studio — 22-Module Feature Flags & Progressive Rollout Architecture
 *
 * Provides granular feature gating for each of the 22 modules defined in the
 * master specification. Allows controlled enablement, phased rollouts,
 * tenant-level overrides, and testing without broken code paths.
 */

export const AgentStudioModuleId = {
  MODULE_1_DASHBOARD: 'module_1_dashboard',
  MODULE_2_CANVAS: 'module_2_canvas',
  MODULE_3_NODE_LIBRARY: 'module_3_node_library',
  MODULE_4_INSPECTOR: 'module_4_inspector',
  MODULE_5_MULTI_AGENT: 'module_5_multi_agent',
  MODULE_6_TOOLS_MCP: 'module_6_tools_mcp',
  MODULE_7_KNOWLEDGE_RAG: 'module_7_knowledge_rag',
  MODULE_8_MEMORY_STATE: 'module_8_memory_state',
  MODULE_9_HITL_GOVERNANCE: 'module_9_hitl_governance',
  MODULE_10_TRIGGERS_SCHEDULING: 'module_10_triggers_scheduling',
  MODULE_11_TESTING_DEBUG: 'module_11_testing_debug',
  MODULE_12_OBSERVABILITY_TRACING: 'module_12_observability_tracing',
  MODULE_13_SECURITY_GUARDRAILS: 'module_13_security_guardrails',
  MODULE_14_DEPLOYMENT_SERVING: 'module_14_deployment_serving',
  MODULE_15_TEMPLATES_MARKETPLACE: 'module_15_templates_marketplace',
  MODULE_16_COLLABORATION_MULTI_TENANCY: 'module_16_collaboration_multi_tenancy',
  MODULE_17_VERSION_CONTROL: 'module_17_version_control',
  MODULE_18_SETTINGS_PROVIDERS: 'module_18_settings_providers',
  MODULE_19_AI_APPS: 'module_19_ai_apps',
  MODULE_20_VOICE_MULTIMODAL: 'module_20_voice_multimodal',
  MODULE_21_COST_OPTIMIZATION: 'module_21_cost_optimization',
  MODULE_22_ENTERPRISE_ADMIN: 'module_22_enterprise_admin',
} as const;

export type AgentStudioModuleId =
  (typeof AgentStudioModuleId)[keyof typeof AgentStudioModuleId];

export interface AgentStudioFeatureFlagConfig {
  id: AgentStudioModuleId;
  name: string;
  phase: number;
  enabled: boolean;
  betaOnly?: boolean;
  description: string;
}

/**
 * Master Registry of all 22 Feature Flags.
 * Phase 0 has foundational modules enabled by default.
 */
export const DEFAULT_AGENT_STUDIO_FLAGS: Record<
  AgentStudioModuleId,
  AgentStudioFeatureFlagConfig
> = {
  [AgentStudioModuleId.MODULE_1_DASHBOARD]: {
    id: AgentStudioModuleId.MODULE_1_DASHBOARD,
    name: 'Agent Studio Dashboard & Lifecycle Management',
    phase: 1,
    enabled: true,
    description: 'Dashboard KPIs, agent lifecycle (CRUD, versions, status, templates), and quick actions.',
  },
  [AgentStudioModuleId.MODULE_2_CANVAS]: {
    id: AgentStudioModuleId.MODULE_2_CANVAS,
    name: 'Visual Workflow Canvas',
    phase: 1,
    enabled: true,
    description: 'Interactive ReactFlow canvas, pan/zoom, auto-layout, multi-selection, and context menus.',
  },
  [AgentStudioModuleId.MODULE_3_NODE_LIBRARY]: {
    id: AgentStudioModuleId.MODULE_3_NODE_LIBRARY,
    name: 'Comprehensive Node Library',
    phase: 2,
    enabled: true,
    description: 'Catalog of 35+ nodes across 8 categories (Triggers, LLM, Logic, Tools, Knowledge, HITL).',
  },
  [AgentStudioModuleId.MODULE_4_INSPECTOR]: {
    id: AgentStudioModuleId.MODULE_4_INSPECTOR,
    name: 'Node Configuration & Inspector Panel',
    phase: 2,
    enabled: true,
    description: 'Dynamic schema forms, prompt editors, variable pickers, hyperparameters, and live validation.',
  },
  [AgentStudioModuleId.MODULE_5_MULTI_AGENT]: {
    id: AgentStudioModuleId.MODULE_5_MULTI_AGENT,
    name: 'Multi-Agent Orchestration & Patterns',
    phase: 4,
    enabled: true,
    description: 'Supervisor-worker, hierarchical delegation, shared blackboard, and dynamic agent routing.',
  },
  [AgentStudioModuleId.MODULE_6_TOOLS_MCP]: {
    id: AgentStudioModuleId.MODULE_6_TOOLS_MCP,
    name: 'Tool Ecosystem, Integrations & MCP Support',
    phase: 2,
    enabled: true,
    description: 'Built-in workspace tools, external integrations, Model Context Protocol (MCP), and secrets.',
  },
  [AgentStudioModuleId.MODULE_7_KNOWLEDGE_RAG]: {
    id: AgentStudioModuleId.MODULE_7_KNOWLEDGE_RAG,
    name: 'Knowledge Base, RAG & Vector Memory',
    phase: 3,
    enabled: true,
    description: 'Document ingestion, chunking, vector embeddings, hybrid retrieval, and knowledge citations.',
  },
  [AgentStudioModuleId.MODULE_8_MEMORY_STATE]: {
    id: AgentStudioModuleId.MODULE_8_MEMORY_STATE,
    name: 'Memory, Context & State Management',
    phase: 3,
    enabled: true,
    description: 'Short-term session memory, persistent memory (`save_memory`), and workflow state persistence.',
  },
  [AgentStudioModuleId.MODULE_9_HITL_GOVERNANCE]: {
    id: AgentStudioModuleId.MODULE_9_HITL_GOVERNANCE,
    name: 'Human-in-the-Loop (HITL) & Governance',
    phase: 4,
    enabled: true,
    description: 'Interactive approvals for sensitive actions, escalation timeouts, and review queues.',
  },
  [AgentStudioModuleId.MODULE_10_TRIGGERS_SCHEDULING]: {
    id: AgentStudioModuleId.MODULE_10_TRIGGERS_SCHEDULING,
    name: 'Trigger & Execution Scheduling Engine',
    phase: 2,
    enabled: true,
    description: 'Webhook triggers, cron schedules, manual dispatch, and rate limiting queues.',
  },
  [AgentStudioModuleId.MODULE_11_TESTING_DEBUG]: {
    id: AgentStudioModuleId.MODULE_11_TESTING_DEBUG,
    name: 'Real-Time Testing, Debugging & Simulation',
    phase: 2,
    enabled: true,
    description: 'Interactive test chat drawer, step execution tracer, variable inspector, and mock runs.',
  },
  [AgentStudioModuleId.MODULE_12_OBSERVABILITY_TRACING]: {
    id: AgentStudioModuleId.MODULE_12_OBSERVABILITY_TRACING,
    name: 'Observability, Tracing & Analytics',
    phase: 3,
    enabled: true,
    description: 'AI execution logs, step latency metrics, token consumption, cost estimates, and error traces.',
  },
  [AgentStudioModuleId.MODULE_13_SECURITY_GUARDRAILS]: {
    id: AgentStudioModuleId.MODULE_13_SECURITY_GUARDRAILS,
    name: 'Security, Guardrails & Compliance',
    phase: 4,
    enabled: true,
    description: 'PII redaction/blocking, content safety filters, prompt injection guards, and audit logs.',
  },
  [AgentStudioModuleId.MODULE_14_DEPLOYMENT_SERVING]: {
    id: AgentStudioModuleId.MODULE_14_DEPLOYMENT_SERVING,
    name: 'Deployment, Serving & Distribution',
    phase: 4,
    enabled: true,
    description: 'One-click publish, API endpoints, embeddable web chat widgets, and webhook consumers.',
  },
  [AgentStudioModuleId.MODULE_15_TEMPLATES_MARKETPLACE]: {
    id: AgentStudioModuleId.MODULE_15_TEMPLATES_MARKETPLACE,
    name: 'Template Marketplace & Community Hub',
    phase: 3,
    enabled: true,
    description: 'Pre-built agent blueprints, category browsing, one-click clone, and workspace sharing.',
  },
  [AgentStudioModuleId.MODULE_16_COLLABORATION_MULTI_TENANCY]: {
    id: AgentStudioModuleId.MODULE_16_COLLABORATION_MULTI_TENANCY,
    name: 'Collaboration & Multi-Tenancy',
    phase: 4,
    enabled: true,
    description: 'Workspace-scoped isolation, role-based access control, canvas comments, and lock status.',
  },
  [AgentStudioModuleId.MODULE_17_VERSION_CONTROL]: {
    id: AgentStudioModuleId.MODULE_17_VERSION_CONTROL,
    name: 'Version Control, History & Rollback',
    phase: 2,
    enabled: true,
    description: 'Immutable graph versions, changelog summaries, snapshot restoration, and diff views.',
  },
  [AgentStudioModuleId.MODULE_18_SETTINGS_PROVIDERS]: {
    id: AgentStudioModuleId.MODULE_18_SETTINGS_PROVIDERS,
    name: 'Settings, Model Providers & System Configuration',
    phase: 1,
    enabled: true,
    description: 'LLM provider keys (OpenAI, Anthropic, Ollama), model toggles, fallback routing, and defaults.',
  },
  [AgentStudioModuleId.MODULE_19_AI_APPS]: {
    id: AgentStudioModuleId.MODULE_19_AI_APPS,
    name: 'AI App Builder & End-User Interfaces',
    phase: 4,
    enabled: true,
    description: 'Turn workflows and agents into shareable standalone web applications with custom UI widgets.',
  },
  [AgentStudioModuleId.MODULE_20_VOICE_MULTIMODAL]: {
    id: AgentStudioModuleId.MODULE_20_VOICE_MULTIMODAL,
    name: 'Voice & Multimodal Agent Support',
    phase: 4,
    enabled: true,
    description: 'Audio transcription (STT), text-to-speech (TTS), image analysis, and document OCR.',
  },
  [AgentStudioModuleId.MODULE_21_COST_OPTIMIZATION]: {
    id: AgentStudioModuleId.MODULE_21_COST_OPTIMIZATION,
    name: 'Cost & Resource Optimization',
    phase: 4,
    enabled: true,
    description: 'Token caching, smart model routing, budget alerts, and per-agent spend limits.',
  },
  [AgentStudioModuleId.MODULE_22_ENTERPRISE_ADMIN]: {
    id: AgentStudioModuleId.MODULE_22_ENTERPRISE_ADMIN,
    name: 'Enterprise Administration & Governance',
    phase: 4,
    enabled: true,
    description: 'SSO/SAML integration, SCIM provisioning, organization audit logs, and data retention.',
  },
};

/**
 * Checks whether an AI Agent Studio module feature is enabled.
 * Supports workspace-level policy overrides and phase flags.
 */
export function isAgentStudioModuleEnabled(
  moduleId: AgentStudioModuleId,
  overrides?: Partial<Record<AgentStudioModuleId, boolean>>,
): boolean {
  if (overrides && typeof overrides[moduleId] === 'boolean') {
    return overrides[moduleId]!;
  }
  return DEFAULT_AGENT_STUDIO_FLAGS[moduleId]?.enabled ?? false;
}
