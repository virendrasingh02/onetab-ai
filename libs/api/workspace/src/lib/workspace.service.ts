import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PUBLIC_USER_SELECT, toWorkspace } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  ApiErrorCode,
  WorkspaceRole,
  type Workspace,
  type WorkspaceSummary,
} from '@org/types';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '@org/validation';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every workspace the user belongs to, for the switcher. */
  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, channels: true } },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      ...toWorkspace(membership.workspace),
      role: membership.role as WorkspaceRole,
      memberCount: membership.workspace._count.members,
      channelCount: membership.workspace._count.channels,
    }));
  }

  async findBySlug(slug: string, userId: string): Promise<WorkspaceSummary> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      include: {
        _count: { select: { members: true, channels: true } },
        members: { where: { userId }, select: { role: true } },
      },
    });

    // Non-members get 404 rather than 403 — existence itself is private.
    if (!workspace || workspace.members.length === 0) {
      throw new NotFoundException('Workspace not found.');
    }

    return {
      ...toWorkspace(workspace),
      role: workspace.members[0].role as WorkspaceRole,
      memberCount: workspace._count.members,
      channelCount: workspace._count.channels,
    };
  }

  /**
   * Creates the workspace, its owner membership and a `#general` channel in a
   * single transaction — a workspace with no channel is not a usable state.
   */
  async create(
    userId: string,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const taken = await this.prisma.workspace.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });

    if (taken) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'That workspace URL is already taken.',
        errors: { slug: ['That workspace URL is already taken.'] },
      });
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        ownerId: userId,
        members: { create: { userId, role: WorkspaceRole.OWNER } },
        channels: {
          create: {
            name: 'general',
            slug: 'general',
            topic: 'Company-wide announcements and work-based matters',
            createdById: userId,
            members: { create: { userId, role: 'ADMIN' } },
          },
        },
      },
      include: { _count: { select: { members: true, channels: true } } },
    });

    return {
      ...toWorkspace(workspace),
      role: WorkspaceRole.OWNER,
      memberCount: workspace._count.members,
      channelCount: workspace._count.channels,
    };
  }

  async update(
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });
    return toWorkspace(workspace);
  }

  /** Hard delete. Channels, members and invitations cascade from the schema. */
  async remove(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete a workspace.');
    }

    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  /**
   * Moves ownership to another member.
   *
   * The previous owner is demoted to ADMIN in the same transaction so the
   * workspace is never left with two OWNERs or none.
   */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerUserId: string,
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (workspace.ownerId !== currentOwnerId) {
      throw new ForbiddenException('Only the owner can transfer ownership.');
    }
    if (newOwnerUserId === currentOwnerId) {
      throw new ConflictException('That member is already the owner.');
    }

    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerUserId } },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('That person is not a member of this workspace.');
    }

    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: newOwnerUserId },
      }),
      this.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: newOwnerUserId } },
        data: { role: WorkspaceRole.OWNER },
      }),
      this.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: currentOwnerId } },
        data: { role: WorkspaceRole.ADMIN },
      }),
    ]);
  }

  /** Suggests an unused slug, for the create-workspace form. */
  async suggestSlug(base: string): Promise<string> {
    const candidates = [base, ...Array.from({ length: 20 }, (_, i) => `${base}-${i + 2}`)];
    const taken = await this.prisma.workspace.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    });
    const used = new Set(taken.map((row) => row.slug));
    return candidates.find((slug) => !used.has(slug)) ?? `${base}-${Date.now()}`;
  }

  /** Members shown on the workspace overview. */
  async listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: { select: PUBLIC_USER_SELECT } },
    });
  }
}
