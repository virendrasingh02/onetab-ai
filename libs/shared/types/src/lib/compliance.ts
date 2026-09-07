/**
 * Compliance & App Store Management Types
 */

export type CompliancePlatformType = 'WEB' | 'DESKTOP' | 'MOBILE';

export type ComplianceSeverity =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INFORMATIONAL';

export type ComplianceCategory =
  | 'PRIVACY'
  | 'DATA_COLLECTION'
  | 'USER_CONSENT'
  | 'ACCOUNT_DELETION'
  | 'AUTHENTICATION'
  | 'PAYMENTS'
  | 'CONTENT_MODERATION'
  | 'SECURITY'
  | 'PERMISSIONS'
  | 'NOTIFICATIONS'
  | 'TRACKING_ADVERTISING'
  | 'AGE_RATING'
  | 'METADATA_ASSETS'
  | 'LEGAL_TERMS'
  | 'REGIONAL_LEGAL'
  | 'EXPORT_COMPLIANCE';

export type ComplianceChecklistStatus =
  | 'PASSED'
  | 'FAILED'
  | 'WARNING'
  | 'SKIPPED'
  | 'NOT_APPLICABLE';

export type ComplianceReviewStatus =
  | 'IN_PROGRESS'
  | 'READY_FOR_SUBMISSION'
  | 'BLOCKED'
  | 'APPROVED'
  | 'RELEASED';

export type ComplianceIssueStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'FIX_REQUIRED'
  | 'IN_PROGRESS'
  | 'READY_FOR_RESUBMISSION'
  | 'SUBMITTED'
  | 'RESOLVED'
  | 'ACCEPTED'
  | 'WONT_FIX';

export type ComplianceIssueSource =
  | 'STORE_REVIEW'
  | 'INTERNAL_AUDIT'
  | 'AUTOMATED_SCAN'
  | 'REGULATORY_NOTICE';

export type CompliancePolicyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'DEPRECATED';

export interface ComplianceReadinessScore {
  overallScore: number; // 0 - 100 percentage
  passed: number;
  failed: number;
  warning: number;
  skipped: number;
  notApplicable: number;
  total: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  isReleaseBlocked: boolean;
  blockingReasons: string[];
}

export interface ComplianceOverview {
  overallScore: number;
  overallStatus: ComplianceChecklistStatus;
  webReadiness: number;
  desktopReadiness: number;
  storeReadiness: {
    microsoftStore: number;
    macAppStore: number;
    directWindows: number;
    directMac: number;
    web: number;
  };
  openIssuesCount: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
  };
  countriesRequiringAttention: {
    code: string;
    name: string;
    criticalCount: number;
    warningCount: number;
    status: ComplianceChecklistStatus;
  }[];
  currentVersions: {
    platform: string;
    platformName: string;
    currentVersion: string;
    status: ComplianceReviewStatus;
    readinessScore: number;
  }[];
  upcomingDeadlines: {
    id: string;
    title: string;
    target: string;
    date: string;
    severity: ComplianceSeverity;
  }[];
  lastReviewDate?: string | null;
  lastUpdated: string;
}

export interface CompliancePlatformView {
  id: string;
  code: string;
  name: string;
  type: CompliancePlatformType;
  currentVersion: string;
  minSupportedVersion: string;
  isActive: boolean;
  distributions: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }[];
  complianceStatus: ComplianceChecklistStatus;
  releaseStatus: ComplianceReviewStatus;
  readinessScore: number;
  activeRequirementCount: number;
  lastReview?: string | null;
}

export interface ComplianceRegionView {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  countriesCount: number;
}

export interface ComplianceCountryView {
  id: string;
  code: string;
  name: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  applicableRequirementsCount: number;
  countrySpecificRequirementsCount: number;
  openIssuesCount: number;
  status: ComplianceChecklistStatus;
}

export interface ComplianceRequirementScopeView {
  id: string;
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  regionId?: string | null;
  regionCode?: string | null;
  platformId?: string | null;
  platformCode?: string | null;
  distributionId?: string | null;
  distributionCode?: string | null;
  minVersion?: string | null;
  maxVersion?: string | null;
  isExcluded: boolean;
  overrideSeverity?: ComplianceSeverity | null;
  overrideNotes?: string | null;
}

