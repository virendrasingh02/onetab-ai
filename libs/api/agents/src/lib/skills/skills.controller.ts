import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { SkillCategory, SkillScope } from '@org/types';
import { AgentSkillCompositionService } from './agent-skill-composition.service.js';
import { type CreateCustomSkillInput, SkillBuilderService } from './skill-builder.service.js';
import { SkillImporterService } from './skill-importer.service.js';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillRuntimeService } from './skill-runtime.service.js';

@Controller('workspaces/:workspaceId/skills')
export class SkillsController {
  constructor(
    private readonly registry: SkillRegistryService,
    private readonly runtime: SkillRuntimeService,
    private readonly importer: SkillImporterService,
    private readonly builder: SkillBuilderService,
    private readonly composition: AgentSkillCompositionService,
  ) {}

  @Get()
  async listSkills(
    @Param('workspaceId') workspaceId: string,
    @Query('category') category?: SkillCategory,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: SkillScope,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.registry.listSkills({
      workspaceId,
      category,
      tag,
      search,
      scope,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get(':skillId')
  async getSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('skillId') skillId: string,
  ) {
    return this.registry.getSkill(skillId, workspaceId);
  }

  @Post('import/preview')
  async previewImport(@Body() body: any) {
    return this.importer.previewImport(body);
  }

  @Post('import')
  async importSkills(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.importer.importSkills(body, workspaceId, {
      userId,
      autoInstall: body.autoInstall ?? true,
      approvedPermissions: body.approvedPermissions,
    });
  }

  @Post('custom')
  async createCustomSkill(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateCustomSkillInput,
    @Req() req: any,
  ) {
    const authorName = req.user?.name || req.user?.email || 'User';
    return this.builder.buildAndRegisterSkill(body, workspaceId, authorName);
  }

  @Post('custom/test')
  async testDraftSkill(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { draft: CreateCustomSkillInput; testInput: Record<string, unknown> },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.builder.testDraftSkill(body.draft, body.testInput, workspaceId, userId);
  }

  @Post(':skillId/install')
  async installSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('skillId') skillId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.registry.installSkill(workspaceId, skillId, {
      userId,
      config: body.config,
      approvedPermissions: body.approvedPermissions,
      scope: body.scope,
    });
  }

  @Delete(':skillId/install')
  async uninstallSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('skillId') skillId: string,
  ) {
    await this.registry.uninstallSkill(workspaceId, skillId);
    return { ok: true, uninstalled: skillId };
  }

  @Post(':skillId/toggle')
  async toggleSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('skillId') skillId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.registry.toggleSkill(workspaceId, skillId, body.enabled);
  }

  @Put(':skillId/config')
  async updateConfig(
    @Param('workspaceId') workspaceId: string,
    @Param('skillId') skillId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.registry.updateConfig(workspaceId, skillId, body);
  }

  @Post(':skillId/execute')
  async executeSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('skillId') skillId: string,
    @Body() body: { input: Record<string, unknown>; dryRun?: boolean; configOverrides?: Record<string, unknown> },
    @Req() req: any,
  ) {
    const actingUserId = req.user?.id;
    return this.runtime.executeSkill({
      skillId,
      input: body.input || {},
      workspaceId,
      actingUserId,
      dryRun: body.dryRun ?? false,
      configOverrides: body.configOverrides,
    });
  }

  @Post('seed-social-agents')
  async seedSocialAgents(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const agents = await this.composition.seedSocialMediaAgents(workspaceId, userId);
    return { ok: true, createdCount: agents.length, agents };
  }
}

@Controller('workspaces/:workspaceId/agents/:agentId/skills')
export class AgentSkillsController {
  constructor(private readonly composition: AgentSkillCompositionService) {}

  @Get()
  async getAgentSkills(
    @Param('workspaceId') workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.composition.getAgentSkills(workspaceId, agentId);
  }

  @Put()
  async updateAgentSkills(
    @Param('workspaceId') workspaceId: string,
    @Param('agentId') agentId: string,
    @Body() body: { skills: any[] },
  ) {
    return this.composition.setAgentSkills(workspaceId, agentId, body.skills);
  }

  @Post(':skillId')
  async assignSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('skillId') skillId: string,
    @Body() body: { priority?: number; customConfig?: Record<string, unknown> },
  ) {
    return this.composition.assignSkillToAgent(workspaceId, agentId, skillId, body);
  }

  @Delete(':skillId')
  async removeSkill(
    @Param('workspaceId') workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('skillId') skillId: string,
  ) {
    return this.composition.removeSkillFromAgent(workspaceId, agentId, skillId);
  }
}
