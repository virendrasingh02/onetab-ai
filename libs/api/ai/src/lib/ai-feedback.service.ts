import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { AIFeedbackPayload } from '@org/types';

@Injectable()
export class AIFeedbackService {
  private readonly logger = new Logger(AIFeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitFeedback(
    workspaceId: string,
    userId: string | undefined,
    data: AIFeedbackPayload,
  ) {
    const feedback = await this.prisma.aIFeedback.create({
      data: {
        workspaceId,
        userId,
        executionId: data.executionId,
        agentId: data.agentId,
        workflowId: data.workflowId,
        rating: data.rating,
        comment: data.comment,
        issueCategory: data.issueCategory,
      },
    });

    this.logger.log(
      `AI feedback recorded (rating: ${data.rating}) in workspace ${workspaceId}`,
    );

    return { id: feedback.id };
  }
}
