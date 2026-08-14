import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PUBLIC_USER_SELECT, toWorkspace } from '@org/api-common';
import { PrismaService } from '@org/database';
import { StorageService, type IncomingFile } from '@org/api-storage';
import {
  ApiErrorCode,
  WorkspaceRole,
  type Workspace,
  type WorkspaceSummary,
} from '@org/types';
import {
  workspaceLogoError,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type WorkspaceLogoMimeType,
} from '@org/validation';

/** Extension per accepted logo type, so the stored key carries its own format. */
const LOGO_EXTENSIONS: Record<WorkspaceLogoMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const LOGO_MIME_TYPES: Record<string, WorkspaceLogoMimeType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
        icon: input.icon ?? null,
        iconColor: input.iconColor ?? null,
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
        // Pointing the avatar at an external URL retires any uploaded logo:
        // leaving the key behind would strand bytes nothing renders.
        ...(input.avatarUrl !== undefined
          ? { avatarUrl: input.avatarUrl, avatarKey: null }
          : {}),
        // Each icon field is written only when the caller sent it, so changing
        // the colour alone does not clear the icon and vice versa.
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.iconColor !== undefined ? { iconColor: input.iconColor } : {}),
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

  /**
   * Stores a workspace logo and points `avatarUrl` at the route that serves it.
   *
   * The URL is API-relative (`/workspaces/:id/logo`) rather than absolute: in
   * development the API moves between ports 3000-3009, so an absolute URL baked
   * into a row goes stale. The client resolves it against its API base.
   *
   * The checksum rides along as `?v=` so a replaced logo defeats the browser
   * cache without needing a new path.
   */
  async setLogo(workspaceId: string, file: IncomingFile): Promise<Workspace> {
    if (!file?.buffer?.byteLength) {
      throw new BadRequestException('No image was uploaded.');
    }

    const problem = workspaceLogoError({
      type: file.mimetype,
      size: file.size,
    });
    if (problem) throw new BadRequestException(problem);

    const current = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { avatarKey: true },
    });

    const extension = LOGO_EXTENSIONS[file.mimetype as WorkspaceLogoMimeType];
    const key = this.storage.buildKey(workspaceId, `logo.${extension}`);
    const stored = await this.storage.put(key, file.buffer);

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        avatarKey: stored.key,
        avatarUrl: `/workspaces/${workspaceId}/logo?v=${stored.checksum.slice(0, 12)}`,
      },
    });

    // Only after the row points at the new bytes — a failure here costs disk,
    // whereas deleting first would leave the logo broken if the update failed.
    if (current.avatarKey && current.avatarKey !== stored.key) {
      await this.storage.delete(current.avatarKey);
    }

    return toWorkspace(workspace);
  }

  /** The logo bytes, for the public read route. */
  async readLogo(
    workspaceId: string,
  ): Promise<{ mimeType: string; content: Buffer }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { avatarKey: true },
    });

    if (!workspace?.avatarKey) {
      throw new NotFoundException('This workspace has no logo.');
    }
    if (!(await this.storage.exists(workspace.avatarKey))) {
      throw new NotFoundException('The stored logo is no longer available.');
    }

    const extension = workspace.avatarKey.split('.').pop() ?? '';
    return {
      mimeType: LOGO_MIME_TYPES[extension] ?? 'application/octet-stream',
      content: await this.storage.get(workspace.avatarKey),
    };
  }

  async removeLogo(workspaceId: string): Promise<Workspace> {
    const current = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { avatarKey: true },
    });

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { avatarKey: null, avatarUrl: null },
    });

    if (current.avatarKey) await this.storage.delete(current.avatarKey);

    return toWorkspace(workspace);
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
