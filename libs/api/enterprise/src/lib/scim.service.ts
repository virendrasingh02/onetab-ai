import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { MembershipStatus, PresenceStatus, WorkspaceRole } from '@org/types';
import type {
  SCIMGroupMemberRef,
  SCIMGroupResource,
  SCIMListResponse,
  SCIMPatchRequest,
  SCIMUserResource,
} from '@org/types';

export interface SCIMUserPayload {
  schemas?: string[];
  externalId?: string;
  userName: string;
  name?: {
    formatted?: string;
    familyName?: string;
    givenName?: string;
    middleName?: string;
  };
  displayName?: string;
  emails?: Array<{ value: string; type?: string; primary?: boolean }>;
  roles?: Array<{ value: string; primary?: boolean }>;
  active?: boolean;
}

export interface SCIMGroupPayload {
  schemas?: string[];
  displayName: string;
  externalId?: string;
  members?: Array<{ value: string; display?: string; $ref?: string }>;
}

@Injectable()
export class SCIMService {
  private readonly logger = new Logger(SCIMService.name);

  constructor(private readonly prisma: PrismaService) {}

  /* -------------------------------------------------------------------------- */
  /* User Operations                                                            */
  /* -------------------------------------------------------------------------- */

  async listUsers(
    orgId: string,
    query: { filter?: string; startIndex?: number; count?: number },
    baseUrl: string,
  ): Promise<SCIMListResponse<SCIMUserResource>> {
    const startIndex = Math.max(1, query.startIndex ?? 1);
    const count = Math.min(100, Math.max(1, query.count ?? 50));
    const skip = startIndex - 1;

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: { workspaces: { select: { id: true } } },
    });

    const orgWorkspaceIds = org.workspaces.map((w) => w.id);
    const verifiedDomains = [org.domain, ...(org.verifiedDomains ?? [])];

    // Build filter condition
    const whereCondition: any = {
      OR: [
        {
          workspaceMembers: {
            some: { workspaceId: { in: orgWorkspaceIds } },
          },
        },
        ...verifiedDomains.map((dom) => ({
          email: { endsWith: `@${dom}`, mode: 'insensitive' },
        })),
      ],
    };

    if (query.filter) {
      const parsedFilter = this.parseFilter(query.filter);
      if (parsedFilter) {
        whereCondition.AND = parsedFilter;
      }
    }

    const [totalResults, users] = await Promise.all([
      this.prisma.user.count({ where: whereCondition }),
      this.prisma.user.findMany({
        where: whereCondition,
        skip,
        take: count,
        orderBy: { createdAt: 'asc' },
        include: {
          workspaceMembers: {
            where: { workspaceId: { in: orgWorkspaceIds } },
            select: { role: true, status: true },
          },
        },
      }),
    ]);

    const resources = users.map((u) => this.toScimUser(u, baseUrl));

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  async getUser(orgId: string, userId: string, baseUrl: string): Promise<SCIMUserResource> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: { workspaces: { select: { id: true } } },
    });

    const orgWorkspaceIds = org.workspaces.map((w) => w.id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          where: { workspaceId: { in: orgWorkspaceIds } },
          select: { role: true, status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: `User with id "${userId}" not found.`,
      });
    }

    return this.toScimUser(user, baseUrl);
  }

  async provisionUser(
    orgId: string,
    payload: SCIMUserPayload,
    baseUrl: string,
  ): Promise<SCIMUserResource> {
    const email = (payload.emails?.[0]?.value || payload.userName || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      throw new BadRequestException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'User must have a valid email or userName.',
      });
    }

    const displayName =
      payload.displayName ||
      payload.name?.formatted ||
      [payload.name?.givenName, payload.name?.familyName].filter(Boolean).join(' ') ||
      email.split('@')[0];

    const active = payload.active !== false;

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: {
        workspaces: { orderBy: { createdAt: 'asc' }, take: 5 },
      },
    });

    const primaryWorkspace = org.workspaces[0];

    // Find or create user
    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: displayName,
        passwordHash: '$2b$10$scim_provisioned_placeholder',
        emailVerifiedAt: new Date(),
        presence: active ? PresenceStatus.ONLINE : PresenceStatus.OFFLINE,
      },
      update: {
        name: displayName,
        ...(active ? {} : { presence: PresenceStatus.OFFLINE }),
      },
    });

    // Wire up workspace membership in org workspaces
    if (primaryWorkspace) {
      const membershipStatus = active ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED;
      await this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: primaryWorkspace.id,
            userId: user.id,
          },
        },
        create: {
          workspaceId: primaryWorkspace.id,
          userId: user.id,
          role: WorkspaceRole.MEMBER,
          status: membershipStatus,
        },
        update: {
          status: membershipStatus,
        },
      });
    }

    this.logger.log(`SCIM user provisioned: ${email} (${user.id}) in org ${orgId}`);

    // Log enterprise audit log
    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_USER_CREATE', `User:${user.id}`, {
      email,
      displayName,
      active,
    });

    return this.getUser(orgId, user.id, baseUrl);
  }

  async updateUser(
    orgId: string,
    userId: string,
    payload: SCIMUserPayload,
    baseUrl: string,
  ): Promise<SCIMUserResource> {
    const existing = await this.getUser(orgId, userId, baseUrl);
    const email = (payload.emails?.[0]?.value || payload.userName || existing.userName).toLowerCase().trim();
    const displayName =
      payload.displayName ||
      payload.name?.formatted ||
      [payload.name?.givenName, payload.name?.familyName].filter(Boolean).join(' ') ||
      existing.displayName;

    const active = payload.active !== undefined ? payload.active : existing.active;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        name: displayName,
        ...(active ? {} : { presence: PresenceStatus.OFFLINE }),
      },
    });

    await this.applyUserActiveStatus(orgId, userId, active);

    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_USER_UPDATE', `User:${userId}`, {
      email,
      displayName,
      active,
    });

    return this.getUser(orgId, userId, baseUrl);
  }

  async patchUser(
    orgId: string,
    userId: string,
    patchRequest: SCIMPatchRequest,
    baseUrl: string,
  ): Promise<SCIMUserResource> {
    const user = await this.getUser(orgId, userId, baseUrl);
    let updatedActive = user.active;
    let updatedName = user.displayName;

    for (const op of patchRequest.Operations || []) {
      const opType = (op.op || '').toLowerCase();
      const path = (op.path || '').toLowerCase();
      const val = op.value as any;

      if (opType === 'replace' || opType === 'add') {
        if (path === 'active' || (val && typeof val.active === 'boolean')) {
          updatedActive = path === 'active' ? Boolean(val) : Boolean(val.active);
        } else if (path === 'displayname' || (val && typeof val.displayName === 'string')) {
          updatedName = path === 'displayname' ? String(val) : String(val.displayName);
        } else if (path.startsWith('name.') || (val && val.formatted)) {
          updatedName = val?.formatted || val?.givenName || updatedName;
        }
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updatedName,
        ...(updatedActive ? {} : { presence: PresenceStatus.OFFLINE }),
      },
    });

    await this.applyUserActiveStatus(orgId, userId, updatedActive);

    await this.logEnterpriseAudit(
      orgId,
      'SCIM_SYSTEM',
      updatedActive ? 'SCIM_USER_PATCH' : 'SCIM_USER_DEPROVISION',
      `User:${userId}`,
      { active: updatedActive, displayName: updatedName },
    );

    return this.getUser(orgId, userId, baseUrl);
  }

  async deprovisionUser(orgId: string, userId: string): Promise<void> {
    await this.applyUserActiveStatus(orgId, userId, false);
    await this.prisma.user.update({
      where: { id: userId },
      data: { presence: PresenceStatus.OFFLINE },
    });

    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_USER_DEPROVISION', `User:${userId}`, {
      action: 'DELETE',
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Group Operations                                                           */
  /* -------------------------------------------------------------------------- */

  async listGroups(
    orgId: string,
    query: { filter?: string; startIndex?: number; count?: number },
    baseUrl: string,
  ): Promise<SCIMListResponse<SCIMGroupResource>> {
    const startIndex = Math.max(1, query.startIndex ?? 1);
    const count = Math.min(100, Math.max(1, query.count ?? 50));
    const skip = startIndex - 1;

    const whereCondition: any = { organizationId: orgId };
    if (query.filter) {
      const match = query.filter.match(/displayName\s+eq\s+["']([^"']+)["']/i);
      if (match && match[1]) {
        whereCondition.displayName = { equals: match[1], mode: 'insensitive' };
      }
    }

    const [totalResults, groups] = await Promise.all([
      this.prisma.sCIMGroup.count({ where: whereCondition }),
      this.prisma.sCIMGroup.findMany({
        where: whereCondition,
        skip,
        take: count,
        orderBy: { displayName: 'asc' },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
    ]);

    const resources = groups.map((g) => this.toScimGroup(g, baseUrl));

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  async getGroup(orgId: string, groupId: string, baseUrl: string): Promise<SCIMGroupResource> {
    const group = await this.prisma.sCIMGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!group) {
      throw new NotFoundException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: `Group with id "${groupId}" not found.`,
      });
    }

    return this.toScimGroup(group, baseUrl);
  }

  async createGroup(
    orgId: string,
    payload: SCIMGroupPayload,
    baseUrl: string,
  ): Promise<SCIMGroupResource> {
    const displayName = payload.displayName?.trim();
    if (!displayName) {
      throw new BadRequestException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'Group displayName is required.',
      });
    }

    // Upsert group by displayName
    let group = await this.prisma.sCIMGroup.findUnique({
      where: {
        organizationId_displayName: { organizationId: orgId, displayName },
      },
    });

    if (group) {
      throw new ConflictException({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '409',
        detail: `Group "${displayName}" already exists.`,
      });
    }

    group = await this.prisma.sCIMGroup.create({
      data: {
        organizationId: orgId,
        displayName,
        externalId: payload.externalId,
      },
    });

    // Add members if provided
    if (payload.members && Array.isArray(payload.members)) {
      await this.syncGroupMembers(orgId, group.id, payload.members.map((m) => m.value));
    }

    // Apply role mappings
    await this.applyGroupRoleMappings(orgId, displayName);

    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_GROUP_CREATE', `Group:${group.id}`, {
      displayName,
      memberCount: payload.members?.length ?? 0,
    });

    return this.getGroup(orgId, group.id, baseUrl);
  }

  async updateGroup(
    orgId: string,
    groupId: string,
    payload: SCIMGroupPayload,
    baseUrl: string,
  ): Promise<SCIMGroupResource> {
    const existing = await this.getGroup(orgId, groupId, baseUrl);
    const displayName = payload.displayName?.trim() || existing.displayName;

    await this.prisma.sCIMGroup.update({
      where: { id: groupId },
      data: { displayName, externalId: payload.externalId ?? existing.externalId },
    });

    if (payload.members !== undefined) {
      await this.syncGroupMembers(orgId, groupId, payload.members.map((m) => m.value));
    }

    await this.applyGroupRoleMappings(orgId, displayName);

    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_GROUP_UPDATE', `Group:${groupId}`, {
      displayName,
    });

    return this.getGroup(orgId, groupId, baseUrl);
  }

  async patchGroup(
    orgId: string,
    groupId: string,
    patchRequest: SCIMPatchRequest,
    baseUrl: string,
  ): Promise<SCIMGroupResource> {
    const group = await this.getGroup(orgId, groupId, baseUrl);

    for (const op of patchRequest.Operations || []) {
      const opType = (op.op || '').toLowerCase();
      const path = (op.path || '').toLowerCase();
      const val = op.value;

      if (opType === 'add' && (path === 'members' || !path)) {
        const membersToAdd = Array.isArray(val) ? val : Array.isArray((val as any)?.members) ? (val as any).members : [val];
        for (const item of membersToAdd) {
          const userId = item?.value || item;
          if (typeof userId === 'string') {
            await this.prisma.sCIMGroupMember.upsert({
              where: { groupId_userId: { groupId, userId } },
              create: { groupId, userId },
              update: {},
            });
          }
        }
      } else if (opType === 'remove') {
        if (path.startsWith('members[value eq')) {
          const match = path.match(/members\[value eq ["']([^"']+)["']\]/i);
          if (match && match[1]) {
            await this.prisma.sCIMGroupMember.deleteMany({
              where: { groupId, userId: match[1] },
            });
          }
        } else if (val && Array.isArray(val)) {
          for (const item of val) {
            const userId = item?.value || item;
            if (typeof userId === 'string') {
              await this.prisma.sCIMGroupMember.deleteMany({
                where: { groupId, userId },
              });
            }
          }
        }
      } else if (opType === 'replace') {
        if (path === 'members' || (val && (val as any).members)) {
          const newMembers = Array.isArray(val) ? val : (val as any).members;
          await this.syncGroupMembers(orgId, groupId, (newMembers || []).map((m: any) => m.value || m));
        } else if (path === 'displayname' || (val && (val as any).displayName)) {
          const newName = (typeof val === 'string' ? val : (val as any).displayName)?.trim();
          if (newName) {
            await this.prisma.sCIMGroup.update({
              where: { id: groupId },
              data: { displayName: newName },
            });
          }
        }
      }
    }

    await this.applyGroupRoleMappings(orgId, group.displayName);

    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_GROUP_PATCH', `Group:${groupId}`, {
      patch: patchRequest,
    });

    return this.getGroup(orgId, groupId, baseUrl);
  }

  async deleteGroup(orgId: string, groupId: string): Promise<void> {
    await this.prisma.sCIMGroup.deleteMany({
      where: { id: groupId, organizationId: orgId },
    });

    await this.logEnterpriseAudit(orgId, 'SCIM_SYSTEM', 'SCIM_GROUP_DELETE', `Group:${groupId}`, {});
  }

  /* -------------------------------------------------------------------------- */
  /* Discovery Specifications                                                   */
  /* -------------------------------------------------------------------------- */

  getServiceProviderConfig(baseUrl: string) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.mie.ai/enterprise/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using RFC 6750 Bearer Tokens',
          specUri: 'http://www.rfc-editor.org/info/rfc6750',
          type: 'oauthbearertoken',
          primary: true,
        },
      ],
      meta: {
        location: `${baseUrl}/ServiceProviderConfig`,
        resourceType: 'ServiceProviderConfig',
      },
    };
  }

  getSchemas(baseUrl: string) {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 2,
      startIndex: 1,
      itemsPerPage: 2,
      Resources: [
        {
          id: 'urn:ietf:params:scim:schemas:core:2.0:User',
          name: 'User',
          description: 'Core User Schema',
          attributes: [
            { name: 'userName', type: 'string', required: true },
            { name: 'displayName', type: 'string' },
            { name: 'emails', type: 'complex', multiValued: true },
            { name: 'active', type: 'boolean' },
          ],
          meta: { location: `${baseUrl}/Schemas/urn:ietf:params:scim:schemas:core:2.0:User` },
        },
        {
          id: 'urn:ietf:params:scim:schemas:core:2.0:Group',
          name: 'Group',
          description: 'Core Group Schema',
          attributes: [
            { name: 'displayName', type: 'string', required: true },
            { name: 'members', type: 'complex', multiValued: true },
          ],
          meta: { location: `${baseUrl}/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group` },
        },
      ],
    };
  }

  getResourceTypes(baseUrl: string) {
    return [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        meta: { location: `${baseUrl}/ResourceTypes/User` },
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        description: 'Group Representation',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        meta: { location: `${baseUrl}/ResourceTypes/Group` },
      },
    ];
  }

  /* -------------------------------------------------------------------------- */
  /* Internal Helpers                                                           */
  /* -------------------------------------------------------------------------- */

  private toScimUser(user: any, baseUrl: string): SCIMUserResource {
    const membership = user.workspaceMembers?.[0];
    const active = membership ? membership.status === MembershipStatus.ACTIVE : user.presence !== PresenceStatus.OFFLINE;

    const names = (user.name || '').trim().split(' ');
    const givenName = names[0] || '';
    const familyName = names.slice(1).join(' ') || '';

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      displayName: user.name || user.email,
      name: {
        formatted: user.name,
        givenName,
        familyName,
      },
      emails: [
        {
          value: user.email,
          primary: true,
          type: 'work',
        },
      ],
      roles: membership ? [{ value: membership.role, primary: true }] : [],
      active,
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
        location: `${baseUrl}/Users/${user.id}`,
      },
    };
  }

  private toScimGroup(group: any, baseUrl: string): SCIMGroupResource {
    const members: SCIMGroupMemberRef[] = (group.members || []).map((m: any) => ({
      value: m.user.id,
      display: m.user.name || m.user.email,
      $ref: `${baseUrl}/Users/${m.user.id}`,
    }));

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: group.id,
      displayName: group.displayName,
      externalId: group.externalId ?? undefined,
      members,
      meta: {
        resourceType: 'Group',
        created: group.createdAt.toISOString(),
        lastModified: group.updatedAt.toISOString(),
        location: `${baseUrl}/Groups/${group.id}`,
      },
    };
  }

  private async applyUserActiveStatus(orgId: string, userId: string, active: boolean): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { workspaces: { select: { id: true } } },
    });
    if (!org) return;

    const workspaceIds = org.workspaces.map((w) => w.id);
    const newStatus = active ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED;

    await this.prisma.workspaceMember.updateMany({
      where: {
        userId,
        workspaceId: { in: workspaceIds },
      },
      data: { status: newStatus },
    });

    if (!active) {
      // Revoke all refresh tokens on deprovisioning to immediately terminate sessions
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  private async syncGroupMembers(orgId: string, groupId: string, userIds: string[]): Promise<void> {
    // Delete existing members not in list
    await this.prisma.sCIMGroupMember.deleteMany({
      where: {
        groupId,
        userId: { notIn: userIds },
      },
    });

    // Add new members
    for (const userId of userIds) {
      if (typeof userId === 'string' && userId) {
        await this.prisma.sCIMGroupMember.upsert({
          where: { groupId_userId: { groupId, userId } },
          create: { groupId, userId },
          update: {},
        });
      }
    }
  }

  private async applyGroupRoleMappings(orgId: string, groupName: string): Promise<void> {
    const mapping = await this.prisma.sSOGroupRoleMapping.findUnique({
      where: {
        organizationId_groupName: { organizationId: orgId, groupName },
      },
    });

    if (!mapping) return;

    const group = await this.prisma.sCIMGroup.findUnique({
      where: {
        organizationId_displayName: { organizationId: orgId, displayName: groupName },
      },
      include: { members: true },
    });

    if (!group) return;

    const userIds = group.members.map((m) => m.userId);
    if (userIds.length === 0) return;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { workspaces: true },
    });
    if (!org) return;

    const targetWorkspaces = mapping.targetWorkspaceId
      ? org.workspaces.filter((w) => w.id === mapping.targetWorkspaceId)
      : org.workspaces;

    for (const workspace of targetWorkspaces) {
      await this.prisma.workspaceMember.updateMany({
        where: {
          workspaceId: workspace.id,
          userId: { in: userIds },
        },
        data: { role: mapping.targetRole },
      });
    }

    this.logger.log(`Synced role "${mapping.targetRole}" for ${userIds.length} members in group "${groupName}"`);
  }

  private parseFilter(filter: string): any | null {
    // Handles expressions like: userName eq "foo@bar.com" or active eq true
    const eqMatch = filter.match(/([a-zA-Z0-9.]+)\s+eq\s+["']?([^"']+)["']?/i);
    if (!eqMatch) return null;

    const [, attribute, value] = eqMatch;
    const attrLower = attribute.toLowerCase();

    if (attrLower === 'username' || attrLower === 'emails.value') {
      return { email: { equals: value.toLowerCase(), mode: 'insensitive' } };
    }
    if (attrLower === 'active') {
      const boolVal = value.toLowerCase() === 'true';
      return boolVal
        ? { presence: { not: PresenceStatus.OFFLINE } }
        : { presence: PresenceStatus.OFFLINE };
    }
    if (attrLower === 'displayname' || attrLower === 'name.formatted') {
      return { name: { contains: value, mode: 'insensitive' } };
    }
    return null;
  }

  private async logEnterpriseAudit(
    orgId: string,
    actorEmail: string,
    action: string,
    targetResource: string,
    details: Record<string, unknown>,
  ) {
    try {
      await this.prisma.enterpriseAuditLog.create({
        data: {
          organizationId: orgId,
          actorEmail,
          action,
          targetResource,
          details: JSON.stringify(details),
        },
      });
    } catch {
      // audit logging failure should not abort transaction
    }
  }
}
