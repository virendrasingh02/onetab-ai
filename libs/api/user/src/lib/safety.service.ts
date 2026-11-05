import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MatrixAdminService } from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type {
  BlockedUserDto,
  ContentReportDto,
  ContentReportReceipt,
} from '@org/types';
import type {
  BlockUserInput,
  CreateContentReportInput,
  ResolveContentReportInput,
} from '@org/validation';

const BLOCKED_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  matrixUserId: true,
} as const;

/**
 * The user-generated-content safeguards the stores require (App Store 1.2,
 * Google Play UGC policy): report content, block a person, and an operator
 * queue so a report gets a response.
 */
@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: MatrixAdminService,
  ) {}

  /** Reporting the same thing twice updates the one report instead of queueing another. */
  async createReport(
    reporterId: string,
    input: CreateContentReportInput,
  ): Promise<ContentReportReceipt> {
    const targetUserId =
      input.targetUserId ??
      (input.targetMatrixUserId
        ? await this.userIdForMatrix(input.targetMatrixUserId)
        : undefined);

    // Taken from the request, so only recorded when the reporter belongs there.
    const member = input.workspaceId
      ? await this.prisma.workspaceMember.findFirst({
          where: { workspaceId: input.workspaceId, userId: reporterId },
          select: { id: true },
        })
      : null;

    const details = {
      reason: input.reason,
      details: input.details ?? null,
      excerpt: input.excerpt ?? null,
    };
    const report = await this.prisma.contentReport.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
      update: details,
      create: {
        ...details,
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetUserId: targetUserId ?? null,
        workspaceId: member ? input.workspaceId : null,
      },
      select: { id: true, status: true },
    });

    this.logger.warn({
      event: 'content_reported',
      reportId: report.id,
      targetType: input.targetType,
      reason: input.reason,
    });
    return report;
  }

  async listBlocks(blockerId: string): Promise<BlockedUserDto[]> {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, blocked: { select: BLOCKED_SELECT } },
    });
    return rows.map((row) => ({
      userId: row.blocked.id,
      name: row.blocked.displayName ?? row.blocked.name,
      avatarUrl: row.blocked.avatarUrl,
      matrixUserId: row.blocked.matrixUserId,
      blockedAt: row.createdAt.toISOString(),
    }));
  }

  async block(
    blockerId: string,
    input: BlockUserInput,
  ): Promise<{ blocked: true; chatEnforced: boolean }> {
    const blockedId =
      input.userId ??
      (input.matrixUserId
        ? await this.userIdForMatrix(input.matrixUserId)
        : undefined);
    if (!blockedId)
      throw new NotFoundException('That person could not be found.');
    if (blockedId === blockerId) {
      throw new BadRequestException('You cannot block yourself.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('That person could not be found.');

    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    return { blocked: true, chatEnforced: await this.syncChat(blockerId) };
  }

  async unblock(
    blockerId: string,
    blockedId: string,
  ): Promise<{ blocked: false; chatEnforced: boolean }> {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false, chatEnforced: await this.syncChat(blockerId) };
  }

  async listReports(status?: string): Promise<ContentReportDto[]> {
    const person = { select: { id: true, name: true, email: true } };
    const rows = await this.prisma.contentReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { reporter: person, targetUser: person },
    });
    return rows.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      workspaceId: row.workspaceId,
      reason: row.reason,
      details: row.details,
      excerpt: row.excerpt,
      status: row.status,
      resolutionNote: row.resolutionNote,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      reporter: row.reporter,
      targetUser: row.targetUser,
    }));
  }

  async resolveReport(
    reportId: string,
    operatorId: string,
    input: ResolveContentReportInput,
  ): Promise<{ id: string; status: string }> {
    const closed = input.status === 'ACTIONED' || input.status === 'DISMISSED';
    const updated = await this.prisma.contentReport.updateMany({
      where: { id: reportId },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote ?? null,
        resolvedById: closed ? operatorId : null,
        resolvedAt: closed ? new Date() : null,
      },
    });
    if (updated.count === 0) throw new NotFoundException('Report not found.');
    return { id: reportId, status: input.status };
  }

  private async userIdForMatrix(
    matrixUserId: string,
  ): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { matrixUserId },
      select: { id: true },
    });
    return user?.id;
  }

  /**
   * Mirrors the block list into `m.ignored_user_list`, which makes the
   * homeserver itself drop those events and their pushes for every device.
   * The block row stands either way; clients also hide blocked senders.
   */
  private async syncChat(blockerId: string): Promise<boolean> {
    const blocker = await this.prisma.user.findUnique({
      where: { id: blockerId },
      select: {
        matrixUserId: true,
        blocksMade: {
          select: { blocked: { select: { matrixUserId: true } } },
        },
      },
    });
    if (!blocker?.matrixUserId) return false;
    const ignored = blocker.blocksMade
      .map((row) => row.blocked.matrixUserId)
      .filter((id): id is string => Boolean(id));
    try {
      return await this.matrix.setIgnoredUsers(blocker.matrixUserId, ignored);
    } catch (error) {
      this.logger.warn({
        event: 'block_list_sync_failed',
        blockerId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
