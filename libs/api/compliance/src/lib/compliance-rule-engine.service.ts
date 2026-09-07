import { Injectable } from '@nestjs/common';
import type {
  ComplianceChecklistStatus,
  ComplianceEvaluationContext,
  ComplianceEvaluationResult,
  ComplianceReadinessScore,
  ComplianceRequirementView,
  ComplianceSeverity,
} from '@org/types';

export interface EvaluatedRequirementItem {
  requirement: ComplianceRequirementView;
  origin: 'COUNTRY' | 'REGION' | 'GLOBAL' | 'PLATFORM' | 'DISTRIBUTION';
  effectiveSeverity: ComplianceSeverity;
  status: ComplianceChecklistStatus;
  isBlocking: boolean;
  notes?: string;
}

/**
 * Semver comparison helper. Returns:
 * -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const cleanA = a.replace(/^v/, '');
  const cleanB = b.replace(/^v/, '');
  const partsA = cleanA.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = cleanB.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA < valB) return -1;
    if (valA > valB) return 1;
  }
  return 0;
}

@Injectable()
export class ComplianceRuleEngineService {
  /**
   * Evaluates requirements against a given target context (platform, distribution, country, version).
   * Applies the hierarchy: Country Rules > Regional Rules > Global Rules,
   * while filtering on platform and distribution scopes.
   */
  evaluate(
    allRequirements: ComplianceRequirementView[],
    context: ComplianceEvaluationContext,
    checklistStatusMap: Record<string, ComplianceChecklistStatus> = {},
  ): ComplianceEvaluationResult {
    const targetPlatform = context.platform?.toLowerCase();
    const targetDistribution = context.distribution?.toLowerCase();
    const targetCountry = context.country?.toUpperCase();
    const targetRegion = context.region?.toUpperCase();
    const targetVersion = context.version;

    const applicableList: EvaluatedRequirementItem[] = [];
    const rejectionRisks: {
      title: string;
      reason: string;
      guidelineRef?: string;
      severity: ComplianceSeverity;
    }[] = [];

    for (const req of allRequirements) {
      // Check if requirement has scopes
      const scopes = req.scopes ?? [];

      // If no scopes are defined, this is a GLOBAL requirement applicable everywhere
      if (scopes.length === 0) {
        const status = checklistStatusMap[req.id] ?? req.defaultStatus ?? 'WARNING';
        applicableList.push({
          requirement: req,
          origin: 'GLOBAL',
          effectiveSeverity: req.severity,
          status,
          isBlocking: req.isBlocking,
        });
        continue;
      }

      // Check if requirement applies to the context by inspecting scopes with precedence:
      // 1. Country specific scope
      // 2. Regional scope
      // 3. Platform / Distribution scope
      // 4. Global scope (no country/region/platform restrictions)

      let matchedScope = null;
      let origin: 'COUNTRY' | 'REGION' | 'GLOBAL' | 'PLATFORM' | 'DISTRIBUTION' = 'GLOBAL';

      // Find scopes that match platform (if specified on scope)
      const platformMatchingScopes = scopes.filter((scope) => {
        if (!scope.platformCode) return true;
        return scope.platformCode.toLowerCase() === targetPlatform;
      });

      // Find scopes that also match distribution (if specified on scope)
      const distributionMatchingScopes = platformMatchingScopes.filter((scope) => {
        if (!scope.distributionCode) return true;
        return (
          targetDistribution &&
          scope.distributionCode.toLowerCase() === targetDistribution
        );
      });

      // Check version bounds if version specified
      const versionMatchingScopes = distributionMatchingScopes.filter((scope) => {
        if (!targetVersion) return true;
        if (scope.minVersion && compareVersions(targetVersion, scope.minVersion) < 0) {
          return false;
        }
        if (scope.maxVersion && compareVersions(targetVersion, scope.maxVersion) > 0) {
          return false;
        }
        return true;
      });

      if (versionMatchingScopes.length === 0) {
        // Did not match platform/distribution/version constraints
        continue;
      }

      // 1. Check for country-level match (Highest Precedence)
      const countryScope = targetCountry
        ? versionMatchingScopes.find(
            (s) => s.countryCode && s.countryCode.toUpperCase() === targetCountry,
          )
        : null;

      if (countryScope) {
        if (countryScope.isExcluded) {
          // Explicitly excluded for this country
          continue;
        }
        matchedScope = countryScope;
        origin = 'COUNTRY';
      } else {
        // 2. Check for regional match
        const regionScope = targetRegion
          ? versionMatchingScopes.find(
              (s) => s.regionCode && s.regionCode.toUpperCase() === targetRegion,
            )
          : null;

        if (regionScope) {
          if (regionScope.isExcluded) {
            continue;
          }
          matchedScope = regionScope;
          origin = 'REGION';
        } else {
          // 3. Check for platform/distribution-specific or global scope
          const genericScope = versionMatchingScopes.find(
            (s) => !s.countryCode && !s.regionCode,
          );

          if (genericScope) {
            if (genericScope.isExcluded) {
              continue;
            }
            matchedScope = genericScope;
            if (genericScope.distributionCode) {
              origin = 'DISTRIBUTION';
            } else if (genericScope.platformCode) {
              origin = 'PLATFORM';
            } else {
              origin = 'GLOBAL';
            }
          }
        }
      }

      if (!matchedScope) {
        // If scopes exist for other countries/platforms, but none matched our context, it doesn't apply
        continue;
      }

      const effectiveSeverity =
        matchedScope.overrideSeverity ?? req.severity;
      const status = checklistStatusMap[req.id] ?? req.defaultStatus ?? 'WARNING';

      applicableList.push({
        requirement: req,
        origin,
        effectiveSeverity,
        status,
        isBlocking: req.isBlocking || effectiveSeverity === 'CRITICAL',
        notes: matchedScope.overrideNotes ?? undefined,
      });

      // Record rejection risk if critical or high and not passed
      if (
        (effectiveSeverity === 'CRITICAL' || effectiveSeverity === 'HIGH') &&
        status !== 'PASSED' &&
        status !== 'NOT_APPLICABLE'
      ) {
        rejectionRisks.push({
          title: req.title,
          reason:
            status === 'FAILED'
              ? `Failed compliance verification (${req.code})`
              : `Pending verification before submission (${req.code})`,
          guidelineRef: req.policyCode ?? undefined,
          severity: effectiveSeverity,
        });
      }
    }

    const score = this.calculateReadinessScore(applicableList);

    return {
      context,
      score,
      applicableRequirements: applicableList,
      rejectionRisks,
    };
  }

  /**
   * Calculates readiness score and breakdown from an evaluated requirement list.
   */
  calculateReadinessScore(
    items: EvaluatedRequirementItem[],
  ): ComplianceReadinessScore {
    let passed = 0;
    let failed = 0;
    let warning = 0;
    let skipped = 0;
    let notApplicable = 0;
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;
    let lowIssues = 0;
    const blockingReasons: string[] = [];

    for (const item of items) {
      switch (item.status) {
        case 'PASSED':
          passed++;
          break;
        case 'FAILED':
          failed++;
          if (item.effectiveSeverity === 'CRITICAL') criticalIssues++;
          else if (item.effectiveSeverity === 'HIGH') highIssues++;
          else if (item.effectiveSeverity === 'MEDIUM') mediumIssues++;
          else lowIssues++;

          if (item.isBlocking || item.effectiveSeverity === 'CRITICAL') {
            blockingReasons.push(
              `[BLOCKING] ${item.requirement.code}: ${item.requirement.title}`,
            );
          }
          break;
        case 'WARNING':
          warning++;
          if (item.effectiveSeverity === 'CRITICAL') {
            criticalIssues++;
            blockingReasons.push(
              `[ACTION REQUIRED] Critical requirement unverified: ${item.requirement.code}`,
            );
          } else if (item.effectiveSeverity === 'HIGH') {
            highIssues++;
          } else if (item.effectiveSeverity === 'MEDIUM') {
            mediumIssues++;
          } else {
            lowIssues++;
          }
          break;
        case 'SKIPPED':
          skipped++;
          break;
        case 'NOT_APPLICABLE':
          notApplicable++;
          break;
      }
    }

    const evaluableTotal = items.length - notApplicable;
    const overallScore =
      evaluableTotal <= 0
        ? 100
        : Math.round((passed / evaluableTotal) * 100);

    const isReleaseBlocked = blockingReasons.length > 0 || failed > 0;

    return {
      overallScore,
      passed,
      failed,
      warning,
      skipped,
      notApplicable,
      total: items.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      isReleaseBlocked,
      blockingReasons,
    };
  }
}
