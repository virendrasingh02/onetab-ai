import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import type { AIFeedbackPayload } from '@org/types';
import { AIFeedbackService } from './ai-feedback.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai-feedback', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIFeedbackController {
  constructor(private readonly feedbackService: AIFeedbackService) {}

  @Post()
  submit(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: AIFeedbackPayload,
  ) {
    return this.feedbackService.submitFeedback(workspaceId, userId, body);
  }
}
