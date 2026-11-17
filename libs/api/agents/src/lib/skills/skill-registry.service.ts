import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  SkillCategory,
  SkillInstallation,
  SkillInstallStatus,
  SkillPackage,
  SkillScope,
} from '@org/types';
import { validateSkillPackage } from '@org/validation';
import { ALL_SEEDED_SKILLS } from './social/social-skills.seeds.js';

export interface SkillQueryOptions {
  workspaceId?: string;
  category?: SkillCategory;
  tag?: string;
  search?: string;
  scope?: SkillScope;
  status?: SkillInstallStatus;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SkillRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistryService.name);

  /** In-memory global catalog cache */
  private readonly globalSkills = new Map<string, SkillPackage>();
  /** Workspace installs: map of `${workspaceId}:${skillId}` -> SkillInstallation */
  private readonly workspaceInstalls = new Map<string, SkillInstallation>();
  /** Custom workspace skills: map of `${workspaceId}:${skillId}` -> SkillPackage */
  private readonly workspaceCustomSkills = new Map<string, SkillPackage>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.seedGlobalSkills();
  }

  private seedGlobalSkills() {
    for (const skill of ALL_SEEDED_SKILLS) {
      const validation = validateSkillPackage(skill);
      if (validation.ok) {
        this.globalSkills.set(skill.id, validation.manifest);
      } else {
        this.logger.warn(`Failed validating seeded skill '${skill.id}': ${validation.errors.join(', ')}`);
      }
    }
    this.logger.log(`Initialized SkillRegistry with ${this.globalSkills.size} global skills.`);
  }

  /** Register or update a custom skill package */
  async registerSkill(
    skill: SkillPackage,
    scope: SkillScope = 'WORKSPACE',
    workspaceId?: string,
  ): Promise<SkillPackage> {
    const validation = validateSkillPackage(skill);
    if (!validation.ok) {
      throw new BadRequestException(
        `Invalid skill package manifest: ${validation.errors.join('; ')}`,
      );
    }
    const manifest = validation.manifest;

    if (scope === 'GLOBAL') {
      this.globalSkills.set(manifest.id, manifest);
      this.logger.log(`Registered global skill '${manifest.id}'`);
      return manifest;
    }

    if (!workspaceId) {
      throw new BadRequestException('Workspace ID required for workspace-scoped skill.');
    }

    const key = `${workspaceId}:${manifest.id}`;
    this.workspaceCustomSkills.set(key, manifest);

    // Also persist into MarketplaceListing (kind: SKILL) if not existing
    try {
      await this.prisma.marketplaceListing.upsert({
        where: { slug: `skill-${workspaceId}-${manifest.id}` },
        update: {
          name: manifest.name,
          description: manifest.description,
          category: manifest.category,
          version: manifest.version,
          tags: JSON.stringify(manifest.tags),
          manifestJson: JSON.stringify(manifest),
        },
        create: {
          kind: 'SKILL',
          slug: `skill-${workspaceId}-${manifest.id}`,
          name: manifest.name,
          tagline: manifest.description.slice(0, 100),
          description: manifest.instructions || manifest.description,
          category: manifest.category,
          version: manifest.version,
          tags: JSON.stringify(manifest.tags),
          manifestJson: JSON.stringify(manifest),
          visibility: 'WORKSPACE',
          ownerWorkspaceId: workspaceId,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not persist skill to database listing: ${err.message}`);
    }

    this.logger.log(`Registered workspace skill '${manifest.id}' in workspace ${workspaceId}`);
    return manifest;
  }

  /** Retrieve a skill by ID (checks workspace custom skills first, then global) */
  async getSkill(skillId: string, workspaceId?: string): Promise<SkillPackage> {
    if (workspaceId) {
      const custom = this.workspaceCustomSkills.get(`${workspaceId}:${skillId}`);
      if (custom) return custom;
    }
    const globalSkill = this.globalSkills.get(skillId);
    if (globalSkill) return globalSkill;

    // Check DB marketplace listing
    if (workspaceId) {
      const listing = await this.prisma.marketplaceListing.findFirst({
        where: {
          kind: 'SKILL',
          OR: [
            { slug: `skill-${workspaceId}-${skillId}` },
            { slug: `skill-${skillId}` },
          ],
        },
      });
      if (listing?.manifestJson) {
        try {
          const parsed = JSON.parse(listing.manifestJson);
          return parsed as SkillPackage;
        } catch {
          // ignore
        }
      }
    }

    throw new NotFoundException(`Skill '${skillId}' was not found in registry.`);
  }

  /** List skills matching filter options */
  async listSkills(options: SkillQueryOptions = {}): Promise<{
    items: Array<SkillPackage & { installation?: SkillInstallation }>;
    total: number;
  }> {
    const { workspaceId, category, tag, search, scope, limit = 50, offset = 0 } = options;

    const allSkills: SkillPackage[] = [];

    // Include global skills
    if (!scope || scope === 'GLOBAL') {
      allSkills.push(...Array.from(this.globalSkills.values()));
    }

    // Include workspace custom skills
    if (workspaceId && (!scope || scope === 'WORKSPACE')) {
      for (const [key, skill] of this.workspaceCustomSkills.entries()) {
        if (key.startsWith(`${workspaceId}:`)) {
          allSkills.push(skill);
        }
      }
    }

    // Filter
    let filtered = allSkills;
    if (category) {
      filtered = filtered.filter((s) => s.category === category);
    }
    if (tag) {
      filtered = filtered.filter((s) => s.tags?.includes(tag));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Deduplicate by ID (workspace custom overrides global)
    const uniqueMap = new Map<string, SkillPackage>();
    for (const item of filtered) {
      uniqueMap.set(item.id, item);
    }
    const itemsList = Array.from(uniqueMap.values());
    const total = itemsList.length;
    const paged = itemsList.slice(offset, offset + limit);

    // Attach installation status if workspaceId provided
    const items = paged.map((skill) => {
      const installation = workspaceId
        ? this.getInstallation(workspaceId, skill.id)
        : undefined;
      return {
        ...skill,
        installation,
      };
    });

    return { items, total };
  }

  /** Install skill into workspace */
  async installSkill(
    workspaceId: string,
    skillId: string,
    options: {
      userId?: string;
      config?: Record<string, unknown>;
      approvedPermissions?: string[];
      scope?: SkillScope;
    } = {},
  ): Promise<SkillInstallation> {
    const skill = await this.getSkill(skillId, workspaceId);
    const key = `${workspaceId}:${skillId}`;

    const existing = this.workspaceInstalls.get(key);
    if (existing && existing.status === 'ACTIVE') {
      return existing;
    }

    const installRecord: SkillInstallation = {
      id: `inst-${workspaceId}-${skillId}`,
      skillId,
      workspaceId,
      version: skill.version,
      status: 'ACTIVE',
      scope: options.scope ?? 'WORKSPACE',
      installedById: options.userId ?? null,
      config: options.config ?? {},
      approvedPermissions:
        options.approvedPermissions ??
        skill.permissions.map((p) => p.scope),
      health: { ok: true, message: 'Skill active and healthy', checkedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workspaceInstalls.set(key, installRecord);

    // Mirror to MarketplaceInstallation DB record if possible
    try {
      const listing = await this.prisma.marketplaceListing.findFirst({
        where: {
          kind: 'SKILL',
          OR: [
            { slug: `skill-${workspaceId}-${skillId}` },
            { slug: `skill-${skillId}` },
          ],
        },
      });
      if (listing) {
        await this.prisma.marketplaceInstallation.upsert({
          where: {
            id: installRecord.id,
          },
          update: {
            status: 'ACTIVE',
            settingsJson: JSON.stringify(installRecord.config),
            approvedPermissions: JSON.stringify(installRecord.approvedPermissions),
          },
          create: {
            id: installRecord.id,
            listingId: listing.id,
            workspaceId,
            installedById: options.userId,
            version: skill.version,
            status: 'ACTIVE',
            settingsJson: JSON.stringify(installRecord.config),
            approvedPermissions: JSON.stringify(installRecord.approvedPermissions),
          },
        });
      }
    } catch {
      // ignore
    }

    this.logger.log(`Installed skill '${skillId}' in workspace ${workspaceId}`);
    return installRecord;
  }

  /** Uninstall skill from workspace */
  async uninstallSkill(workspaceId: string, skillId: string): Promise<void> {
    const key = `${workspaceId}:${skillId}`;
    this.workspaceInstalls.delete(key);
    this.logger.log(`Uninstalled skill '${skillId}' from workspace ${workspaceId}`);
  }

  /** Toggle skill enabled / disabled */
  async toggleSkill(
    workspaceId: string,
    skillId: string,
    enabled: boolean,
  ): Promise<SkillInstallation> {
    const key = `${workspaceId}:${skillId}`;
    let install = this.workspaceInstalls.get(key);
    if (!install) {
      install = await this.installSkill(workspaceId, skillId);
    }
    install.status = enabled ? 'ACTIVE' : 'DISABLED';
    install.updatedAt = new Date().toISOString();
    this.workspaceInstalls.set(key, install);
    return install;
  }

  /** Update installation configuration */
  async updateConfig(
    workspaceId: string,
    skillId: string,
    config: Record<string, unknown>,
  ): Promise<SkillInstallation> {
    const key = `${workspaceId}:${skillId}`;
    const install = this.workspaceInstalls.get(key);
    if (!install) {
      throw new NotFoundException(`Skill '${skillId}' is not installed in workspace.`);
    }
    install.config = { ...install.config, ...config };
    install.updatedAt = new Date().toISOString();
    this.workspaceInstalls.set(key, install);
    return install;
  }

  /** Pin specific version */
  async pinVersion(
    workspaceId: string,
    skillId: string,
    version: string,
  ): Promise<SkillInstallation> {
    const key = `${workspaceId}:${skillId}`;
    const install = this.workspaceInstalls.get(key);
    if (!install) {
      throw new NotFoundException(`Skill '${skillId}' is not installed in workspace.`);
    }
    install.pinnedVersion = version;
    install.updatedAt = new Date().toISOString();
    return install;
  }

  getInstallation(workspaceId: string, skillId: string): SkillInstallation | undefined {
    return this.workspaceInstalls.get(`${workspaceId}:${skillId}`);
  }
}
