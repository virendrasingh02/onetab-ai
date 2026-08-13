import { adminApi, enterpriseApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Enterprise governance data for the admin console.
 *
 * Two APIs meet here. `adminApi` lists the organisations on the platform and
 * owns departments — it is the operator's view across tenants — while
 * `enterpriseApi` reads and writes one organisation's identity configuration.
 * The screens want both, so the hooks sit together rather than being split by
 * which controller happens to serve them.
 */

/** Every organisation, with its departments and subscription folded in. */
export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.admin.organizations(),
    queryFn: () => adminApi.organizations(),
    staleTime: 30_000,
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => adminApi.overview(),
    staleTime: 30_000,
  });
}

/** One organisation in full, including its SSO bindings. */
export function useOrganization(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.enterprise.organization(organizationId ?? ''),
    queryFn: () => enterpriseApi.organization(organizationId as string),
    enabled: !!organizationId,
  });
}

export function useDepartmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all() });

  const create = useMutation({
    mutationFn: ({
      organizationId,
      name,
      code,
    }: {
      organizationId: string;
      name: string;
      code?: string;
    }) => adminApi.createDepartment(organizationId, { name, code }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: ({
      organizationId,
      departmentId,
    }: {
      organizationId: string;
      departmentId: string;
    }) => adminApi.deleteDepartment(organizationId, departmentId),
    onSuccess: invalidate,
  });

  return { create, remove };
}

export function useSSOMutations(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.enterprise.organization(organizationId ?? ''),
    });

  const save = useMutation({
    mutationFn: (input: {
      providerType: string;
      idpEntityId?: string;
      ssoUrl?: string;
      certificate?: string;
    }) => enterpriseApi.configureSSO(organizationId as string, input),
    onSuccess: invalidate,
  });

  const rotateScimToken = useMutation({
    mutationFn: () => enterpriseApi.rotateScimToken(organizationId as string),
    onSuccess: invalidate,
  });

  return { save, rotateScimToken };
}

/**
 * The audit trail.
 *
 * Read through `adminApi` rather than the per-organisation enterprise route so
 * that leaving the filter unset shows events across every tenant — which is the
 * console's default question — and so the list is paged.
 */
export function useAuditLogs(organizationId: string | undefined, page: number) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(organizationId ?? 'all', page),
    queryFn: () => adminApi.auditLogs({ organizationId, page, pageSize: 25 }),
    staleTime: 15_000,
  });
}
