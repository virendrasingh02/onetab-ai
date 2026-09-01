import { describe, expect, it } from 'vitest';
import {
  canAccess,
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
    expect(PLANS_CONFIG.starter).toBeDefined();
    expect(PLANS_CONFIG.pro).toBeDefined();
    expect(PLANS_CONFIG.business).toBeDefined();
    expect(PLANS_CONFIG.enterprise).toBeDefined();
  });

  describe('hasFeature & canAccess', () => {
    it('grants basic features to starter plan', () => {
      expect(hasFeature('starter', 'core_workspace')).toBe(true);
      expect(hasFeature('starter', 'basic_views')).toBe(true);
      expect(hasFeature('starter', 'basic_projects')).toBe(true);
    });

    it('withholds advanced features from starter plan', () => {
      expect(hasFeature('starter', 'advanced_views')).toBe(false);
      expect(hasFeature('starter', 'advanced_ai')).toBe(false);
      expect(hasFeature('starter', 'sso_saml')).toBe(false);
      expect(hasFeature('starter', 'custom_llm')).toBe(false);
      expect(hasFeature('starter', 'audit_logs')).toBe(false);
    });

    it('grants pro features to pro plan', () => {
      expect(hasFeature('pro', 'advanced_views')).toBe(true);
      expect(hasFeature('pro', 'unlimited_projects')).toBe(true);
      expect(hasFeature('pro', 'agent_builder')).toBe(true);
      expect(hasFeature('pro', 'api_access')).toBe(true);
      expect(hasFeature('pro', 'sso_saml')).toBe(false);
      expect(hasFeature('pro', 'custom_llm')).toBe(false);
    });

    it('grants enterprise security and organization features to business plan', () => {
      expect(hasFeature('business', 'sso_saml')).toBe(true);
      expect(hasFeature('business', 'scim_provisioning')).toBe(true);
      expect(hasFeature('business', 'audit_logs')).toBe(true);
      expect(hasFeature('business', 'custom_roles')).toBe(true);
      expect(hasFeature('business', 'custom_llm')).toBe(false);
    });

    it('grants custom LLM and enterprise capabilities to enterprise plan', () => {
      expect(hasFeature('enterprise', 'custom_llm')).toBe(true);
      expect(hasFeature('enterprise', 'enterprise_ai_governance')).toBe(true);
      expect(hasFeature('enterprise', 'dedicated_infrastructure')).toBe(true);
      expect(hasFeature('enterprise', 'sso_saml')).toBe(true);
    });
  });

  describe('getPlanLimit', () => {
    it('returns member and storage limits per plan', () => {
      expect(getPlanLimit('starter', 'max_members')).toBe(5);
      expect(getPlanLimit('pro', 'max_members')).toBe(25);
      expect(getPlanLimit('business', 'max_members')).toBe(250);
      expect(getPlanLimit('enterprise', 'max_members')).toBe(-1); // Unlimited
    });

    it('returns AI request limits per plan', () => {
      expect(getPlanLimit('starter', 'monthly_ai_requests')).toBe(100);
      expect(getPlanLimit('pro', 'monthly_ai_requests')).toBe(10_000);
      expect(getPlanLimit('business', 'monthly_ai_requests')).toBe(50_000);
      expect(getPlanLimit('enterprise', 'monthly_ai_requests')).toBe(-1);
    });
  });

  describe('normalizePlanTier', () => {
    it('defaults undefined or invalid tiers to starter', () => {
      expect(normalizePlanTier(undefined)).toBe('starter');
      expect(normalizePlanTier(null)).toBe('starter');
      expect(normalizePlanTier('UNKNOWN')).toBe('starter');
    });

    it('normalizes valid strings case-insensitively', () => {
      expect(normalizePlanTier('PRO')).toBe('pro');
      expect(normalizePlanTier('Business')).toBe('business');
      expect(normalizePlanTier('enterprise')).toBe('enterprise');
    });
  });

  describe('isPlanAtLeast', () => {
    it('evaluates hierarchy correctly', () => {
      expect(isPlanAtLeast('starter', 'starter')).toBe(true);
      expect(isPlanAtLeast('starter', 'pro')).toBe(false);
      expect(isPlanAtLeast('pro', 'starter')).toBe(true);
      expect(isPlanAtLeast('business', 'pro')).toBe(true);
      expect(isPlanAtLeast('enterprise', 'business')).toBe(true);
      expect(isPlanAtLeast('business', 'enterprise')).toBe(false);
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
