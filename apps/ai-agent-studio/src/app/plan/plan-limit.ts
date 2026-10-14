/**
 * Recognises the server's plan/credit refusals so the Studio can explain them
 * (and offer an upgrade) instead of showing a bare error string.
 */
export type PlanLimitKind = 'plan' | 'credits' | 'trial' | 'execution';

export interface PlanLimitInfo {
  kind: PlanLimitKind;
  message: string;
  /** Present for PLAN_LIMIT_REACHED: how many are allowed / in use. */
  limit?: number;
  used?: number;
  resource?: string;
}

const KIND_BY_CODE: Record<string, PlanLimitKind> = {
  PLAN_LIMIT_REACHED: 'plan',
  CREDIT_LIMIT_REACHED: 'credits',
  TRIAL_EXPIRED: 'trial',
  EXECUTION_LIMIT_REACHED: 'execution',
};

/** Returns details when `err` is a plan/credit refusal, otherwise null. */
export function readPlanLimit(err: unknown): PlanLimitInfo | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as {
    code?: unknown;
    message?: unknown;
    response?: { data?: { code?: unknown; message?: unknown; limit?: unknown; used?: unknown; resource?: unknown } };
  };
  const data = e.response?.data;
  const code = String(data?.code ?? e.code ?? '');
  const kind = KIND_BY_CODE[code];
  if (!kind) return null;
  const message = typeof data?.message === 'string' ? data.message : typeof e.message === 'string' ? e.message : 'Plan limit reached.';
  return {
    kind,
    message,
    limit: typeof data?.limit === 'number' ? data.limit : undefined,
    used: typeof data?.used === 'number' ? data.used : undefined,
    resource: typeof data?.resource === 'string' ? data.resource : undefined,
  };
}
