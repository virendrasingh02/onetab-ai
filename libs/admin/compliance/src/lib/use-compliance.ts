import { complianceApi, queryKeys } from '@org/api-client';
import type {
  ComplianceChecklistStatus,
  ComplianceReviewStatus,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useComplianceOverview() {
  return useQuery({
    queryKey: queryKeys.compliance.overview(),
    queryFn: () => complianceApi.overview(),
    staleTime: 15_000,
  });
}

export function useCompliancePlatforms() {
  return useQuery({
    queryKey: queryKeys.compliance.platforms(),
    queryFn: () => complianceApi.platforms(),
    staleTime: 30_000,
  });
}

export function useComplianceRegions() {
  return useQuery({
    queryKey: queryKeys.compliance.regions(),
    queryFn: () => complianceApi.regions(),
    staleTime: 60_000,
  });
}

export function useComplianceCountries(regionId?: string) {
  return useQuery({
    queryKey: queryKeys.compliance.countries(regionId),
    queryFn: () => complianceApi.countries(regionId),
    staleTime: 60_000,
  });
}

export function useComplianceRequirements(filters?: {
  category?: string;
  severity?: string;
  platform?: string;
  country?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: queryKeys.compliance.requirements(filters),
    queryFn: () => complianceApi.requirements(filters),
    staleTime: 15_000,
  });
}

export function useCompliancePolicies() {
  return useQuery({
    queryKey: queryKeys.compliance.policies(),
    queryFn: () => complianceApi.policies(),
    staleTime: 60_000,
  });
}

export function useComplianceVersions(platformId?: string) {
  return useQuery({
    queryKey: queryKeys.compliance.versions(platformId),
    queryFn: () => complianceApi.versions(platformId),
    staleTime: 30_000,
  });
}

export function useComplianceReviews(filters?: {
  platformId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: queryKeys.compliance.reviews(filters),
    queryFn: () => complianceApi.reviews(filters),
    staleTime: 15_000,
  });
}

export function useComplianceReview(reviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.compliance.review(reviewId ?? ''),
    queryFn: () => complianceApi.getReview(reviewId as string),
    enabled: !!reviewId,
  });
}

export function useComplianceChecklist(reviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.compliance.checklist(reviewId ?? ''),
    queryFn: () => complianceApi.checklist(reviewId as string),
    enabled: !!reviewId,
  });
}

export function useComplianceIssues(filters?: {
  status?: string;
  severity?: string;
  platformId?: string;
  countryId?: string;
  q?: string;
}) {
  return useQuery({
    queryKey: queryKeys.compliance.issues(filters),
    queryFn: () => complianceApi.issues(filters),
    staleTime: 15_000,
  });
}

export function useComplianceLegalLinks() {
  return useQuery({
    queryKey: queryKeys.compliance.legalLinks(),
    queryFn: () => complianceApi.legalLinks(),
    staleTime: 30_000,
  });
}

export function useComplianceAuditLogs(
  page = 1,
  pageSize = 25,
  filters?: { action?: string; targetType?: string },
) {
  return useQuery({
    queryKey: queryKeys.compliance.auditLogs(page, filters),
    queryFn: () => complianceApi.auditLogs({ page, pageSize, ...filters }),
    staleTime: 15_000,
  });
}

// -----------------------------------------------------------------------------
// MUTATIONS
// -----------------------------------------------------------------------------

export function useComplianceMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all() });
  };

  const updateChecklistItem = useMutation({
    mutationFn: ({
      itemId,
      status,
      notes,
    }: {
      itemId: string;
      status: ComplianceChecklistStatus;
      notes?: string;
    }) => complianceApi.updateChecklistItem(itemId, { status, notes }),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Checklist item updated' },
  });

  const createIssue = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.createIssue>[0]) =>
      complianceApi.createIssue(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Rejection issue recorded' },
  });

  const updateIssue = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof complianceApi.updateIssue>[1];
    }) => complianceApi.updateIssue(id, data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Issue updated' },
  });

  const createRequirement = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.createRequirement>[0]) =>
      complianceApi.createRequirement(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Compliance requirement created' },
  });

  const updateRequirement = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof complianceApi.updateRequirement>[1];
    }) => complianceApi.updateRequirement(id, data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Requirement updated' },
  });

  const deleteRequirement = useMutation({
    mutationFn: (id: string) => complianceApi.deleteRequirement(id),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Requirement deleted' },
  });

  const createPlatform = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.createPlatform>[0]) =>
      complianceApi.createPlatform(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Platform registered' },
  });

  const updatePlatform = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof complianceApi.updatePlatform>[1];
    }) => complianceApi.updatePlatform(id, data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Platform updated' },
  });

  const createVersion = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.createVersion>[0]) =>
      complianceApi.createVersion(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Application version registered' },
  });

  const createReview = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.createReview>[0]) =>
      complianceApi.createReview(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Pre-submission review initiated' },
  });

  const overrideRelease = useMutation({
    mutationFn: ({
      reviewId,
      reason,
      newStatus,
    }: {
      reviewId: string;
      reason: string;
      newStatus: ComplianceReviewStatus;
    }) => complianceApi.overrideRelease(reviewId, { reason, newStatus }),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Release gate override recorded' },
  });

  const updateLegalLink = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.updateLegalLink>[0]) =>
      complianceApi.updateLegalLink(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Legal link saved' },
  });

  const addEvidence = useMutation({
    mutationFn: (data: Parameters<typeof complianceApi.addEvidence>[0]) =>
      complianceApi.addEvidence(data),
    onSuccess: invalidateAll,
    meta: { successMessage: 'Evidence document attached' },
  });

  return {
    updateChecklistItem,
    createIssue,
    updateIssue,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    createPlatform,
    updatePlatform,
    createVersion,
    createReview,
    overrideRelease,
    updateLegalLink,
    addEvidence,
  };
}
