import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { WorkspaceRole, type ConnectorGroup, type ConnectorGroupInput, type ConnectorGroupMember } from '@org/types';
import { ConnectorRegistryService } from './connector-registry.service.js';

const MAX_GROUPS_PER_WORKSPACE = 100;
const MAX_MEMBERS = 30;

/**
 * Connector groups: named sets of connected apps (with the actions switched on
 * for each) that can be handed to an agent in one step and reused as templates.
 *
 * A group holds no credentials — only which apps and actions — so sharing one
 * never shares access: an agent still acts through connections its owner may
 * use. Members are checked against the live connector manifests, so a group
 * can't name an app or action that doesn't exist.
 */
@Injectable()
export class ConnectorGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistryService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<ConnectorGroup[]> {
    const rows = await this.prisma.connectorGroup.findMany({
      where: { workspaceId, OR: [{ isTemplate: true }, { createdById: userId }] },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toGroup(row, userId));
  }

  async create(workspaceId: string, userId: string, input: ConnectorGroupInput): Promise<ConnectorGroup> {
    const count = await this.prisma.connectorGroup.count({ where: { workspaceId } });
    if (count >= MAX_GROUPS_PER_WORKSPACE) {
      throw new BadRequestException(`A workspace can have at most ${MAX_GROUPS_PER_WORKSPACE} connector groups.`);
    }
    const data = await this.clean(workspaceId, userId, input);
    const row = await this.prisma.connectorGroup.create({
      data: { workspaceId, createdById: userId, ...data },
    });
    return this.toGroup(row, userId);
  }

  async update(workspaceId: string, userId: string, id: string, input: ConnectorGroupInput): Promise<ConnectorGroup> {
    await this.assertMayChange(workspaceId, userId, id);
    const data = await this.clean(workspaceId, userId, input);
    const row = await this.prisma.connectorGroup.update({ where: { id }, data });
    return this.toGroup(row, userId);
  }

  async remove(workspaceId: string, userId: string, id: string): Promise<{ deleted: true }> {
    await this.assertMayChange(workspaceId, userId, id);
    await this.prisma.connectorGroup.delete({ where: { id } });
    return { deleted: true };
  }

  /** A copy under the caller's name — how a shared template becomes theirs to edit. */
  async duplicate(workspaceId: string, userId: string, id: string): Promise<ConnectorGroup> {
    const source = await this.prisma.connectorGroup.findFirst({
      where: { id, workspaceId, OR: [{ isTemplate: true }, { createdById: userId }] },
    });
    if (!source) throw new NotFoundException('Connector group not found.');
    const members = (source.members as unknown as ConnectorGroupMember[]).map((m) => ({ ...m, integrationId: null }));
    const row = await this.prisma.connectorGroup.create({
      data: {
        workspaceId,
        createdById: userId,
        name: `${source.name} copy`.slice(0, 80),
        description: source.description,
        isTemplate: false,
        members: members as any,
      },
    });
    return this.toGroup(row, userId);
  }

  private async assertMayChange(workspaceId: string, userId: string, id: string) {
    const row = await this.prisma.connectorGroup.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Connector group not found.');
    if (row.createdById === userId) return row;
    const member = await this.prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (member?.role === WorkspaceRole.ADMIN || member?.role === WorkspaceRole.OWNER) return row;
    throw new ForbiddenException('Only the group’s creator or a workspace admin can change it.');
  }

  /** Validated, de-duplicated fields ready to store. */
  private async clean(workspaceId: string, userId: string, input: ConnectorGroupInput) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('Give the group a name.');
    if (name.length > 80) throw new BadRequestException('A group name can be at most 80 characters.');
    if (!Array.isArray(input.members) || input.members.length === 0) {
      throw new BadRequestException('Add at least one app to the group.');
    }
    if (input.members.length > MAX_MEMBERS) throw new BadRequestException(`A group can hold at most ${MAX_MEMBERS} apps.`);

    const members: ConnectorGroupMember[] = [];
    const seen = new Set<string>();
    for (const raw of input.members) {
      const provider = String(raw.provider ?? '').trim().toUpperCase();
      if (seen.has(provider)) throw new BadRequestException(`${provider} is in the group twice.`);
      seen.add(provider);
      let manifest;
      try {
        manifest = this.registry.manifest(provider);
      } catch {
        throw new BadRequestException(`“${raw.provider}” isn’t a known app.`);
      }
      const known = new Set(manifest.capabilities.map((c) => c.id));
      const actions = raw.actions === null || raw.actions === undefined ? null : [...new Set(raw.actions)];
      const askBefore = [...new Set(raw.askBefore ?? [])];
      for (const id of [...(actions ?? []), ...askBefore]) {
        if (!known.has(id)) throw new BadRequestException(`${manifest.name} has no action “${id}”.`);
      }
      let integrationId: string | null = null;
      if (raw.integrationId) {
        const visible = await this.prisma.externalIntegration.findFirst({
          where: {
            id: raw.integrationId,
            provider,
            OR: [{ workspaceId, scopeType: { not: 'USER' } }, { scopeType: 'USER', userId }],
          },
          select: { id: true },
        });
        if (!visible) throw new BadRequestException(`That ${manifest.name} connection isn’t available to you.`);
        integrationId = visible.id;
      }
      members.push({ provider, integrationId, enabled: raw.enabled !== false, actions, ...(askBefore.length ? { askBefore } : {}) });
    }

    return {
      name,
      description: input.description?.trim() ? input.description.trim().slice(0, 300) : null,
      isTemplate: input.isTemplate === true,
      members: members as any,
    };
  }

  private toGroup(
    row: {
      id: string;
      workspaceId: string;
      name: string;
      description: string | null;
      isTemplate: boolean;
      createdById: string;
      members: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    userId: string,
  ): ConnectorGroup {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description,
      isTemplate: row.isTemplate,
      createdById: row.createdById,
      mine: row.createdById === userId,
      members: Array.isArray(row.members) ? (row.members as unknown as ConnectorGroupMember[]) : [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
