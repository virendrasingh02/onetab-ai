/**
 * Centralized Plan Configuration & Entitlement Engine
 *
 * Defines the 4 platform tiers:
 * 1. Starter (Free entry-level)
 * 2. Pro (Growing teams & advanced features)
 * 3. Business (Organizations, administration & security)
 * 4. Enterprise — Custom LLM (Custom limits, dedicated support, custom LLM integration)
 */

export type PlanTier = 'starter' | 'pro' | 'business' | 'enterprise';

export const PLAN_TIERS: readonly PlanTier[] = [
  'starter',
  'pro',
  'business',
  'enterprise',
] as const;

export type PlanBillingInterval = 'monthly' | 'annual';


export type PlanLimit =
  | 'max_members'
  | 'max_projects'
  | 'storage_bytes'
  | 'monthly_ai_requests'
  | 'max_active_automations'
  | 'max_active_integrations'
  | 'api_rate_limit_rpm'
  // Machine-readable resource limits
  | 'micro_agents'
  | 'cpu'
  | 'ram_gb'
  | 'requests_per_month'
  | 'concurrent_executions'
  | 'max_execution_time_ms'
  | 'network_transfer_gb'
  | 'ai_credits_usd'
  | 'log_retention_days';

export type PlanFeature =
  // Work & Views
  | 'core_workspace'
  | 'basic_projects'
  | 'unlimited_projects'
  | 'advanced_project_management'
  | 'basic_views'
  | 'advanced_views' // Gantt, Timeline, Calendar, Spreadsheet
  | 'multiple_assignees'
  | 'whiteboard'
  // Intelligence & AI
  | 'basic_ai'
  | 'advanced_ai'
  | 'custom_prompt_templates'
  | 'agent_marketplace'
  | 'agent_builder'
  | 'agent_upgrades' // Pro/Business/Enterprise only
  | 'per_agent_config'
  | 'transparent_ai_billing'
  | 'unlimited_testing_staging'
  | 'extended_execution_hours'
  | 'custom_agent'
  | 'custom_llm' // Enterprise custom provider/model endpoint
  | 'enterprise_ai_governance'
  // Automation & Workflows
  | 'basic_automations'
  | 'advanced_automations'
  | 'unlimited_workflows'
  // Integrations & API
  | 'standard_integrations'
  | 'advanced_integrations'
  | 'custom_integrations'
  | 'api_access'
  | 'advanced_api_limits'
  // Collaboration & Admin
  | 'basic_collaboration'
  | 'team_admin'
  | 'roles_and_permissions'
  | 'custom_roles'
  | 'audit_logs'
  // Security & Enterprise
  | 'sso_saml'
  | 'scim_provisioning'
  | 'security_policies'
  | 'dedicated_infrastructure'
  | 'custom_data_retention'
  | 'priority_support'
  | 'dedicated_support'
  | 'enterprise_support'
  | 'custom_deployment';

export interface PlanPricing {
  monthly: number; // in USD
  annual: number; // in USD per month when billed annually
  annualDiscountPercent: number;
}

export interface PlanMachineLimits {
  microAgents: number; // -1 = Unlimited
  cpu: number; // -1 = Custom
  ramGb: number; // -1 = Custom
  requestsPerMonth: number; // -1 = Custom
  concurrentExecutions: number; // -1 = Custom
  maxExecutionTimeMs: number; // -1 = Custom
  networkTransferGb: number; // -1 = Custom
  aiCreditsUsd: number; // -1 = Custom
  logRetentionDays: number; // -1 = Custom
  agentUpgrades: boolean;
}

export interface PlanFeatureItem {
  id: string;
  label: string;
  included: boolean;
  valueText?: string;
  description?: string;
  category:
    | 'AI Agents'
    | 'AI Credits'
    | 'Workflow'
    | 'Execution'
    | 'Infrastructure'
    | 'Usage'
    | 'Logs'
    | 'Governance'
    | 'Security'
    | 'Support';
}

export interface PlanDefinition {
  id: PlanTier;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  badgeText?: string;
  isPopular?: boolean;
  isCustomQuote?: boolean;
  trialDays?: number;
  promotionalDisplay?: {
    code: string;
    discountPercent: number;
    discountedMonthlyPrice: number;
    label: string;
  };
  pricing: PlanPricing;
  features: readonly PlanFeature[];
  limits: Record<PlanLimit, number>; // -1 represents Infinity / Custom
  machineLimits: PlanMachineLimits;
  highlightedFeatures: readonly string[];
  expandedFeatures: readonly PlanFeatureItem[];
  ctaLabel: string;
  ctaVariant: 'outline' | 'primary' | 'secondary' | 'gradient';
}

