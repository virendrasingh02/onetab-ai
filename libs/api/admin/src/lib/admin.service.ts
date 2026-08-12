import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { SystemRole } from '@org/types';

export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function paging(page?: number, pageSize?: number) {
  const size = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const current = Math.max(page ?? 1, 1);
  return { skip: (current - 1) * size, take: size, page: current, pageSize: size };
}

/**
 * Platform administration.
 *
 * Everything here deliberately crosses tenant boundaries — that is the point of
 * an operator console — so the whole surface sits behind `SystemRoleGuard` at
 * the controller. No method re-checks the role; if one is ever mounted without
 * that guard, it is wide open, which is why they all live on one controller.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // --- overview -------------------------------------------------------------

  async overview() {
    const [
      users,
      workspaces,
      channels,
      messages,
      uploads,
      storage,
      agents,
      workflows,
      organizations,
      newUsersLast7Days,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.workspace.count(),
      this.prisma.channel.count(),
      this.prisma.recentActivity.count({ where: { kind: 'MESSAGE' } }),
      this.prisma.upload.count(),
      this.prisma.upload.aggregate({ _sum: { size: true } }),
      this.prisma.aIAgent.count(),
      this.prisma.automationWorkflow.count(),
      this.prisma.organization.count(),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      users,
      workspaces,
      channels,
      messages,
      uploads,
      storageBytes: storage._sum.size ?? 0,
      agents,
      workflows,
      organizations,
      newUsersLast7Days,
    };
  }

  // --- users ----------------------------------------------------------------

  async listUsers(options: {
    query?: string;
    role?: SystemRole;
    page?: number;
    pageSize?: number;
  }) {
    const { skip, take, page, pageSize } = paging(options.page, options.pageSize);
    const contains = { contains: options.query ?? '', mode: 'insensitive' as const };

    const where = {
      ...(options.query
        ? { OR: [{ name: contains }, { email: contains }] }
        : {}),
      ...(options.role ? { systemRole: options.role } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        // Never `select: *` here: this is the one place that reads across every
        // account, so the password hash must be excluded explicitly.
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          systemRole: true,
          presence: true,
          emailVerifiedAt: true,
          lastSeenAt: true,
          createdAt: true,
          _count: { select: { workspaceMembers: true, ownedWorkspaces: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: rows, total, page, pageSize };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        timezone: true,
        systemRole: true,
        presence: true,
        emailVerifiedAt: true,
        lastSeenAt: true,
        createdAt: true,
        workspaceMembers: {
          select: {
            role: true,
            joinedAt: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  /**
   * Changes a platform role.
   *
   * An operator may not demote themselves: doing so would revoke their access
   * mid-session and, if they were the last SUPERADMIN, lock everyone out of the
   * console permanently.
   */
  async setUserRole(actorId: string, userId: string, role: SystemRole) {
    if (actorId === userId) {
      throw new ForbiddenException('You cannot change your own platform role.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, systemRole: true },
    });
    if (!target) throw new NotFoundException('User not found.');

    if (
      target.systemRole === SystemRole.SUPERADMIN &&
      role !== SystemRole.SUPERADMIN &&
      (await this.countSuperAdmins()) <= 1
    ) {
      throw new ConflictException(
        'This is the last platform administrator; promote someone else first.',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { systemRole: role },
      select: { id: true, email: true, systemRole: true },
    });
  }

  /**
   * Deletes an account.
   *
   * Workspaces they own are restricted by the schema (`onDelete: Restrict`), so
   * this reports what is blocking rather than failing with a foreign-key error.
   */
  async deleteUser(actorId: string, userId: string): Promise<void> {
    if (actorId === userId) {
      throw new ForbiddenException('You cannot delete your own account here.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        systemRole: true,
        ownedWorkspaces: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    if (user.ownedWorkspaces.length > 0) {
      // `errors` is the only extension field `HttpExceptionFilter` carries
      // through, so the blocking workspaces travel there rather than in a
      // bespoke key the filter would silently drop.
      throw new ConflictException({
        message:
          'This account still owns workspaces. Transfer or delete them first.',
        errors: {
          workspaces: user.ownedWorkspaces.map(
            (workspace) => `${workspace.name} (${workspace.id})`,
          ),
        },
      });
    }

    if (
      user.systemRole === SystemRole.SUPERADMIN &&
      (await this.countSuperAdmins()) <= 1
    ) {
      throw new ConflictException(
        'This is the last platform administrator; promote someone else first.',
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }

  private countSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { systemRole: SystemRole.SUPERADMIN },
    });
  }

  // --- workspaces -----------------------------------------------------------

  async listWorkspaces(options: {
    query?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { skip, take, page, pageSize } = paging(options.page, options.pageSize);
    const contains = { contains: options.query ?? '', mode: 'insensitive' as const };

    const where = options.query
      ? { OR: [{ name: contains }, { slug: contains }] }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: {
            select: { members: true, channels: true, uploads: true, tasks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return { items: rows, total, page, pageSize };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            members: true,
            channels: true,
            uploads: true,
            tasks: true,
            projects: true,
            aiAgents: true,
          },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const storage = await this.prisma.upload.aggregate({
      where: { workspaceId },
      _sum: { size: true },
    });

    return { ...workspace, storageBytes: storage._sum.size ?? 0 };
  }

  /** Hard delete. Channels, members, tasks and uploads cascade from the schema. */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  // --- organisations --------------------------------------------------------

  async listOrganizations() {
    return this.prisma.organization.findMany({
      include: {
        departments: true,
        subscriptions: true,
        _count: { select: { auditLogs: true, ssoConfigs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDepartment(
    organizationId: string,
    data: { name: string; code?: string },
  ) {
    await this.assertOrganization(organizationId);
    return this.prisma.department.create({
      data: { organizationId, name: data.name, code: data.code },
    });
  }

  async deleteDepartment(
    organizationId: string,
    departmentId: string,
  ): Promise<void> {
    const found = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Department not found.');

    await this.prisma.department.delete({ where: { id: departmentId } });
  }

  private async assertOrganization(organizationId: string) {
    const found = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Organization not found.');
  }

  // --- audit --------------------------------------------------------------

  /**
   * Audit entries across every organisation.
   *
   * The per-organisation view lives on the enterprise controller; this is the
   * console's cross-org log, which is why it carries the organisation name.
   */
  async auditLogs(options: {
    organizationId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminPage<unknown>> {
    const { skip, take, page, pageSize } = paging(options.page, options.pageSize);
    const where = options.organizationId
      ? { organizationId: options.organizationId }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.enterpriseAuditLog.findMany({
        where,
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.enterpriseAuditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
