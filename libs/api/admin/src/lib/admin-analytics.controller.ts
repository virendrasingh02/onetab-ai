import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { SystemRoles } from '@org/api-common';
import { SystemRole } from '@org/types';
import type { Response } from 'express';
import { AdminAnalyticsService } from './admin-analytics.service.js';

@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN, SystemRole.SUPPORT)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('overview')
  getOverview(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('platform') platform?: 'all' | 'web' | 'desktop',
  ) {
    return this.analytics.getOverview({
      range: range as any,
      startDate,
      endDate,
      platform,
    });
  }

  @Get('users')
  getUserAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getUserAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('platform-usage')
  getPlatformUsage(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getPlatformUsage({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('workspaces')
  getWorkspaces(
    @Query('range') range?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.analytics.getWorkspaces(
      { range: range as any },
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        search,
        status,
      },
    );
  }

  @Get('workspaces/:workspaceId')
  getWorkspaceDetail(
    @Param('workspaceId') workspaceId: string,
    @Query('range') range?: string,
  ) {
    return this.analytics.getWorkspaceDetail(workspaceId, {
      range: range as any,
    });
  }

  @Get('apis')
  getApiAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getApiAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('messaging')
  getMessagingAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getMessagingAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('storage')
  getStorageAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getStorageAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('devices')
  getDeviceAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getDeviceAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('locations')
  getLocationAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getLocationAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('revenue')
  getRevenueAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getRevenueAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('subscriptions')
  getSubscriptionAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getSubscriptionAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('engagement')
  getEngagementAnalytics(
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analytics.getEngagementAnalytics({
      range: range as any,
      startDate,
      endDate,
    });
  }

  @Get('live-activity')
  getLiveActivity() {
    return this.analytics.getLiveActivity();
  }

  @Get('export/:type')
  async exportData(
    @Param('type') type: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('range') range?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const result = await this.analytics.exportAnalytics(type, format, {
      range: range as any,
    });

    if (format === 'csv' && response) {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="admin-analytics-${type}-${Date.now()}.csv"`,
      );
    } else if (response) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    return result;
  }
}
