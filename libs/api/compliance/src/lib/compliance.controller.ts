import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { CurrentUser, SystemRoles } from '@org/api-common';
import { SystemRole } from '@org/types';
import type {
  ComplianceChecklistStatus,
  ComplianceEvaluationContext,
  ComplianceReviewStatus,
} from '@org/types';
import { ComplianceService } from './compliance.service.js';

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

@Controller({ path: 'admin/compliance', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN, SystemRole.SUPPORT)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  // ---------------------------------------------------------------------------
  // OVERVIEW
  // ---------------------------------------------------------------------------

  @Get('overview')
  getOverview() {
    return this.compliance.getOverview();
  }

  // ---------------------------------------------------------------------------
  // PLATFORMS
  // ---------------------------------------------------------------------------

  @Get('platforms')
  listPlatforms() {
    return this.compliance.listPlatforms();
  }

  @Post('platforms')
  createPlatform(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      code: string;
      name: string;
      type?: 'WEB' | 'DESKTOP' | 'MOBILE';
      currentVersion?: string;
      minSupportedVersion?: string;
    },
  ) {
    return this.compliance.createPlatform(actorEmail, body);
  }

  @Patch('platforms/:id')
  updatePlatform(
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      currentVersion?: string;
      minSupportedVersion?: string;
      isActive?: boolean;
    },
  ) {
    return this.compliance.updatePlatform(actorEmail, id, body);
  }

  // ---------------------------------------------------------------------------
  // REGIONS & COUNTRIES
  // ---------------------------------------------------------------------------

  @Get('regions')
  listRegions() {
    return this.compliance.listRegions();
  }

  @Get('countries')
  listCountries(@Query('regionId') regionId?: string) {
    return this.compliance.listCountries(regionId);
  }

  // ---------------------------------------------------------------------------
  // REQUIREMENTS & POLICIES
  // ---------------------------------------------------------------------------

  @Get('requirements')
  listRequirements(
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('platform') platform?: string,
    @Query('country') country?: string,
    @Query('search') search?: string,
  ) {
    return this.compliance.listRequirements({
      category,
      severity,
      platform,
      country,
      search,
    });
  }

  @Post('requirements')
  createRequirement(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      code: string;
      title: string;
      description: string;
      category: string;
      severity: string;
      isBlocking?: boolean;
      remediationGuide?: string;
      externalUrl?: string;
      policyId?: string;
      scopes?: Array<{
        countryCode?: string;
        regionCode?: string;
        platformCode?: string;
        distributionCode?: string;
        minVersion?: string;
        maxVersion?: string;
        isExcluded?: boolean;
      }>;
    },
  ) {
    return this.compliance.createRequirement(actorEmail, body);
  }

  @Patch('requirements/:id')
  updateRequirement(
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      category?: string;
      severity?: string;
      isBlocking?: boolean;
      remediationGuide?: string;
      externalUrl?: string;
    },
  ) {
    return this.compliance.updateRequirement(actorEmail, id, body);
  }

  @Delete('requirements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRequirement(
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
  ) {
    return this.compliance.deleteRequirement(actorEmail, id);
  }

  @Get('policies')
  listPolicies() {
    return this.compliance.listPolicies();
  }

  @Post('policies')
  createPolicy(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
      version?: string;
      effectiveDate?: string;
      externalGuidelineRef?: string;
      externalGuidelineUrl?: string;
    },
  ) {
    return this.compliance.createPolicy(actorEmail, body);
  }

  // ---------------------------------------------------------------------------
  // VERSIONS
  // ---------------------------------------------------------------------------

  @Get('versions')
  listVersions(@Query('platformId') platformId?: string) {
    return this.compliance.listVersions(platformId);
  }

  @Post('versions')
  createVersion(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      platformId: string;
      version: string;
      releaseDate?: string;
      changelog?: string;
      isCurrent?: boolean;
    },
  ) {
    return this.compliance.createVersion(actorEmail, body);
  }

  // ---------------------------------------------------------------------------
  // EVALUATION & REVIEWS
  // ---------------------------------------------------------------------------

  @Post('evaluate')
  evaluate(@Body() context: ComplianceEvaluationContext) {
    return this.compliance.evaluate(context);
  }

  @Get('reviews')
  listReviews(
    @Query('platformId') platformId?: string,
    @Query('status') status?: string,
  ) {
    return this.compliance.listReviews({ platformId, status });
  }

  @Get('reviews/:id')
  getReview(@Param('id') id: string) {
    return this.compliance.getReview(id);
  }

  @Post('reviews')
  createReview(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      appVersionId: string;
      platformId: string;
      distributionId?: string;
      countryId?: string;
      summary?: string;
    },
  ) {
    return this.compliance.createReview(actorEmail, body);
  }

  // ---------------------------------------------------------------------------
  // CHECKLIST
  // ---------------------------------------------------------------------------

  @Get('reviews/:reviewId/checklist')
  getChecklist(@Param('reviewId') reviewId: string) {
    return this.compliance.getChecklist(reviewId);
  }

  @Patch('checklist/:itemId')
  updateChecklistItem(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      status: ComplianceChecklistStatus;
      notes?: string;
    },
  ) {
    return this.compliance.updateChecklistItem(
      actorId,
      actorEmail,
      itemId,
      body,
    );
  }

  // ---------------------------------------------------------------------------
  // ISSUES & REJECTIONS
  // ---------------------------------------------------------------------------

  @Get('issues')
  listIssues(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('platformId') platformId?: string,
    @Query('countryId') countryId?: string,
    @Query('q') q?: string,
  ) {
    return this.compliance.listIssues({
      status,
      severity,
      platformId,
      countryId,
      q,
    });
  }

  @Post('issues')
  createIssue(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      title: string;
      description: string;
      category: string;
      severity: string;
      source?: string;
      reviewerNotes?: string;
      remediation?: string;
      appVersionId?: string;
      platformId?: string;
      countryId?: string;
      requirementId?: string;
    },
  ) {
    return this.compliance.createIssue(actorEmail, body);
  }

  @Patch('issues/:id')
  updateIssue(
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      remediation?: string;
      resolution?: string;
      reviewerNotes?: string;
      severity?: string;
    },
  ) {
    return this.compliance.updateIssue(actorEmail, id, body);
  }

  // ---------------------------------------------------------------------------
  // EVIDENCE
  // ---------------------------------------------------------------------------

  @Post('evidence')
  addEvidence(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      title: string;
      type?: string;
      url: string;
      description?: string;
      requirementId?: string;
      checklistItemId?: string;
      issueId?: string;
    },
  ) {
    return this.compliance.addEvidence(actorId, actorEmail, body);
  }

  // ---------------------------------------------------------------------------
  // RELEASE GATE & OVERRIDE
  // ---------------------------------------------------------------------------

  @Get('reviews/:reviewId/release-gate')
  evaluateReleaseGate(@Param('reviewId') reviewId: string) {
    return this.compliance.evaluateReleaseGate(reviewId);
  }

  @Post('reviews/:reviewId/override')
  @SystemRoles(SystemRole.SUPERADMIN)
  overrideRelease(
    @CurrentUser('id') adminId: string,
    @CurrentUser('email') adminEmail: string,
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      reason: string;
      newStatus: ComplianceReviewStatus;
    },
  ) {
    return this.compliance.overrideRelease(
      adminId,
      adminEmail,
      reviewId,
      body,
    );
  }

  // ---------------------------------------------------------------------------
  // LEGAL & POLICY LINKS
  // ---------------------------------------------------------------------------

  @Get('legal-links')
  getLegalLinks() {
    return this.compliance.getLegalLinks();
  }

  @Put('legal-links')
  updateLegalLink(
    @CurrentUser('email') actorEmail: string,
    @Body()
    body: {
      key: string;
      title: string;
      url: string;
      contentMarkdown?: string;
      countryCode?: string;
      platformCode?: string;
    },
  ) {
    return this.compliance.updateLegalLink(actorEmail, body);
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGS
  // ---------------------------------------------------------------------------

  @Get('audit-logs')
  listAuditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.compliance.listAuditLogs(
      toInt(page) ?? 1,
      toInt(pageSize) ?? 25,
      { action, targetType },
    );
  }
}
