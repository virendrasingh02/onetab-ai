import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, Public } from '@org/api-common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service.js';
import { normaliseHours } from './analytics.util.js';
import { ErrorTrackingService } from './error-tracking.service.js';
import { HealthService } from './health.service.js';
import { MetricsService } from './metrics.service.js';
import { ReportsService } from './reports.service.js';

/**
 * Phase 11 — Analytics & Administration.
 *
 * Workspace-scoped routes sit behind `WorkspaceRoleGuard`, which resolves the
 * `:workspaceId` param and rejects non-members, so no handler here has to
 * re-check that the caller may read the workspace's numbers.
 */
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly metrics: MetricsService,
    private readonly errors: ErrorTrackingService,
    private readonly reports: ReportsService,
    private readonly health: HealthService,
  ) {}

  // --- platform-wide -------------------------------------------------------

  /** Public so container orchestrators and uptime probes can read it. */
  @Get('health')
  @Public()
  getHealth() {
    return this.health.getHealth();
  }

  @Get('performance')
  getPerformance() {
    return this.metrics.getPerformanceMetrics();
  }

  @Get('errors')
  getPlatformErrors(@Query('hours') hours?: string) {
    return this.errors.getReport(null, normaliseHours(hours));
  }

  @Delete('errors')
  clearPlatformErrors() {
    return this.errors.clearBuffer();
  }

  // --- workspace-scoped ----------------------------------------------------

  @Get('workspace/:workspaceId/dashboard')
  @UseGuards(WorkspaceRoleGuard)
  getDashboard(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getDashboard(workspaceId, days);
  }

  @Get('workspace/:workspaceId')
  @UseGuards(WorkspaceRoleGuard)
  getWorkspaceAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getWorkspaceAnalytics(workspaceId, days);
  }

  @Get('workspace/:workspaceId/users')
  @UseGuards(WorkspaceRoleGuard)
  getUserAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getUserAnalytics(workspaceId, days);
  }

  @Get('workspace/:workspaceId/activity')
  @UseGuards(WorkspaceRoleGuard)
  getUserActivity(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getUserActivity(workspaceId, days);
  }

  @Get('workspace/:workspaceId/ai-usage')
  @UseGuards(WorkspaceRoleGuard)
  getAIUsage(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getAIUsageStats(workspaceId, days);
  }

  @Get('workspace/:workspaceId/storage')
  @UseGuards(WorkspaceRoleGuard)
  getStorageAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getStorageAnalytics(workspaceId, days);
  }

  @Get('workspace/:workspaceId/errors')
  @UseGuards(WorkspaceRoleGuard)
  getWorkspaceErrors(
    @Param('workspaceId') workspaceId: string,
    @Query('hours') hours?: string,
  ) {
    return this.errors.getReport(workspaceId, normaliseHours(hours));
  }

  // --- reports -------------------------------------------------------------

  @Get('workspace/:workspaceId/reports')
  @UseGuards(WorkspaceRoleGuard)
  listReports() {
    return this.reports.listDefinitions();
  }

  /**
   * `?format=csv` streams a download; anything else returns the same report as
   * JSON so the UI can render it in a table before the user exports it.
   */
  @Get('workspace/:workspaceId/reports/:type')
  @UseGuards(WorkspaceRoleGuard)
  async generateReport(
    @Param('workspaceId') workspaceId: string,
    @Param('type') type: string,
    @Res({ passthrough: true }) response: Response,
    @Query('days') days?: string,
    @Query('format') format?: string,
  ) {
    const report = await this.reports.generate(workspaceId, type, days);

    if (format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${this.reports.filenameFor(report, 'csv')}"`,
      );
      return this.reports.toCsv(report);
    }

    return report;
  }

  // --- ingestion -----------------------------------------------------------

  @Post('workspace/:workspaceId/events')
  @UseGuards(WorkspaceRoleGuard)
  trackEvent(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { eventType: string; metadata?: Record<string, unknown> },
  ) {
    return this.analytics.trackEvent(
      workspaceId,
      userId,
      body.eventType,
      body.metadata,
    );
  }
}