export const ACTIVE_PROMOTION_CODE = 's1nu00780';

export const PLANS_CONFIG: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter: {
    id: 'starter',
    slug: 'starter',
    name: 'Starter',
    tagline: 'Everything you need to explore AI workflows',
    description: 'Everything you need to explore AI workflows.',
    trialDays: 7,
    promotionalDisplay: {
      code: ACTIVE_PROMOTION_CODE,
      discountPercent: 100,
      discountedMonthlyPrice: 0,
      label: '100% off with code: s1nu00780',
    },
    pricing: {
      monthly: 15,
      annual: 12,
      annualDiscountPercent: 20,
    },
    features: [
      'core_workspace',
      'basic_projects',
      'basic_views',
      'basic_collaboration',
      'whiteboard',
      'basic_ai',
      'transparent_ai_billing',
      'unlimited_testing_staging',
      'per_agent_config',
      'basic_automations',
      'standard_integrations',
    ],
    limits: {
      max_members: 5,
      max_projects: 5,
      storage_bytes: 8 * 1024 * 1024 * 1024, // 8 GB
      monthly_ai_requests: 5000,
      max_active_automations: 3,
      max_active_integrations: 3,
      api_rate_limit_rpm: 60,
      micro_agents: 3,
      cpu: 2,
      ram_gb: 4,
      requests_per_month: 5000,
      concurrent_executions: 20,
      max_execution_time_ms: 400,
      network_transfer_gb: 8,
      ai_credits_usd: 5.0,
      log_retention_days: 7,
    },
    machineLimits: {
      microAgents: 3,
      cpu: 2,
      ramGb: 4,
      requestsPerMonth: 5000,
      concurrentExecutions: 20,
      maxExecutionTimeMs: 400,
      networkTransferGb: 8,
      aiCreditsUsd: 5.0,
      logRetentionDays: 7,
      agentUpgrades: false,
    },
    highlightedFeatures: [
      '3 Micro Agents',
      '2 CPUs & 4 GB RAM',
      '5K requests per month',
      '$5 shared AI credits for agents & workflows',
      '7-day activity, execution & usage logs',
      '8 GB total network transfer (ingress + egress)',
      'Up to 20 concurrent executions (max 400ms runtime)',
      'Agent upgrades not included',
    ],
    expandedFeatures: [
      { id: 'f_agents', label: 'Micro Agents', included: true, valueText: '3 Micro Agents', category: 'AI Agents' },
      { id: 'f_upgrades', label: 'Agent Upgrades', included: false, valueText: 'Not included', category: 'AI Agents' },
      { id: 'f_per_agent', label: 'Per micro-agent controls', included: true, category: 'AI Agents' },
      { id: 'f_credits', label: 'Shared AI Credits', included: true, valueText: '$5 / mo', category: 'AI Credits' },
      { id: 'f_billing', label: 'Transparent AI billing & top-ups', included: true, category: 'AI Credits' },
      { id: 'f_builders', label: 'Unlimited testing, staging & low-code builders', included: true, category: 'Workflow' },
      { id: 'f_requests', label: 'Requests per month', included: true, valueText: '5,000 requests', category: 'Execution' },
      { id: 'f_concurrent', label: 'Concurrent executions', included: true, valueText: 'Up to 20 concurrent', category: 'Execution' },
      { id: 'f_runtime', label: 'Max execution time per request', included: true, valueText: '400ms', category: 'Execution' },
      { id: 'f_cpu', label: 'Compute Resources', included: true, valueText: '2 CPUs, 4 GB RAM', category: 'Infrastructure' },
      { id: 'f_transfer', label: 'Network Transfer', included: true, valueText: '8 GB total', category: 'Infrastructure' },
      { id: 'f_logs', label: 'Activity & execution log retention', included: true, valueText: '7 days', category: 'Logs' },
      { id: 'f_support', label: 'Community & standard support', included: true, category: 'Support' },
    ],
    ctaLabel: 'Choose Starter',
    ctaVariant: 'outline',
  },

  pro: {
    id: 'pro',
    slug: 'pro',
    name: 'Pro',
    tagline: 'Higher limits and team-level control',
    description: 'Higher limits and team-level control.',
    badgeText: 'MOST POPULAR',
    isPopular: true,
    trialDays: 7,
    promotionalDisplay: {
      code: ACTIVE_PROMOTION_CODE,
      discountPercent: 100,
      discountedMonthlyPrice: 0,
      label: '100% off with code: s1nu00780',
    },
    pricing: {
      monthly: 30,
      annual: 24,
      annualDiscountPercent: 20,
    },
    features: [
      'core_workspace',
      'basic_projects',
      'unlimited_projects',
      'advanced_project_management',
      'basic_views',
      'advanced_views',
      'multiple_assignees',
      'whiteboard',
      'basic_ai',
      'advanced_ai',
      'custom_prompt_templates',
      'agent_marketplace',
      'agent_builder',
      'agent_upgrades',
      'transparent_ai_billing',
      'unlimited_testing_staging',
      'per_agent_config',
      'basic_automations',
      'advanced_automations',
      'standard_integrations',
      'advanced_integrations',
      'api_access',
      'basic_collaboration',
      'team_admin',
      'priority_support',
    ],
    limits: {
      max_members: 25,
      max_projects: -1, // Unlimited
      storage_bytes: 25 * 1024 * 1024 * 1024, // 25 GB
      monthly_ai_requests: 5000,
      max_active_automations: 50,
      max_active_integrations: 25,
      api_rate_limit_rpm: 120,
      micro_agents: 10,
      cpu: 2,
      ram_gb: 4,
      requests_per_month: 5000,
      concurrent_executions: 20,
      max_execution_time_ms: 400,
      network_transfer_gb: 8,
      ai_credits_usd: 5.0,
      log_retention_days: 30,
    },
    machineLimits: {
      microAgents: 10,
      cpu: 2,
      ramGb: 4,
      requestsPerMonth: 5000,
      concurrentExecutions: 20,
      maxExecutionTimeMs: 400,
      networkTransferGb: 8,
      aiCreditsUsd: 5.0,
      logRetentionDays: 30,
      agentUpgrades: true,
    },
    highlightedFeatures: [
      '10 Micro Agents (Upgradeable)',
      '2 CPUs & 4 GB RAM',
      '5K requests per month',
      '$5 shared AI credits for agents, workflows & builder runtime',
      '30-day activity, execution & usage logs',
      '8 GB total data transfer across agents & workflows',
      'Up to 20 concurrent executions (max 400ms runtime)',
      'Agent upgrades included & higher performance',
      'Access to additional platform features',
    ],
    expandedFeatures: [
      { id: 'f_agents', label: 'Micro Agents', included: true, valueText: '10 Micro Agents', category: 'AI Agents' },
      { id: 'f_upgrades', label: 'Agent Upgrades', included: true, valueText: 'Included (Higher performance)', category: 'AI Agents' },
      { id: 'f_per_agent', label: 'Per micro-agent controls & builder', included: true, category: 'AI Agents' },
      { id: 'f_credits', label: 'Shared AI Credits', included: true, valueText: '$5 / mo', category: 'AI Credits' },
      { id: 'f_billing', label: 'Transparent AI billing & credit top-ups', included: true, category: 'AI Credits' },
      { id: 'f_builders', label: 'Unlimited testing, staging & workflow builders', included: true, category: 'Workflow' },
      { id: 'f_requests', label: 'Requests per month', included: true, valueText: '5,000 requests', category: 'Execution' },
      { id: 'f_concurrent', label: 'Concurrent executions', included: true, valueText: 'Up to 20 concurrent', category: 'Execution' },
      { id: 'f_runtime', label: 'Max execution time per request', included: true, valueText: '400ms', category: 'Execution' },
      { id: 'f_cpu', label: 'Compute Resources', included: true, valueText: '2 CPUs, 4 GB RAM', category: 'Infrastructure' },
      { id: 'f_transfer', label: 'Network Transfer', included: true, valueText: '8 GB total across workflows', category: 'Infrastructure' },
      { id: 'f_logs', label: 'Activity & execution log retention', included: true, valueText: '30 days', category: 'Logs' },
      { id: 'f_support', label: 'Priority email & agent support', included: true, category: 'Support' },
    ],
    ctaLabel: 'Choose Pro',
    ctaVariant: 'primary',
  },

  business: {
    id: 'business',
    slug: 'business',
    name: 'Business',
    tagline: 'Advanced governance and scale',
    description: 'Advanced governance and scale.',
    badgeText: 'ADVANCED GOVERNANCE',
    trialDays: 7,
    promotionalDisplay: {
      code: ACTIVE_PROMOTION_CODE,
      discountPercent: 100,
      discountedMonthlyPrice: 0,
      label: '100% off with code: s1nu00780',
    },
    pricing: {
      monthly: 45,
      annual: 36,
      annualDiscountPercent: 20,
    },
    features: [
      'core_workspace',
      'basic_projects',
      'unlimited_projects',
      'advanced_project_management',
      'basic_views',
      'advanced_views',
      'multiple_assignees',
      'whiteboard',
      'basic_ai',
      'advanced_ai',
      'custom_prompt_templates',
      'agent_marketplace',
      'agent_builder',
      'agent_upgrades',
      'transparent_ai_billing',
      'unlimited_testing_staging',
      'per_agent_config',
      'extended_execution_hours',
      'basic_automations',
      'advanced_automations',
      'standard_integrations',
      'advanced_integrations',
      'api_access',
      'advanced_api_limits',
      'basic_collaboration',
      'team_admin',
      'roles_and_permissions',
      'custom_roles',
      'audit_logs',
      'sso_saml',
      'scim_provisioning',
      'security_policies',
      'priority_support',
    ],
    limits: {
      max_members: 100,
      max_projects: -1, // Unlimited
      storage_bytes: 100 * 1024 * 1024 * 1024, // 100 GB
      monthly_ai_requests: 5000,
      max_active_automations: -1, // Unlimited
      max_active_integrations: -1, // Unlimited
      api_rate_limit_rpm: 300,
      micro_agents: 25,
      cpu: 2,
      ram_gb: 4,
      requests_per_month: 5000,
      concurrent_executions: 20,
      max_execution_time_ms: 400,
      network_transfer_gb: 8,
      ai_credits_usd: 5.0,
      log_retention_days: 90,
    },
    machineLimits: {
      microAgents: 25,
      cpu: 2,
      ramGb: 4,
      requestsPerMonth: 5000,
      concurrentExecutions: 20,
      maxExecutionTimeMs: 400,
      networkTransferGb: 8,
      aiCreditsUsd: 5.0,
      logRetentionDays: 90,
      agentUpgrades: true,
    },
    highlightedFeatures: [
      '25 Micro Agents (Upgradeable)',
      '2 CPUs & 4 GB RAM',
      '5K requests per month',
      '$5 shared AI credits across agents, workflows & builder',
      '3-month activity, execution & audit logs',
      'Agent upgrades & extended execution hours included',
      'Individual & shared AI credit top-ups across all agents',
      'Additional business-level governance & security features',
    ],
    expandedFeatures: [
      { id: 'f_agents', label: 'Micro Agents', included: true, valueText: '25 Micro Agents', category: 'AI Agents' },
      { id: 'f_upgrades', label: 'Agent Upgrades', included: true, valueText: 'Included (Higher performance)', category: 'AI Agents' },
      { id: 'f_per_agent', label: 'Per micro-agent controls & builder', included: true, category: 'AI Agents' },
      { id: 'f_credits', label: 'Shared AI Credits', included: true, valueText: '$5 / mo (Shared across all)', category: 'AI Credits' },
      { id: 'f_billing', label: 'Individual & shared AI credit top-ups', included: true, category: 'AI Credits' },
      { id: 'f_builders', label: 'Unlimited testing, staging & workflow builders', included: true, category: 'Workflow' },
      { id: 'f_requests', label: 'Requests per month', included: true, valueText: '5,000 requests', category: 'Execution' },
      { id: 'f_concurrent', label: 'Concurrent executions', included: true, valueText: 'Up to 20 concurrent', category: 'Execution' },
      { id: 'f_runtime', label: 'Max execution time per request', included: true, valueText: '400ms + Extended hours', category: 'Execution' },
      { id: 'f_cpu', label: 'Compute Resources', included: true, valueText: '2 CPUs, 4 GB RAM', category: 'Infrastructure' },
      { id: 'f_transfer', label: 'Network Transfer', included: true, valueText: '8 GB total across workflows', category: 'Infrastructure' },
      { id: 'f_logs', label: 'Activity, execution & audit logs', included: true, valueText: '90 days (3 months)', category: 'Logs' },
      { id: 'f_gov', label: 'SAML SSO, SCIM, & custom roles', included: true, category: 'Governance' },
      { id: 'f_support', label: '24/7 dedicated priority support', included: true, category: 'Support' },
    ],
    ctaLabel: 'Choose Business',
    ctaVariant: 'gradient',
  },

  enterprise: {
    id: 'enterprise',
    slug: 'enterprise',
    name: 'Enterprise (Custom LLM)',
    tagline: 'Custom scale, security & support',
    description: 'Custom scale, security & support.',
    badgeText: 'CUSTOM SCALE & LLM',
    isCustomQuote: true,
    pricing: {
      monthly: 0,
      annual: 0,
      annualDiscountPercent: 0,
    },
    features: [
      'core_workspace',
      'basic_projects',
      'unlimited_projects',
      'advanced_project_management',
      'basic_views',
      'advanced_views',
      'multiple_assignees',
      'whiteboard',
      'basic_ai',
      'advanced_ai',
      'custom_prompt_templates',
      'agent_marketplace',
      'agent_builder',
      'agent_upgrades',
      'transparent_ai_billing',
      'unlimited_testing_staging',
      'per_agent_config',
      'extended_execution_hours',
      'custom_agent',
      'custom_llm',
      'enterprise_ai_governance',
      'basic_automations',
      'advanced_automations',
      'unlimited_workflows',
      'standard_integrations',
      'advanced_integrations',
      'custom_integrations',
      'api_access',
      'advanced_api_limits',
      'basic_collaboration',
      'team_admin',
      'roles_and_permissions',
      'custom_roles',
      'audit_logs',
      'sso_saml',
      'scim_provisioning',
      'security_policies',
      'dedicated_infrastructure',
      'custom_data_retention',
      'priority_support',
      'dedicated_support',
      'enterprise_support',
      'custom_deployment',
    ],
    limits: {
      max_members: -1, // Unlimited
      max_projects: -1,
      storage_bytes: -1,
      monthly_ai_requests: -1,
      max_active_automations: -1,
      max_active_integrations: -1,
      api_rate_limit_rpm: 1000,
      micro_agents: -1, // Unlimited micro agents
      cpu: -1, // Custom
      ram_gb: -1, // Custom
      requests_per_month: -1, // Custom number of executions
      concurrent_executions: -1,
      max_execution_time_ms: -1,
      network_transfer_gb: -1,
      ai_credits_usd: -1,
      log_retention_days: 365,
    },
    machineLimits: {
      microAgents: -1,
      cpu: -1,
      ramGb: -1,
      requestsPerMonth: -1,
      concurrentExecutions: -1,
      maxExecutionTimeMs: -1,
      networkTransferGb: -1,
      aiCreditsUsd: -1,
      logRetentionDays: 365,
      agentUpgrades: true,
    },
    highlightedFeatures: [
      'Unlimited Micro Agents & Custom Agent creation',
      'Custom number of workflow executions & unlimited workflows',
      'Fully customized setup & deployment (Private LLMs, Azure, vLLM)',
      '365-day activity, execution & audit log retention',
      'Custom pricing & enterprise volume discounts',
      'Enterprise support & dedicated technical account manager',
      'Custom LLM configuration & enterprise AI governance',
    ],
    expandedFeatures: [
      { id: 'f_agents', label: 'Micro Agents', included: true, valueText: 'Unlimited Micro Agents', category: 'AI Agents' },
      { id: 'f_custom_agent', label: 'Custom Agent creation', included: true, valueText: 'Custom Agent', category: 'AI Agents' },
      { id: 'f_upgrades', label: 'Agent Upgrades', included: true, valueText: 'Custom setup', category: 'AI Agents' },
      { id: 'f_llm', label: 'Custom LLM configuration', included: true, valueText: 'Private endpoints / Azure / vLLM', category: 'AI Agents' },
      { id: 'f_credits', label: 'AI Credits', included: true, valueText: 'Custom allocation', category: 'AI Credits' },
      { id: 'f_billing', label: 'Consolidated enterprise invoicing', included: true, category: 'AI Credits' },
      { id: 'f_builders', label: 'Unlimited workflows & executions', included: true, valueText: 'Custom volume', category: 'Workflow' },
      { id: 'f_requests', label: 'Requests per month', included: true, valueText: 'Custom volume', category: 'Execution' },
      { id: 'f_concurrent', label: 'Concurrent executions', included: true, valueText: 'Custom / Uncapped', category: 'Execution' },
      { id: 'f_runtime', label: 'Execution duration', included: true, valueText: 'Custom SLA', category: 'Execution' },
      { id: 'f_cpu', label: 'Compute Resources', included: true, valueText: 'Dedicated Infrastructure', category: 'Infrastructure' },
      { id: 'f_transfer', label: 'Network Transfer', included: true, valueText: 'Custom bandwidth', category: 'Infrastructure' },
      { id: 'f_logs', label: 'Activity, execution & audit logs', included: true, valueText: '365 days', category: 'Logs' },
      { id: 'f_gov', label: 'Enterprise governance & compliance', included: true, category: 'Governance' },
      { id: 'f_support', label: 'Enterprise support with 15-min SLA', included: true, category: 'Support' },
    ],
    ctaLabel: 'Talk to sales',
    ctaVariant: 'secondary',
  },
};

