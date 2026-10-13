import type { ConfigService } from '@nestjs/config';

/**
 * `live` = production billing; `test` = sandbox / local development.
 *
 * Explicit `BILLING_MODE` wins. Otherwise production deployments default to
 * `live`, so test-only promotion rules cannot become active by omission.
 */
export function resolveBillingMode(config: Pick<ConfigService, 'get'>): 'test' | 'live' {
  const explicit = (config.get<string>('BILLING_MODE') ?? '').trim().toLowerCase();
  if (explicit === 'live' || explicit === 'test') return explicit;
  return (config.get<string>('NODE_ENV') ?? process.env['NODE_ENV']) === 'production' ? 'live' : 'test';
}

/** Tax rate (percent) used when no provider-side tax engine is configured. */
export function resolveTaxRatePercent(config: Pick<ConfigService, 'get'>): number {
  const raw = Number(config.get<string>('BILLING_TAX_RATE_PERCENT') ?? 0);
  return Number.isFinite(raw) && raw > 0 && raw < 100 ? raw : 0;
}
