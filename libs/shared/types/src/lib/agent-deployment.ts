export type AgentDeploymentTarget =
  | 'WIDGET'
  | 'INLINE_WIDGET'
  | 'JS_EMBED'
  | 'IFRAME'
  | 'WEB_COMPONENT'
  | 'REACT'
  | 'REST_API'
  | 'HEADLESS'
  | 'WEBHOOK'
  | 'PLATFORM_APP'
  | 'ELECTRON_DESKTOP';

export type AgentDeploymentEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

export type AgentDeploymentStatus = 'ACTIVE' | 'SUSPENDED' | 'DEPRECATED';

import type { AgentExecutionState } from './agent-config.js';
export type { AgentExecutionState };

export type AgentWidgetTheme = 'light' | 'dark' | 'system';
export type AgentWidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type AgentWidgetLauncherSize = 'sm' | 'md' | 'lg';

export interface AgentWidgetAppearanceConfig {
  mode?: 'floating' | 'inline';
  position?: AgentWidgetPosition;
  theme?: AgentWidgetTheme;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  borderColor?: string;
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  launcherIcon?: string;
  launcherSize?: AgentWidgetLauncherSize;
  borderRadius?: number;
  width?: number;
  height?: number;
  maxHeight?: number;
  welcomeMessage?: string;
  greeting?: string;
  suggestedPrompts?: string[];
  inputPlaceholder?: string;
  showBranding?: boolean;
}

export interface AgentWidgetBehaviorConfig {
  defaultOpen?: boolean;
  allowAttachments?: boolean;
  collectFeedback?: boolean;
  showTypingIndicator?: boolean;
  streamingEnabled?: boolean;
  sessionDurationMinutes?: number;
  requireApproval?: boolean;
  escalationEnabled?: boolean;
  humanHandoffEmail?: string;
}

export interface AgentWidgetConfig {
  appearance?: AgentWidgetAppearanceConfig;
  behavior?: AgentWidgetBehaviorConfig;
  [key: string]: unknown;
}

export interface AgentSecurityConfig {
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  maxDailyRuns?: number;
  allowedTools?: string[];
  requireAuthentication?: boolean;
  sensitiveActionsRequireApproval?: boolean;
  blockedTools?: string[];
  [key: string]: unknown;
}

export interface AgentDeploymentView {
  id: string;
  workspaceId: string;
  agentId: string;
  name: string;
  environment: AgentDeploymentEnvironment;
  status: AgentDeploymentStatus;
  versionNumber: number;
  target: AgentDeploymentTarget;
  publicKey: string;
  allowedOrigins: string[];
  widgetConfig: AgentWidgetConfig;
  securityConfig: AgentSecurityConfig;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  agentName?: string;
  agentDescription?: string | null;
  agentAvatarUrl?: string | null;
  agentRole?: string;
  agentModel?: string;
  publishedVersionTag?: string;
  activeSessionsCount?: number;
  webhooksCount?: number;
  runsCount?: number;
}

export interface AgentDeploymentSessionView {
  id: string;
  deploymentId: string;
  agentId: string;
  sessionToken: string;
  clientOrigin?: string | null;
  userContext: Record<string, unknown>;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  messagesCount?: number;
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    status?: string;
  }>;
  executionState?: AgentExecutionState;
  awaitingApproval?: {
    action: string;
    description: string;
    parameters: Record<string, unknown>;
    riskLevel?: 'low' | 'medium' | 'high';
  };
}

export interface AgentRunResponseView {
  runId: string;
  sessionId?: string;
  agentId: string;
  deploymentId?: string;
  versionNumber: number;
  status: AgentExecutionState;
  output: string;
  toolExecutions: Array<{
    toolName: string;
    arguments: Record<string, unknown>;
    output: unknown;
    status: string;
    durationMs?: number;
  }>;
  tokensUsed: number;
  latencyMs: number;
  error?: string | null;
  awaitingApproval?: {
    action: string;
    description: string;
    parameters: Record<string, unknown>;
    riskLevel?: 'low' | 'medium' | 'high';
  };
  metadata?: Record<string, unknown>;
}

export interface AgentDeploymentWebhookView {
  id: string;
  deploymentId: string;
  url: string;
  secretMasked: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deliveriesCount?: number;
  lastDeliveryStatus?: string | null;
  lastDeliveryAt?: string | null;
}

export interface AgentWebhookDeliveryView {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED';
  statusCode?: number | null;
  latencyMs: number;
  error?: string | null;
  attempts: number;
  createdAt: string;
}

export interface AgentApiKeyView {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDeploymentAnalyticsSummary {
  deploymentId: string;
  period: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  estimatedCost: number;
  activeSessions: number;
  approvalsRequested: number;
  approvalsApproved: number;
  approvalsRejected: number;
  toolExecutionsCount: number;
  topTools: Array<{ name: string; count: number }>;
  recentErrorCategories: Array<{ category: string; count: number }>;
}

export const DEFAULT_WIDGET_CONFIG: AgentWidgetConfig = {
  title: 'OneTab AI Assistant',
  subtitle: 'Universal AI Agent',
  primaryColor: '#2563eb',
  theme: 'system',
  position: 'bottom-right',
  welcomeMessage: 'Hello! How can I assist you today?',
  suggestedPrompts: [
    'Compare product specifications',
    'Check inventory and pricing',
    'Create an order request',
  ],
  showAvatar: true,
  showHeader: true,
  showFeedback: true,
  allowAttachments: true,
  enableSpeech: false,
  appearance: {
    mode: 'floating',
    position: 'bottom-right',
    theme: 'dark',
    primaryColor: '#6366f1',
    accentColor: '#4f46e5',
    backgroundColor: '#0f172a',
    surfaceColor: '#1e293b',
    textColor: '#f8fafc',
    borderColor: '#334155',
    title: 'OneTab AI Assistant',
    subtitle: 'Universal AI Agent',
    launcherIcon: 'Bot',
    launcherSize: 'md',
    borderRadius: 16,
    width: 400,
    height: 600,
    welcomeMessage: 'Hello! How can I assist you today?',
    suggestedPrompts: [
      'Compare product specifications',
      'Check inventory and pricing',
      'Create an order request',
    ],
    inputPlaceholder: 'Ask a question or enter instructions...',
    showBranding: true,
  },
  behavior: {
    defaultOpen: false,
    allowAttachments: true,
    collectFeedback: true,
    showTypingIndicator: true,
    streamingEnabled: true,
    sessionDurationMinutes: 1440,
    requireApproval: true,
    escalationEnabled: false,
  },
};

export const DEFAULT_AGENT_WIDGET_CONFIG = DEFAULT_WIDGET_CONFIG;

export const DEFAULT_SECURITY_CONFIG: AgentSecurityConfig = {
  allowedOrigins: ['*'],
  rateLimitPerMinute: 60,
  rateLimitPerMin: 60,
  requireAuthentication: false,
  requireAuth: false,
  sensitiveActionsRequireApproval: true,
  allowedTools: [],
};

