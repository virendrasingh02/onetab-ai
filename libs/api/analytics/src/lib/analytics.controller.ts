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
import { CurrentUser, RequireWorkspacePermissions, SystemRoles } from '@org/api-common';
import { SystemRole, WorkspacePermission } from '@org/types';
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

  /** Probes use `/health`; this one fans out to every dependency, so it is operator-only. */
  @Get('health')
  @UseGuards(SystemRoleGuard)
  @SystemRoles(SystemRole.SUPERADMIN, SystemRole.SUPPORT)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  getExecutionTraces(
    @Param('workspaceId') workspaceId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.analytics.getExecutionTraces(workspaceId, executionId);
  }

  @Get('workspace/:workspaceId/ai-evaluations')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  getAlerts(@Param('workspaceId') workspaceId: string) {
    return this.analytics.getAlerts(workspaceId);
  }

  @Post('workspace/:workspaceId/ai-alerts')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  createAlertRule(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.analytics.createAlertRule(workspaceId, body);
  }

  @Patch('workspace/:workspaceId/ai-alerts/:alertId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateAlertStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('alertId') alertId: string,
    @Body() body: { status: 'RESOLVED' | 'ACKNOWLEDGED' },
  ) {
    return this.analytics.updateAlertStatus(workspaceId, alertId, body.status);
  }

  @Get('workspace/:workspaceId/ai-settings')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  getAnalyticsSettings(@Param('workspaceId') workspaceId: string) {
    return this.analytics.getAnalyticsSettings(workspaceId);
  }

  @Put('workspace/:workspaceId/ai-settings')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateAnalyticsSettings(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.analytics.updateAnalyticsSettings(workspaceId, body);
  }

  @Get('workspace/:workspaceId/storage')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  getWorkspaceErrors(
    @Param('workspaceId') workspaceId: string,
    @Query('hours') hours?: string,
  ) {
    return this.errors.getReport(workspaceId, normaliseHours(hours));
  }

  // --- reports -------------------------------------------------------------

  @Get('workspace/:workspaceId/reports')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  listReports() {
    return this.reports.listDefinitions();
  }

  /**
   * `?format=csv` streams a download; anything else returns the same report as
   * JSON so the UI can render it in a table before the user exports it.
   */
  @Get('workspace/:workspaceId/reports/:type')
  @UseGuards(WorkspaceRoleGuard)
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
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
