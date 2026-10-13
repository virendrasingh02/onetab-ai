import { describe, expect, it } from 'vitest';
import {
  getPlanLimit,
  getUsagePercentage,
  hasFeature,
  isLimitReached,
  isNearLimit,
  isPlanAtLeast,
  normalizePlanTier,
  PLANS_CONFIG,
} from './plans.js';

describe('Plan Entitlements & Configuration', () => {
  it('defines the 4 target plans', () => {
    expect(PLANS_CONFIG.free).toBeDefined();
    expect(PLANS_CONFIG.pro).toBeDefined();
    expect(PLANS_CONFIG.max).toBeDefined();
    expect(PLANS_CONFIG.enterprise).toBeDefined();
  });

  describe('hasFeature & canAccess', () => {
    it('grants basic features to free plan', () => {
      expect(hasFeature('free', 'core_workspace')).toBe(true);
      expect(hasFeature('free', 'basic_views')).toBe(true);
      expect(hasFeature('free', 'basic_projects')).toBe(true);
    });

    it('withholds advanced features from free plan', () => {
      expect(hasFeature('free', 'advanced_views')).toBe(false);
      expect(hasFeature('free', 'advanced_ai')).toBe(false);
      expect(hasFeature('free', 'sso_saml')).toBe(false);
      expect(hasFeature('free', 'custom_llm')).toBe(false);
      expect(hasFeature('free', 'audit_logs')).toBe(false);
    });

    it('grants pro features to pro plan', () => {
      expect(hasFeature('pro', 'advanced_views')).toBe(true);
      expect(hasFeature('pro', 'unlimited_projects')).toBe(true);
      expect(hasFeature('pro', 'agent_builder')).toBe(true);
      expect(hasFeature('pro', 'api_access')).toBe(true);
      expect(hasFeature('pro', 'sso_saml')).toBe(false);
      expect(hasFeature('pro', 'custom_llm')).toBe(false);
    });

    it('grants enterprise security and organization features to max plan', () => {
      expect(hasFeature('max', 'sso_saml')).toBe(true);
      expect(hasFeature('max', 'scim_provisioning')).toBe(true);
      expect(hasFeature('max', 'audit_logs')).toBe(true);
      expect(hasFeature('max', 'custom_roles')).toBe(true);
      expect(hasFeature('max', 'custom_llm')).toBe(false);
    });

    it('grants custom LLM and enterprise capabilities to enterprise plan', () => {
      expect(hasFeature('enterprise', 'custom_llm')).toBe(true);
      expect(hasFeature('enterprise', 'enterprise_ai_governance')).toBe(true);
      expect(hasFeature('enterprise', 'dedicated_infrastructure')).toBe(true);
      expect(hasFeature('enterprise', 'sso_saml')).toBe(true);
    });
  });

  describe('getPlanLimit & machineLimits', () => {
    it('returns member and storage limits per plan', () => {
      expect(getPlanLimit('free', 'max_members')).toBe(5);
      expect(getPlanLimit('pro', 'max_members')).toBe(25);
      expect(getPlanLimit('max', 'max_members')).toBe(100);
      expect(getPlanLimit('enterprise', 'max_members')).toBe(-1); // Unlimited
    });

    it('returns micro agents limits per plan', () => {
      expect(getPlanLimit('free', 'micro_agents')).toBe(3);
      expect(getPlanLimit('pro', 'micro_agents')).toBe(10);
      expect(getPlanLimit('max', 'micro_agents')).toBe(25);
      expect(getPlanLimit('enterprise', 'micro_agents')).toBe(-1);
    });

    it('returns request and execution limits per plan', () => {
      expect(getPlanLimit('free', 'requests_per_month')).toBe(5000);
      expect(getPlanLimit('pro', 'requests_per_month')).toBe(25000);
      expect(getPlanLimit('max', 'requests_per_month')).toBe(100000);
      expect(getPlanLimit('enterprise', 'requests_per_month')).toBe(-1);
      expect(getPlanLimit('free', 'concurrent_executions')).toBe(20);
      expect(getPlanLimit('free', 'max_execution_time_ms')).toBe(400);
    });

    it('validates agent upgrades capability per plan', () => {
      expect(PLANS_CONFIG.free.machineLimits.agentUpgrades).toBe(false);
      expect(PLANS_CONFIG.pro.machineLimits.agentUpgrades).toBe(true);
      expect(PLANS_CONFIG.max.machineLimits.agentUpgrades).toBe(true);
      expect(PLANS_CONFIG.enterprise.machineLimits.agentUpgrades).toBe(true);
    });

    it('validates pricing (Free is permanently $0)', () => {
      expect(PLANS_CONFIG.free.pricing.monthly).toBe(0);
      expect(PLANS_CONFIG.pro.pricing.monthly).toBe(30);
      expect(PLANS_CONFIG.max.pricing.monthly).toBe(45);
      expect(PLANS_CONFIG.enterprise.isCustomQuote).toBe(true);
      expect(PLANS_CONFIG.free.pricing.annual).toBe(0);
          });
  });

  describe('normalizePlanTier', () => {
    it('defaults undefined or invalid tiers to free', () => {
      expect(normalizePlanTier(undefined)).toBe('free');
      expect(normalizePlanTier(null)).toBe('free');
      expect(normalizePlanTier('UNKNOWN')).toBe('free');
    });

    it('maps legacy tier names to the new tiers', () => {
      expect(normalizePlanTier('STARTER')).toBe('free');
      expect(normalizePlanTier('Business')).toBe('max');
    });

    it('normalizes valid strings case-insensitively', () => {
      expect(normalizePlanTier('PRO')).toBe('pro');
      expect(normalizePlanTier('Max')).toBe('max');
      expect(normalizePlanTier('enterprise')).toBe('enterprise');
    });
  });

  describe('isPlanAtLeast', () => {
    it('evaluates hierarchy correctly', () => {
      expect(isPlanAtLeast('free', 'free')).toBe(true);
      expect(isPlanAtLeast('free', 'pro')).toBe(false);
      expect(isPlanAtLeast('pro', 'free')).toBe(true);
      expect(isPlanAtLeast('max', 'pro')).toBe(true);
      expect(isPlanAtLeast('enterprise', 'max')).toBe(true);
      expect(isPlanAtLeast('max', 'enterprise')).toBe(false);
    });
  });

  describe('Usage & Limit Calculations', () => {
    it('calculates isNearLimit correctly', () => {
      expect(isNearLimit(4, 5, 80)).toBe(true); // 80%
      expect(isNearLimit(3, 5, 80)).toBe(false); // 60%
      expect(isNearLimit(5, 5, 80)).toBe(false); // 100% is limit reached, not near
      expect(isNearLimit(100, -1)).toBe(false); // Unlimited is never near limit
    });

    it('calculates isLimitReached correctly', () => {
      expect(isLimitReached(5, 5)).toBe(true);
      expect(isLimitReached(6, 5)).toBe(true);
      expect(isLimitReached(4, 5)).toBe(false);
      expect(isLimitReached(1000, -1)).toBe(false);
    });

    it('calculates getUsagePercentage correctly', () => {
      expect(getUsagePercentage(4, 5)).toBe(80);
      expect(getUsagePercentage(10, 5)).toBe(100);
      expect(getUsagePercentage(0, 5)).toBe(0);
      expect(getUsagePercentage(50, -1)).toBe(0);
    });
  });
});
