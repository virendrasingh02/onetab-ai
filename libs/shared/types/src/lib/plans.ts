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
  | 'custom_llm' // Enterprise custom provider/model endpoint
  | 'enterprise_ai_governance'
  // Automation & Workflows
  | 'basic_automations'
  | 'advanced_automations'
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
  | 'dedicated_support';

export type PlanLimit =
  | 'max_members'
  | 'max_projects'
  | 'storage_bytes'
  | 'monthly_ai_requests'
  | 'max_active_automations'
  | 'max_active_integrations'
  | 'api_rate_limit_rpm';

export interface PlanPricing {
  monthly: number; // in USD
  annual: number; // in USD per month when billed annually
  annualDiscountPercent: number;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  tagline: string;
  description: string;
  badgeText?: string;
  isPopular?: boolean;
  isCustomQuote?: boolean;
  pricing: PlanPricing;
  features: readonly PlanFeature[];
  limits: Record<PlanLimit, number>; // -1 represents Infinity / Custom
  highlightedFeatures: readonly string[];
  ctaLabel: string;
  ctaVariant: 'outline' | 'primary' | 'secondary' | 'gradient';
}

export const PLANS_CONFIG: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'For individuals and small teams starting out',
    description: 'Core messaging, tasks, documents, and essential AI assistance to organize your team.',
    pricing: {
      monthly: 0,
      annual: 0,
      annualDiscountPercent: 0,
    },
    features: [
      'core_workspace',
      'basic_projects',
      'basic_views',
      'basic_collaboration',
      'whiteboard',
      'basic_ai',
      'basic_automations',
      'standard_integrations',
    ],
    limits: {
      max_members: 5,
      max_projects: 5,
      storage_bytes: 2 * 1024 * 1024 * 1024, // 2 GB
      monthly_ai_requests: 100,
      max_active_automations: 3,
      max_active_integrations: 3,
      api_rate_limit_rpm: 30,
    },
    highlightedFeatures: [
      'Up to 5 team members',
      'Up to 5 active projects',
      '2 GB file & media storage',
      '100 monthly AI assistant requests',
      'List & Board views',
      'Standard community support',
    ],
    ctaLabel: 'Current Plan',
    ctaVariant: 'outline',
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For fast-moving teams requiring power tools & AI',
    description: 'Unlimited projects, advanced timeline/gantt views, AI agent builder, and expanded storage.',
    badgeText: 'MOST POPULAR',
    isPopular: true,
    pricing: {
      monthly: 12,
      annual: 10,
      annualDiscountPercent: 17,
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
      storage_bytes: 100 * 1024 * 1024 * 1024, // 100 GB
      monthly_ai_requests: 10_000,
      max_active_automations: 50,
      max_active_integrations: 25,
      api_rate_limit_rpm: 120,
    },
    highlightedFeatures: [
      'Up to 25 team members',
      'Unlimited projects, sprints & cycles',
      '100 GB high-speed storage',
      '10,000 monthly AI requests & Agent Builder',
      'Timeline, Gantt & Spreadsheet views',
      'REST & Webhook API access',
      'Priority email support',
    ],
    ctaLabel: 'Upgrade to Pro',
    ctaVariant: 'primary',
  },

  business: {
    id: 'business',
    name: 'Business',
    tagline: 'For organizations demanding security, compliance & scale',
    description: 'Organization-wide administration, SAML SSO, SCIM provisioning, audit logs, and custom roles.',
    badgeText: 'FOR ORGANIZATIONS',
    pricing: {
      monthly: 36,
      annual: 28,
      annualDiscountPercent: 22,
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
      max_members: 250,
      max_projects: -1, // Unlimited
      storage_bytes: 1024 * 1024 * 1024 * 1024, // 1 TB
      monthly_ai_requests: 50_000,
      max_active_automations: -1, // Unlimited
      max_active_integrations: -1, // Unlimited
      api_rate_limit_rpm: 300,
    },
    highlightedFeatures: [
      'Up to 250 team members',
      'SAML 2.0 / Okta SSO & SCIM directory sync',
      'Organization audit & compliance logs',
      'Granular roles & custom permissions',
      '1 TB enterprise storage',
      '50,000 monthly AI requests',
      '24/7 dedicated priority support',
    ],
    ctaLabel: 'Upgrade to Business',
    ctaVariant: 'gradient',
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise — Custom LLM',
    tagline: 'Custom private LLM deployment, custom limits & governance',
    description: 'Connect your own private LLMs (OpenAI-compatible, Azure, vLLM, private endpoints), custom contracts & dedicated infrastructure.',
    badgeText: 'CUSTOM LLM & GOVERNANCE',
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
      'custom_llm',
      'enterprise_ai_governance',
      'basic_automations',
      'advanced_automations',
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
    ],
    limits: {
      max_members: -1, // Unlimited / Negotiated
      max_projects: -1,
      storage_bytes: -1,
      monthly_ai_requests: -1,
      max_active_automations: -1,
      max_active_integrations: -1,
      api_rate_limit_rpm: 1000,
    },
    highlightedFeatures: [
      'Custom LLM Integration (Private models, Azure, vLLM, self-hosted)',
      'Enterprise AI Governance & custom model routing',
      'Unlimited members & custom storage allocation',
      'Custom SLA, BAA & SOC2 Compliance reports',
      'Custom retention policies & dedicated isolated infra',
      'Dedicated technical account manager & 15-min SLA',
    ],
    ctaLabel: 'Contact Sales',
    ctaVariant: 'secondary',
  },
};

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
