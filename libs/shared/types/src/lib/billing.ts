/**
 * Billing & Subscription DTOs and Contracts
 */
import type { PlanBillingInterval, PlanDefinition, PlanFeature, PlanLimit, PlanTier } from './plans.js';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'UNPAID'
  | 'INCOMPLETE'
  | 'PAUSED'
  | 'EXPIRED';

export type SubscriptionSource = 'FREE' | 'PROVIDER' | 'PROMOTION' | 'CONTRACT' | 'LEGACY';

export type CouponStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'SCHEDULED';
export type FreeCheckoutPolicy = 'DISABLED' | 'TEST_ONLY' | 'APPROVED';

/** Machine-readable reason a coupon was rejected. */
export type CouponRejectionReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'EXHAUSTED'
  | 'PLAN_INELIGIBLE'
  | 'INTERVAL_INELIGIBLE'
  | 'CURRENCY_MISMATCH'
  | 'BELOW_MINIMUM'
  | 'USER_LIMIT'
  | 'NOT_FIRST_TIME'
  | 'FREE_PLAN';

export interface PromotionDto {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  /** PERCENTAGE: 0-100. FIXED: minor units (cents). */
  discountValue: number;
  currency: string;
  applicablePlans: PlanTier[];
  /** Empty = every interval. */
  applicableIntervals: PlanBillingInterval[];
  minPurchaseCents?: number | null;
  firstTimeCustomerOnly: boolean;
  trialExtensionDays?: number | null;
  freeCheckoutPolicy: FreeCheckoutPolicy;
  validFrom: string;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  redemptionsCount: number;
  perUserLimit: number;
  active: boolean;
  status: CouponStatus;
}

export interface SavePromotionInput {
  code: string;
  name?: string | null;
  description?: string | null;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  applicablePlans?: PlanTier[];
  applicableIntervals?: PlanBillingInterval[];
  minPurchaseCents?: number | null;
  firstTimeCustomerOnly?: boolean;
  trialExtensionDays?: number | null;
  freeCheckoutPolicy?: FreeCheckoutPolicy;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  perUserLimit?: number;
  active?: boolean;
}

export interface ValidatePromotionInput {
  code: string;
  planTier: PlanTier;
  billingInterval?: PlanBillingInterval;
}

/** Server-computed price breakdown shown in checkout. All amounts in cents. */
export interface CheckoutQuote {
  planTier: PlanTier;
  billingInterval: PlanBillingInterval;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  renewalCents: number;
  /** Free-trial days before the first charge (0 = none). */
  trialDays: number;
  /** Amount charged today: 0 during a trial, otherwise `totalCents`. */
  dueNowCents: number;
  /** Tax is calculated by the payment provider at payment time. */
  taxCalculatedByProvider: boolean;
  promotionCode: string | null;
}

export interface ValidatePromotionResponse {
  valid: boolean;
  code: string;
  reason?: CouponRejectionReason;
  message?: string;
  discountCents: number;
  /** Convenience for display only; the quote is authoritative. */
  discountPercent: number;
  quote?: CheckoutQuote;
  /** True when the coupon makes the checkout free of charge. */
  makesFree?: boolean;
  trialExtensionDays?: number | null;
}

export interface CreditTransactionDto {
  id: string;
  accountId: string;
  amount: number; // positive for grant/top-up, negative for deduction
  balanceAfter: number;
  description: string;
  referenceType?: 'AGENT' | 'WORKFLOW' | 'TOP_UP' | 'PLAN_GRANT' | string;
  referenceId?: string;
  createdAt: string;
}

export interface CreditAccountDto {
  id: string;
  workspaceId: string;
  balance: number;
  currency: string;
  updatedAt: string;
  transactions?: CreditTransactionDto[];
}

export interface TopUpCreditsInput {
  amount: number; // USD amount
  idempotencyKey?: string;
}

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
  trialStart?: string | null;
  trialEnd?: string | null;
  trialStatus?: 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'NOT_STARTED' | null;
  trialUsed: boolean;
  convertedAt?: string | null;
  appliedPromotionCode?: string | null;
  discountPercent?: number | null;
  source: SubscriptionSource;
  provider?: string | null;
  pastDueSince?: string | null;
  scheduledPlanTier?: PlanTier | null;
  scheduledBillingInterval?: PlanBillingInterval | null;
  scheduledChangeAt?: string | null;
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
  creditAccount: CreditAccountDto;
  usage: {
    members: ResourceUsageMetric;
    projects: ResourceUsageMetric;
    storage: ResourceUsageMetric;
    aiRequests: ResourceUsageMetric;
    automations: ResourceUsageMetric;
    integrations: ResourceUsageMetric;
    microAgents: ResourceUsageMetric;
    concurrentExecutions: ResourceUsageMetric;
    networkTransfer: ResourceUsageMetric;
    aiCredits: ResourceUsageMetric;
  };
  entitlements: Record<PlanFeature, boolean>;
  canManageBilling: boolean;
  /** Whether a payment provider is configured so paid checkout can complete. */
  paymentsEnabled: boolean;
  paymentProvider: string | null;
  /** `test` never takes real money; `live` is production billing. */
  billingMode: 'test' | 'live';
}

export interface CheckoutPlanInput {
  targetPlan: PlanTier;
  billingInterval?: PlanBillingInterval;
  promotionCode?: string;
  /** Ask for the plan's free trial, if the workspace is still eligible. */
  startTrial?: boolean;
  /** Client-generated; repeated submissions with the same key return the same session. */
  idempotencyKey?: string;
}

export type CheckoutStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface CheckoutSessionDto {
  id: string;
  status: CheckoutStatus;
  quote: CheckoutQuote;
  /** Hosted payment page to send the user to; null when no payment is needed. */
  redirectUrl: string | null;
  /** True when the plan was activated without a provider payment (approved zero-total rule). */
  activatedWithoutPayment: boolean;
  failureReason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface UpgradePlanInput {
  targetPlan: PlanTier;
  billingInterval?: PlanBillingInterval;
  promotionCode?: string;
  idempotencyKey?: string;
}

export interface DowngradePlanInput {
  targetPlan: PlanTier;
  reason?: string;
  acknowledgeOverages?: boolean;
}

export interface BillingPortalResponse {
  url: string;
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
  status: 'PAID' | 'OPEN' | 'VOID' | 'UNCOLLECTIBLE' | 'REFUNDED';
  periodStart: string;
  periodEnd: string;
  pdfUrl?: string;
  hostedUrl?: string;
  description: string;
}