export interface ComplianceRequirementView {
  id: string;
  code: string;
  title: string;
  description: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  isBlocking: boolean;
  defaultStatus: ComplianceChecklistStatus;
  remediationGuide?: string | null;
  externalUrl?: string | null;
  policyId?: string | null;
  policyCode?: string | null;
  policyName?: string | null;
  scopes: ComplianceRequirementScopeView[];
  openIssuesCount?: number;
  effectiveScopeSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompliancePolicyView {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  version: string;
  effectiveDate: string;
  reviewDate?: string | null;
  status: CompliancePolicyStatus;
  externalGuidelineRef?: string | null;
  externalGuidelineUrl?: string | null;
  requirementsCount: number;
  createdAt: string;
}

export interface ComplianceAppVersionView {
  id: string;
  platformId: string;
  platformCode: string;
  platformName: string;
  version: string;
  releaseDate?: string | null;
  status: ComplianceReviewStatus;
  isCurrent: boolean;
  changelog?: string | null;
  metadata?: Record<string, unknown>;
  readinessScore: number;
  openIssuesCount: number;
  createdAt: string;
}

export interface ComplianceEvidenceView {
  id: string;
  title: string;
  type: string;
  url: string;
  description?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
}

export interface ComplianceChecklistItemView {
  id: string;
  reviewId: string;
  requirementId: string;
  requirement: {
    id: string;
    code: string;
    title: string;
    description: string;
    category: ComplianceCategory;
    severity: ComplianceSeverity;
    isBlocking: boolean;
    remediationGuide?: string | null;
    externalUrl?: string | null;
  };
  status: ComplianceChecklistStatus;
  notes?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  verifiedByName?: string | null;
  evidence: ComplianceEvidenceView[];
}

export interface ComplianceReviewView {
  id: string;
  appVersionId: string;
  appVersion: {
    id: string;
    version: string;
    isCurrent: boolean;
  };
  platformId: string;
  platformCode: string;
  platformName: string;
  distributionId?: string | null;
  distributionCode?: string | null;
  distributionName?: string | null;
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  status: ComplianceReviewStatus;
  overallScore: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  blockedCount: number;
  totalCount: number;
  summary?: string | null;
  reviewerNotes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  createdAt: string;
}

export interface ComplianceIssueView {
  id: string;
  title: string;
  description: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  status: ComplianceIssueStatus;
  source: ComplianceIssueSource;
  reviewerNotes?: string | null;
  remediation?: string | null;
  resolution?: string | null;
  appVersionId?: string | null;
  appVersionString?: string | null;
  platformId?: string | null;
  platformCode?: string | null;
  countryId?: string | null;
  countryCode?: string | null;
  requirementId?: string | null;
  requirementCode?: string | null;
  reportedAt: string;
  resolvedAt?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  evidence: ComplianceEvidenceView[];
}

export interface ComplianceReleaseOverrideView {
  id: string;
  reviewId: string;
  adminId: string;
  adminEmail: string;
  reason: string;
  previousStatus: ComplianceReviewStatus;
  newStatus: ComplianceReviewStatus;
  overriddenIssues: string[];
  createdAt: string;
}

export interface ComplianceAuditLogView {
  id: string;
  actorId?: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  platform?: string | null;
  country?: string | null;
  version?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface ComplianceLegalLinkView {
  id: string;
  key: string;
  title: string;
  url: string;
  contentMarkdown?: string | null;
  countryCode?: string | null;
  platformCode?: string | null;
  lastVerifiedAt: string;
}

export interface ComplianceEvaluationContext {
  platform: string; // 'web' | 'windows' | 'macos' | 'linux'
  distribution?: string; // 'web' | 'direct' | 'microsoft-store' | 'mac-app-store'
  country?: string; // e.g. 'IN', 'US', 'DE'
  region?: string; // e.g. 'GLOBAL', 'APAC', 'EU'
  version?: string; // e.g. '2.5.0'
}

export interface ComplianceEvaluationResult {
  context: ComplianceEvaluationContext;
  score: ComplianceReadinessScore;
  applicableRequirements: {
    requirement: ComplianceRequirementView;
    origin: 'COUNTRY' | 'REGION' | 'GLOBAL' | 'PLATFORM' | 'DISTRIBUTION';
    effectiveSeverity: ComplianceSeverity;
    status: ComplianceChecklistStatus;
    notes?: string;
  }[];
  rejectionRisks: {
    title: string;
    reason: string;
    guidelineRef?: string;
    severity: ComplianceSeverity;
  }[];
}
