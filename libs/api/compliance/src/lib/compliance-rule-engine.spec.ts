import { describe, expect, it } from 'vitest';
import {
  ComplianceRuleEngineService,
  compareVersions,
} from './compliance-rule-engine.service.js';

describe('ComplianceRuleEngineService', () => {
  const service = new ComplianceRuleEngineService();

  describe('SemVer version comparisons', () => {
    it('accurately compares standard SemVer versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.5', '1.0.10')).toBe(-1);
      expect(compareVersions('2.1.0', '2.0.99')).toBe(1);
      expect(compareVersions('v2.0.0', '1.9.9')).toBe(1);
    });
  });

  describe('Readiness Score Calculation', () => {
    it('returns 100% when all evaluable items pass', () => {
      const items: any[] = [
        { status: 'PASSED', effectiveSeverity: 'HIGH', isBlocking: false, requirement: { code: 'R1' } },
        { status: 'PASSED', effectiveSeverity: 'HIGH', isBlocking: false, requirement: { code: 'R2' } },
        { status: 'NOT_APPLICABLE', effectiveSeverity: 'LOW', isBlocking: false, requirement: { code: 'R3' } },
      ];
      const result = service.calculateReadinessScore(items);
      expect(result.overallScore).toBe(100);
      expect(result.passed).toBe(2);
      expect(result.notApplicable).toBe(1);
      expect(result.isReleaseBlocked).toBe(false);
    });

    it('blocks release when a critical or blocking item fails', () => {
      const items: any[] = [
        { status: 'PASSED', effectiveSeverity: 'HIGH', isBlocking: false, requirement: { code: 'R1', title: 'Terms' } },
        { status: 'FAILED', effectiveSeverity: 'CRITICAL', isBlocking: true, requirement: { code: 'R2', title: 'Account Deletion' } },
      ];
      const result = service.calculateReadinessScore(items);
      expect(result.overallScore).toBe(50);
      expect(result.isReleaseBlocked).toBe(true);
      expect(result.criticalIssues).toBe(1);
      expect(result.blockingReasons.length).toBeGreaterThan(0);
      expect(result.blockingReasons[0]).toContain('R2');
    });

    it('returns 100% when no evaluatable items exist', () => {
      const items: any[] = [
        { status: 'NOT_APPLICABLE', effectiveSeverity: 'LOW', isBlocking: false, requirement: { code: 'R1' } },
      ];
      const result = service.calculateReadinessScore(items);
      expect(result.overallScore).toBe(100);
      expect(result.isReleaseBlocked).toBe(false);
    });
  });

  describe('Deterministic Precedence: Country ≻ Regional ≻ Global', () => {
    const mockRequirements: any[] = [
      {
        id: 'req-global',
        code: 'PRIVACY_NOTICE_GLOBAL',
        title: 'Global Privacy Notice',
        category: 'PRIVACY',
        severity: 'HIGH',
        isBlocking: true,
        scopes: [], // Global scope
      },
      {
        id: 'req-eu-region',
        code: 'GDPR_COOKIE_CONSENT',
        title: 'EU GDPR Cookie & Telemetry Opt-In',
        category: 'PRIVACY',
        severity: 'CRITICAL',
        isBlocking: true,
        scopes: [
          {
            regionCode: 'EU',
          },
        ],
      },
      {
        id: 'req-india-dpdp',
        code: 'DPDP_GRIEVANCE_OFFICER',
        title: 'India DPDP Grievance Officer',
        category: 'REGIONAL_LEGAL',
        severity: 'CRITICAL',
        isBlocking: true,
        scopes: [
          {
            countryCode: 'IN',
          },
        ],
      },
      {
        id: 'req-apple-sandbox',
        code: 'APPLE_APP_SANDBOX',
        title: 'macOS App Sandbox Requirement',
        category: 'SECURITY',
        severity: 'CRITICAL',
        isBlocking: true,
        scopes: [
          {
            platformCode: 'macos',
            distributionCode: 'mac_app_store',
          },
        ],
      },
    ];

    it('includes global requirements for any context', () => {
      const result = service.evaluate(mockRequirements, {
        platform: 'windows',
        country: 'US',
      });

      const codes = result.applicableRequirements.map((r) => r.requirement.code);
      expect(codes).toContain('PRIVACY_NOTICE_GLOBAL');
      expect(codes).not.toContain('APPLE_APP_SANDBOX');
      expect(codes).not.toContain('DPDP_GRIEVANCE_OFFICER');
    });

    it('enforces country-specific statutory rules for India (DPDP Act)', () => {
      const result = service.evaluate(mockRequirements, {
        platform: 'macos',
        country: 'IN',
      });

      const codes = result.applicableRequirements.map((r) => r.requirement.code);
      expect(codes).toContain('DPDP_GRIEVANCE_OFFICER');
      expect(codes).toContain('PRIVACY_NOTICE_GLOBAL');
      expect(codes).not.toContain('GDPR_COOKIE_CONSENT');

      const indiaReq = result.applicableRequirements.find(
        (r) => r.requirement.code === 'DPDP_GRIEVANCE_OFFICER',
      );
      expect(indiaReq?.origin).toBe('COUNTRY');
    });

    it('enforces regional EU jurisdiction rules for Germany (DE)', () => {
      const result = service.evaluate(mockRequirements, {
        platform: 'web',
        region: 'EU',
        country: 'DE',
      });

      const codes = result.applicableRequirements.map((r) => r.requirement.code);
      expect(codes).toContain('GDPR_COOKIE_CONSENT');
      expect(codes).not.toContain('DPDP_GRIEVANCE_OFFICER');

      const euReq = result.applicableRequirements.find(
        (r) => r.requirement.code === 'GDPR_COOKIE_CONSENT',
      );
      expect(euReq?.origin).toBe('REGION');
    });

    it('isolates store-specific distribution rules (e.g. Mac App Store Sandbox)', () => {
      const macStoreResult = service.evaluate(mockRequirements, {
        platform: 'macos',
        distribution: 'mac_app_store',
      });
      const macCodes = macStoreResult.applicableRequirements.map((r) => r.requirement.code);
      expect(macCodes).toContain('APPLE_APP_SANDBOX');

      const directDmgResult = service.evaluate(mockRequirements, {
        platform: 'macos',
        distribution: 'direct_dmg',
      });
      const directCodes = directDmgResult.applicableRequirements.map((r) => r.requirement.code);
      expect(directCodes).not.toContain('APPLE_APP_SANDBOX');
    });
  });

  describe('Release Gate Evaluation via Rule Engine', () => {
    it('blocks release if any blocking requirement is failed', () => {
      const requirements: any[] = [
        {
          id: 'req-1',
          code: 'BLOCKING_REQ',
          title: 'Account Deletion Flow',
          isBlocking: true,
          severity: 'CRITICAL',
          scopes: [],
        },
      ];

      const statusMap = { 'req-1': 'FAILED' as const };
      const result = service.evaluate(
        requirements,
        { platform: 'macos' },
        statusMap,
      );

      expect(result.score.isReleaseBlocked).toBe(true);
      expect(result.score.blockingReasons.length).toBeGreaterThan(0);
      expect(result.score.blockingReasons[0]).toContain('BLOCKING_REQ');
    });

    it('approves release when all requirements pass', () => {
      const requirements: any[] = [
        {
          id: 'req-1',
          code: 'BLOCKING_REQ',
          title: 'Account Deletion Flow',
          isBlocking: true,
          severity: 'CRITICAL',
          scopes: [],
        },
      ];

      const statusMap = { 'req-1': 'PASSED' as const };
      const result = service.evaluate(
        requirements,
        { platform: 'macos' },
        statusMap,
      );

      expect(result.score.isReleaseBlocked).toBe(false);
      expect(result.score.overallScore).toBe(100);
      expect(result.score.blockingReasons.length).toBe(0);
    });
  });
});
