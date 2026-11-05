import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ContentModerationService } from '@org/api-ai';
import { SystemRoleGuard } from '@org/api-auth';
import { CurrentUser, SystemRoles, zodBody } from '@org/api-common';
import { SystemRole } from '@org/types';
import {
  blockUserSchema,
  createContentReportSchema,
  deleteAccountSchema,
  resolveContentReportSchema,
  type BlockUserInput,
  type CreateContentReportInput,
  type DeleteAccountInput,
  type ResolveContentReportInput,
} from '@org/validation';
import { AccountDeletionService } from './account-deletion.service.js';
import { SafetyService } from './safety.service.js';

const MEDIA_CHECK_MAX_BYTES = 50 * 1024 * 1024;

@Controller({ path: 'users/me', version: '1' })
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Get('deletion-preview')
  deletionPreview(@CurrentUser('id') userId: string) {
    return this.deletion.preview(userId);
  }

  /** Throttled like sign-in: this endpoint also checks a password. */
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  deleteAccount(
    @CurrentUser('id') userId: string,
    @Body(zodBody(deleteAccountSchema)) body: DeleteAccountInput,
  ) {
    return this.deletion.deleteAccount(userId, body);
  }
}

@Controller({ path: 'safety', version: '1' })
export class SafetyController {
  constructor(
    private readonly safety: SafetyService,
    private readonly moderation: ContentModerationService,
  ) {}

  /**
   * Chat media goes straight to Matrix, so clients ask here first. Unlike the
   * upload endpoints nothing is kept: the bytes are checked and dropped.
   */
  @Post('media-check')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MEDIA_CHECK_MAX_BYTES } }),
  )
  async mediaCheck(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A file is required.');
    }
    const { scanned } = await this.moderation.assertFileAllowed(file);
    return { allowed: true, scanned };
  }

  @Post('reports')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  report(
    @CurrentUser('id') userId: string,
    @Body(zodBody(createContentReportSchema)) body: CreateContentReportInput,
  ) {
    return this.safety.createReport(userId, body);
  }

  @Get('blocks')
  blocks(@CurrentUser('id') userId: string) {
    return this.safety.listBlocks(userId);
  }

  @Post('blocks')
  block(
    @CurrentUser('id') userId: string,
    @Body(zodBody(blockUserSchema)) body: BlockUserInput,
  ) {
    return this.safety.block(userId, body);
  }

  @Delete('blocks/:userId')
  unblock(
    @CurrentUser('id') userId: string,
    @Param('userId') blockedId: string,
  ) {
    return this.safety.unblock(userId, blockedId);
  }
}

/** The review queue behind every report. */
@Controller({ path: 'admin/safety', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN, SystemRole.SUPPORT)
export class AdminSafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Get('reports')
  reports(@Query('status') status?: string) {
    return this.safety.listReports(status);
  }

  @Patch('reports/:id')
  resolve(
    @Param('id') id: string,
    @CurrentUser('id') operatorId: string,
    @Body(zodBody(resolveContentReportSchema)) body: ResolveContentReportInput,
  ) {
    return this.safety.resolveReport(id, operatorId, body);
  }
}
