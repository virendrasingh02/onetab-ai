import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '@org/api-common';
import type { AppVersionCheckInput, AppVersionCheckResult } from '@org/types';
import { AppVersionsService } from './app-versions.service.js';

@Controller({ path: 'app-versions', version: '1' })
export class AppVersionsPublicController {
  constructor(private readonly appVersions: AppVersionsService) {}

  /**
   * Public endpoint for desktop and web applications to check for updates.
   * Can be queried via GET query params or POST body.
   */
  @Public()
  @Get('check-update')
  checkUpdateGet(
    @Query('platform') platform?: 'web' | 'desktop',
    @Query('os') os?: 'windows' | 'macos' | 'linux',
    @Query('currentVersion') currentVersion?: string,
    @Query('buildNumber') buildNumber?: string,
    @Query('releaseChannel') releaseChannel?: 'stable' | 'beta' | 'alpha' | 'nightly',
    @Query('architecture') architecture?: string,
    @Query('clientId') clientId?: string,
  ): Promise<AppVersionCheckResult> {
    return this.appVersions.checkUpdate({
      platform: platform ?? 'desktop',
      os,
      currentVersion: currentVersion ?? '0.0.0',
      buildNumber,
      releaseChannel,
      architecture,
      clientId,
    });
  }

  @Public()
  @Post('check-update')
  checkUpdatePost(
    @Body() body: AppVersionCheckInput,
  ): Promise<AppVersionCheckResult> {
    return this.appVersions.checkUpdate(body);
  }

  /**
   * Public endpoint returning current web version & build metadata.
   */
  @Public()
  @Get('web-metadata')
  getWebMetadata() {
    return this.appVersions.getWebMetadata();
  }
}
