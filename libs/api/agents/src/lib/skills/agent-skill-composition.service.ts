import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  AgentSkillBinding,
  SkillPackage,
} from '@org/types';
import { MCPToolDefinition, MCPToolRegistryService } from '../mcp-tool-registry.service.js';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillRuntimeService } from './skill-runtime.service.js';

export interface PrebuiltAgentProfile {
  name: string;
  role: string;
  description: string;
  avatarUrl?: string;
  systemPrompt: string;
  provider: string;
  model: string;
  tools: string[];
  skills: Array<{ skillId: string; priority: number }>;
}

export const YOUTUBE_AGENT_PROFILE: PrebuiltAgentProfile = {
  name: 'YouTube Content Strategist',
  role: 'YouTube Video & Audience Growth Specialist',
  description:
    'Configuration-driven AI agent specialized in viral video scripting (21 hook formulas), title/thumbnail packaging, audience retention, and community growth.',
  systemPrompt: `You are the YouTube Content Strategist AI agent. You help creators brainstorm breakout video ideas, write high-retention video scripts, evaluate hooks, optimize titles/thumbnails, and analyze channel performance. Use your assigned skills and YouTube tools to deliver high-retention content.`,
  provider: 'ollama',
  model: 'llama3',
  tools: ['search_docs', 'create_doc', 'create_task'],
  skills: [
    { skillId: 'yt-script', priority: 1 },
    { skillId: 'yt-hookscore', priority: 2 },
    { skillId: 'yt-package', priority: 3 },
    { skillId: 'yt-retention', priority: 4 },
    { skillId: 'yt-seo', priority: 5 },
    { skillId: 'yt-shorts', priority: 6 },
    { skillId: 'yt-viral', priority: 7 },
  ],
};

export const LINKEDIN_AGENT_PROFILE: PrebuiltAgentProfile = {
  name: 'LinkedIn Thought Leader',
  role: 'B2B Brand & Organic Reach Specialist',
  description:
    'Configuration-driven AI agent specialized in organic LinkedIn posts (21 hook formulas), anti-AI humanization, carousel slide decks, and thought leadership calendars.',
  systemPrompt: `You are the LinkedIn Thought Leader AI agent. You engineer high-impact professional posts with line-break pacing, strip robotic AI fingerprints, design carousel slide decks, and craft substantive comment replies. Use your assigned skills and LinkedIn tools to expand professional reach.`,
  provider: 'ollama',
  model: 'llama3',
  tools: ['search_docs', 'create_doc', 'create_task'],
  skills: [
    { skillId: 'li-post', priority: 1 },
    { skillId: 'li-human', priority: 2 },
    { skillId: 'li-carousel', priority: 3 },
    { skillId: 'li-plan', priority: 4 },
    { skillId: 'li-profile', priority: 5 },
    { skillId: 'li-reply', priority: 6 },
  ],
};

export const INSTAGRAM_AGENT_PROFILE: PrebuiltAgentProfile = {
  name: 'Instagram Growth Specialist',
  role: 'Visual Content & Reels Strategist',
  description:
    'Configuration-driven AI agent specialized in viral Reels scripts (26 hook formulas), high-save carousels, engaging captions, and interactive Story sequences.',
  systemPrompt: `You are the Instagram Growth Specialist AI agent. You write viral 15-60 second Reel scripts with visual cues, design 10-slide carousels, craft save-worthy captions, and structure interactive Story sequences. Use your assigned skills and Instagram tools to drive engagement.`,
  provider: 'ollama',
  model: 'llama3',
  tools: ['search_docs', 'create_doc', 'create_task'],
  skills: [
    { skillId: 'ig-reel', priority: 1 },
    { skillId: 'ig-caption', priority: 2 },
    { skillId: 'ig-carousel', priority: 3 },
    { skillId: 'ig-story', priority: 4 },
    { skillId: 'ig-human', priority: 5 },
    { skillId: 'ig-viral', priority: 6 },
  ],
};

@Injectable()
export class AgentSkillCompositionService {
  private readonly logger = new Logger(AgentSkillCompositionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SkillRegistryService,
    private readonly runtime: SkillRuntimeService,
    private readonly mcpRegistry: MCPToolRegistryService,
  ) {
    this.registerUniversalSkillTool();
  }

  /**
   * Registers the universal `execute_skill` meta-tool into the MCP tool registry,
   * enabling ANY agent to dynamically execute any of its assigned skills.
   */
  private registerUniversalSkillTool() {
    const skillTool: MCPToolDefinition = {
      name: 'execute_skill',
      description:
        'Executes an assigned AI skill by ID (e.g. yt-script, yt-hookscore, li-post, ig-reel) with input parameters.',
      parameters: {
        skillId: { type: 'string', description: 'Unique identifier of the skill to execute' },
        input: { type: 'object', description: 'Input parameters required by the skill' },
      },
      handler: async (
        params: { skillId: string; input?: Record<string, unknown> },
        ctx,
      ) => {
        return this.runtime.executeSkill({
          skillId: params.skillId,
          input: params.input || {},
          workspaceId: ctx.workspaceId,
          actingUserId: ctx.actingUserId ?? undefined,
          agentId: ctx.agentId ?? undefined,
        });
      },
    };

    (this.mcpRegistry as any).tools.set('execute_skill', skillTool);
    this.logger.log('Registered universal `execute_skill` tool in MCPToolRegistry.');
  }

