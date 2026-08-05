export { AnalyticsModule } from './lib/analytics.module.js';
export { AnalyticsService } from './lib/analytics.service.js';
export { AnalyticsController } from './lib/analytics.controller.js';
export { MetricsService } from './lib/metrics.service.js';
export { HealthService } from './lib/health.service.js';
export { ReportsService } from './lib/reports.service.js';
export {
  ErrorTrackingService,
  ERROR_EVENT_TYPE,
  type ErrorContext,
} from './lib/error-tracking.service.js';
export { TelemetryInterceptor } from './lib/telemetry.interceptor.js';
export {
  dayKey,
  normaliseDays,
  normaliseHours,
  startOfRange,
  toBreakdown,
  toDailySeries,
  toTrend,
} from './lib/analytics.util.js';
