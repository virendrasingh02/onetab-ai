import {
  HttpException,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorTrackingService } from './error-tracking.service.js';
import { MetricsService } from './metrics.service.js';

interface TelemetryRequest {
  method?: string;
  route?: { path?: string };
  originalUrl?: string;
  url?: string;
  params?: Record<string, string>;
  user?: { id?: string };
  workspaceId?: string;
}

/**
 * Feeds the performance and error dashboards from real traffic.
 *
 * Registered as a global interceptor rather than an exception filter so it
 * composes with `HttpExceptionFilter`: an interceptor observes the failure and
 * re-throws it, leaving the single global filter in charge of the response
 * body. Two global filters would fight over that.
 *
 * Consequence of that placement: guards run before interceptors, so rejected
 * authentication and membership checks never reach here. That is the intent —
 * a 401 or a non-member 404 is the system working, not an error to triage.
 */
@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly errors: ErrorTrackingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<TelemetryRequest>();
    const started = Date.now();

    // The route *pattern* ("/api/v1/workspaces/:workspaceId"), never the
    // concrete URL — grouping by URL would produce one row per workspace.
    const route =
      request.route?.path ?? this.stripQuery(request.originalUrl ?? request.url);
    const method = request.method ?? 'GET';

    return next.handle().pipe(
      tap(() => {
        this.metrics.record({
          route,
          method,
          statusCode: http.getResponse<{ statusCode?: number }>()?.statusCode ?? 200,
          durationMs: Date.now() - started,
          at: started,
        });
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;

        this.metrics.record({
          route,
          method,
          statusCode,
          durationMs: Date.now() - started,
          at: started,
        });

        this.errors.capture(error, {
          route,
          method,
          statusCode,
          userId: request.user?.id ?? null,
          workspaceId:
            request.workspaceId ?? request.params?.['workspaceId'] ?? null,
        });

        return throwError(() => error);
      }),
    );
  }

  private stripQuery(url: string | undefined): string {
    if (!url) return 'unknown';
    const index = url.indexOf('?');
    return index === -1 ? url : url.slice(0, index);
  }
}