  /**
   * Retrieves an agent's assigned skills list.
   */
  async getAgentSkills(workspaceId: string, agentId: string): Promise<AgentSkillBinding[]> {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: { configuration: true },
    });
    if (!agent) {
      throw new NotFoundException(`Agent '${agentId}' not found in workspace.`);
    }

    const config = (agent.configuration as Record<string, unknown>) || {};
    const skills = (config['skills'] as AgentSkillBinding[]) || [];
    return skills.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Updates an agent's assigned skills with new bindings and priorities.
   */
  async setAgentSkills(
    workspaceId: string,
    agentId: string,
    skills: AgentSkillBinding[],
  ): Promise<AgentSkillBinding[]> {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: { id: true, configuration: true },
    });
    if (!agent) {
      throw new NotFoundException(`Agent '${agentId}' not found in workspace.`);
    }

    const config = (agent.configuration as Record<string, unknown>) || {};
    const updatedSkills = skills.map((s, index) => ({
      ...s,
      priority: s.priority ?? index + 1,
    }));

    await this.prisma.aIAgent.update({
      where: { id: agentId },
      data: {
        configuration: {
          ...config,
          skills: updatedSkills,
        },
      },
    });

    this.logger.log(`Updated ${updatedSkills.length} skills for agent '${agentId}'`);
    return updatedSkills;
  }

  /**
   * Attaches a skill to an agent.
   */
  async assignSkillToAgent(
    workspaceId: string,
    agentId: string,
    skillId: string,
    options: { priority?: number; customConfig?: Record<string, unknown> } = {},
  ): Promise<AgentSkillBinding[]> {
    const existingSkills = await this.getAgentSkills(workspaceId, agentId);
    // Ensure skill exists
    await this.registry.getSkill(skillId, workspaceId);

    const filtered = existingSkills.filter((s) => s.skillId !== skillId);
    const newBinding: AgentSkillBinding = {
      skillId,
      enabled: true,
      priority: options.priority ?? filtered.length + 1,
      customConfig: options.customConfig,
    };

    return this.setAgentSkills(workspaceId, agentId, [...filtered, newBinding]);
  }

  /**
   * Removes a skill from an agent.
   */
  async removeSkillFromAgent(
    workspaceId: string,
    agentId: string,
    skillId: string,
  ): Promise<AgentSkillBinding[]> {
    const existingSkills = await this.getAgentSkills(workspaceId, agentId);
    const updated = existingSkills.filter((s) => s.skillId !== skillId);
    return this.setAgentSkills(workspaceId, agentId, updated);
  }

  /**
   * Builds the composite prompt and dynamic toolset for an agent execution turn.
   */
  async buildAgentSkillContext(
    workspaceId: string,
    agentId: string,
  ): Promise<{
    skillInstructionsPrompt: string;
    resolvedSkills: SkillPackage[];
    availableSkillIds: string[];
  }> {
    const bindings = await this.getAgentSkills(workspaceId, agentId);
    const enabledBindings = bindings.filter((b) => b.enabled);

    const resolvedSkills: SkillPackage[] = [];
    const promptSections: string[] = [];

    for (const binding of enabledBindings) {
      try {
        const skill = await this.registry.getSkill(binding.skillId, workspaceId);
        resolvedSkills.push(skill);

        promptSections.push(
          `### Skill: ${skill.name} (id: ${skill.id})
Category: ${skill.category}
Description: ${skill.description}
Guidance:
${skill.instructions}
${skill.templates?.['voice.md'] ? `Voice & Style Rules:\n${skill.templates['voice.md']}` : ''}`,
        );
      } catch {
        // Skill might have been removed
      }
    }

    const skillInstructionsPrompt =
      promptSections.length > 0
        ? `\n\n## ASSIGNED SPECIALIST SKILLS\nYou have been equipped with the following specialized skills. Use them when addressing user requests:\n${promptSections.join('\n\n')}`
        : '';

    return {
      skillInstructionsPrompt,
      resolvedSkills,
      availableSkillIds: resolvedSkills.map((s) => s.id),
    };
  }

  /**
   * Seeds the three real-world validation social media agents:
   * 1. YouTube Content Strategist
   * 2. LinkedIn Thought Leader
   * 3. Instagram Growth Specialist
   */
  async seedSocialMediaAgents(workspaceId: string, creatorId?: string) {
    const profiles = [
      YOUTUBE_AGENT_PROFILE,
      LINKEDIN_AGENT_PROFILE,
      INSTAGRAM_AGENT_PROFILE,
    ];

    const results = [];
    for (const profile of profiles) {
      // Check if already created
      let agent = await this.prisma.aIAgent.findFirst({
        where: {
          workspaceId,
          name: profile.name,
        },
      });

      if (!agent) {
        agent = await this.prisma.aIAgent.create({
          data: {
            workspaceId,
            creatorId,
            name: profile.name,
            role: profile.role,
            description: profile.description,
            systemPrompt: profile.systemPrompt,
            provider: profile.provider,
            model: profile.model,
            tools: JSON.stringify(profile.tools),
            configuration: {
              skills: profile.skills.map((s) => ({
                skillId: s.skillId,
                enabled: true,
                priority: s.priority,
              })),
            },
          },
        });
        this.logger.log(`Created prebuilt social agent '${profile.name}' in workspace ${workspaceId}`);
      }
      results.push(agent);
    }
    return results;
  }
}