/**
 * Checks whether agent upgrades are permitted on a plan.
 */
export function canUpgradeAgent(plan: PlanTier | string | undefined | null): boolean {
  const normalized = normalizePlanTier(plan);
  return PLANS_CONFIG[normalized]?.machineLimits.agentUpgrades ?? false;
}

/**
 * Gets micro agent limit for a given plan (-1 represents unlimited).
 */
export function getMicroAgentLimit(plan: PlanTier | string | undefined | null): number {
  const normalized = normalizePlanTier(plan);
  return PLANS_CONFIG[normalized]?.machineLimits.microAgents ?? 3;
}

/**
 * Checks whether a plan supports free trial.
 */
export function isPlanTrialEligible(plan: PlanTier | string | undefined | null): boolean {
  const normalized = normalizePlanTier(plan);
  return (PLANS_CONFIG[normalized]?.trialDays ?? 0) > 0;
}

/**
 * Plan hierarchy index for comparison: starter (0) < pro (1) < business (2) < enterprise (3)
 */
export const PLAN_HIERARCHY: Record<PlanTier, number> = {
  starter: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

/**
 * Checks whether a given plan tier is at least the target tier.
 */
export function isPlanAtLeast(currentPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return (PLAN_HIERARCHY[currentPlan] ?? 0) >= (PLAN_HIERARCHY[requiredPlan] ?? 0);
}

/**
 * Checks whether a plan grants access to a specific feature.
 */
export function hasFeature(plan: PlanTier | string | undefined | null, feature: PlanFeature): boolean {
  const normalized = normalizePlanTier(plan);
  const def = PLANS_CONFIG[normalized];
  return def?.features.includes(feature) ?? false;
}

/**
 * Shorthand alias for `hasFeature`.
 */
export function canAccess(plan: PlanTier | string | undefined | null, feature: PlanFeature): boolean {
  return hasFeature(plan, feature);
}

/**
 * Gets the numeric limit for a resource on a plan (-1 means unlimited).
 */
export function getPlanLimit(plan: PlanTier | string | undefined | null, limit: PlanLimit): number {
  const normalized = normalizePlanTier(plan);
  const def = PLANS_CONFIG[normalized];
  return def?.limits[limit] ?? 0;
}

/**
 * Normalizes any string representation to a valid PlanTier, defaulting to 'starter'.
 */
export function normalizePlanTier(tier: string | undefined | null): PlanTier {
  if (!tier) return 'starter';
  const lower = tier.toLowerCase().trim();
  if (lower === 'pro') return 'pro';
  if (lower === 'business') return 'business';
  if (lower === 'enterprise') return 'enterprise';
  return 'starter';
}

/**
 * Checks if current usage has reached or exceeded the plan limit.
 */
export function isLimitReached(used: number, limit: number): boolean {
  if (limit === -1) return false; // Unlimited
  return used >= limit;
}

/**
 * Checks if current usage is nearing the plan limit (default threshold: >= 80%).
 */
export function isNearLimit(used: number, limit: number, thresholdPercent = 80): boolean {
  if (limit === -1 || limit <= 0) return false;
  const percentage = (used / limit) * 100;
  return percentage >= thresholdPercent && percentage < 100;
}

/**
 * Computes usage percentage clamped between 0 and 100.
 */
export function getUsagePercentage(used: number, limit: number): number {
  if (limit === -1) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}
