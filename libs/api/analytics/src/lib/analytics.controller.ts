import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SystemRoleGuard, WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, Public, SystemRoles } from '@org/api-common';
import { SystemRole } from '@org/types';
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
  //
  // Operator surface. These describe the API process rather than any one
  // workspace, and the error report in particular carries messages and paths
  // from every tenant — so they are gated on the platform role, not merely on
  // being signed in.

  /** Public so container orchestrators and uptime probes can read it. */
  @Get('health')
  @Public()
  getHealth() {
    return this.health.getHealth();
  }

  @Get('performance')
  @UseGuards(SystemRoleGuard)
  @SystemRoles(SystemRole.SUPERADMIN)
  getPerformance() {
    return this.metrics.getPerformanceMetrics();
  }

  @Get('errors')
  @UseGuards(SystemRoleGuard)
  @SystemRoles(SystemRole.SUPERADMIN)
  getPlatformErrors(@Query('hours') hours?: string) {
    return this.errors.getReport(null, normaliseHours(hours));
  }

  @Delete('errors')
  @UseGuards(SystemRoleGuard)
  @SystemRoles(SystemRole.SUPERADMIN)
  clearPlatformErrors() {
    return this.errors.clearBuffer();
  }

  // --- workspace-scoped ----------------------------------------------------

  @Get('workspace/:workspaceId/dashboard')
  @UseGuards(WorkspaceRoleGuard)
  getDashboard(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getDashboard(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId')
  @UseGuards(WorkspaceRoleGuard)
  getWorkspaceAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getWorkspaceAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/users')
  @UseGuards(WorkspaceRoleGuard)
  getUserAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getUserAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/activity')
  @UseGuards(WorkspaceRoleGuard)
  getUserActivity(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getUserActivity(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-usage')
  @UseGuards(WorkspaceRoleGuard)
  getAIUsage(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getAIUsageStats(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-deep')
  @UseGuards(WorkspaceRoleGuard)
  getDeepAIOverview(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getDeepAIOverview(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-agents')
  @UseGuards(WorkspaceRoleGuard)
  getAgentAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getAgentAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-agents/:agentId')
  @UseGuards(WorkspaceRoleGuard)
  getSingleAgentAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Param('agentId') agentId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getAgentAnalytics(workspaceId, { days, from, to }, agentId);
  }

  @Get('workspace/:workspaceId/ai-workflows')
  @UseGuards(WorkspaceRoleGuard)
  getWorkflowAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getWorkflowAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-workflows/:workflowId')
  @UseGuards(WorkspaceRoleGuard)
  getSingleWorkflowAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getWorkflowAnalytics(workspaceId, { days, from, to }, workflowId);
  }

  @Get('workspace/:workspaceId/ai-nodes')
  @UseGuards(WorkspaceRoleGuard)
  getNodeAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getNodeAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-tools')
  @UseGuards(WorkspaceRoleGuard)
  getToolConnectorAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getToolConnectorAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-models')
  @UseGuards(WorkspaceRoleGuard)
  getModelAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getModelAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-costs')
  @UseGuards(WorkspaceRoleGuard)
  getCostAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getCostAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-errors')
  @UseGuards(WorkspaceRoleGuard)
  getErrorAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getErrorAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-traces/:executionId')
  @UseGuards(WorkspaceRoleGuard)
  getExecutionTraces(
    @Param('workspaceId') workspaceId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.analytics.getExecutionTraces(workspaceId, executionId);
  }

  @Get('workspace/:workspaceId/ai-evaluations')
  @UseGuards(WorkspaceRoleGuard)
  getEvaluationsAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getEvaluationsAnalytics(workspaceId, { days, from, to });
  }

  @Get('workspace/:workspaceId/ai-versions/compare')
  @UseGuards(WorkspaceRoleGuard)
  compareVersions(
    @Param('workspaceId') workspaceId: string,
    @Query('entityType') entityType: 'AGENT' | 'WORKFLOW',
    @Query('entityId') entityId: string,
    @Query('versionA') versionA?: string,
    @Query('versionB') versionB?: string,
  ) {
    return this.analytics.compareVersions(
      workspaceId,
      entityType,
      entityId,
      versionA ? parseInt(versionA, 10) : 1,
      versionB ? parseInt(versionB, 10) : 2,
    );
  }

  @Get('workspace/:workspaceId/ai-alerts')
  @UseGuards(WorkspaceRoleGuard)
  getAlerts(@Param('workspaceId') workspaceId: string) {
    return this.analytics.getAlerts(workspaceId);
  }

  @Post('workspace/:workspaceId/ai-alerts')
  @UseGuards(WorkspaceRoleGuard)
  createAlertRule(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.analytics.createAlertRule(workspaceId, body);
  }

  @Patch('workspace/:workspaceId/ai-alerts/:alertId')
  @UseGuards(WorkspaceRoleGuard)
  updateAlertStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('alertId') alertId: string,
    @Body() body: { status: 'RESOLVED' | 'ACKNOWLEDGED' },
  ) {
    return this.analytics.updateAlertStatus(workspaceId, alertId, body.status);
  }

  @Get('workspace/:workspaceId/ai-settings')
  @UseGuards(WorkspaceRoleGuard)
  getAnalyticsSettings(@Param('workspaceId') workspaceId: string) {
    return this.analytics.getAnalyticsSettings(workspaceId);
  }

  @Put('workspace/:workspaceId/ai-settings')
  @UseGuards(WorkspaceRoleGuard)
  updateAnalyticsSettings(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.analytics.updateAnalyticsSettings(workspaceId, body);
  }

  @Get('workspace/:workspaceId/storage')
  @UseGuards(WorkspaceRoleGuard)
  getStorageAnalytics(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getStorageAnalytics(workspaceId, { days, from, to });
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
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const report = await this.reports.generate(workspaceId, type, {
      days,
      from,
      to,
    });

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
