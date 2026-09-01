/**
 * Billing & Subscription DTOs and Contracts
 */
import type { PlanBillingInterval, PlanDefinition, PlanFeature, PlanLimit, PlanTier } from './plans.js';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'UNPAID';

export interface WorkspaceSubscriptionDto {
  id: string;
  workspaceId: string;
  planTier: PlanTier;
  billingInterval: PlanBillingInterval;
  status: SubscriptionStatus;
  seatsTotal: number;
  seatsUsed: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  renewAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceUsageMetric {
  key: PlanLimit;
  label: string;
  used: number;
  limit: number; // -1 for unlimited
  percentage: number;
  isNearLimit: boolean;
  isLimitReached: boolean;
  unit?: string;
}

export interface WorkspaceBillingSummary {
  workspaceId: string;
  workspaceName: string;
  plan: PlanTier;
  planConfig: PlanDefinition;
  subscription: WorkspaceSubscriptionDto | null;
  usage: {
    members: ResourceUsageMetric;
    projects: ResourceUsageMetric;
    storage: ResourceUsageMetric;
    aiRequests: ResourceUsageMetric;
    automations: ResourceUsageMetric;
    integrations: ResourceUsageMetric;
  };
  entitlements: Record<PlanFeature, boolean>;
  canManageBilling: boolean;
}

export interface UpgradePlanInput {
  targetPlan: PlanTier;
  billingInterval?: PlanBillingInterval;
  seats?: number;
  paymentMethodId?: string;
}

export interface DowngradePlanInput {
  targetPlan: PlanTier;
  reason?: string;
  acknowledgeOverages?: boolean;
}

export interface DowngradeImpactSummary {
  currentPlan: PlanTier;
  targetPlan: PlanTier;
  canDowngrade: boolean;
  warnings: Array<{
    resource: string;
    currentUsage: number;
    targetLimit: number;
    impactDescription: string;
    requiresReduction: boolean;
  }>;
  restrictedFeatures: string[];
}

export interface EnterpriseInquiryInput {
  name: string;
  email: string;
  companyName: string;
  teamSize?: string;
  customLlmRequirements?: string;
  message?: string;
}

export interface CustomLLMConfigDto {
  provider: 'custom' | 'azure_openai' | 'vllm' | 'ollama_remote' | 'openai_compatible';
  endpointUrl: string;
  modelIdentifier: string;
  maskedApiKey?: string;
  hasApiKey: boolean;
  temperature?: number;
  maxTokens?: number;
  contextWindow?: number;
  systemPrompt?: string;
  fallbackModel?: string;
  isPrivateNetwork?: boolean;
  isEnabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'PENDING';
  lastTestError?: string;
}

export interface SaveCustomLLMInput {
  provider: 'custom' | 'azure_openai' | 'vllm' | 'ollama_remote' | 'openai_compatible';
  endpointUrl: string;
  modelIdentifier: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  contextWindow?: number;
  systemPrompt?: string;
  fallbackModel?: string;
  isPrivateNetwork?: boolean;
  isEnabled?: boolean;
}

export interface TestCustomLLMInput {
  endpointUrl: string;
  modelIdentifier: string;
  apiKey?: string;
  provider?: string;
}

export interface TestCustomLLMResponse {
  success: boolean;
  latencyMs: number;
  model: string;
  message: string;
  error?: string;
}

export interface InvoiceItemDto {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: 'PAID' | 'OPEN' | 'VOID' | 'UNCOLLECTIBLE';
  periodStart: string;
  periodEnd: string;
  pdfUrl?: string;
  description: string;
}
