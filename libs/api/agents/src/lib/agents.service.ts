import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AIInfrastructureService } from '@org/api-ai';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
    private readonly mcpRegistry: MCPToolRegistryService
  ) {}

  async getAgents(workspaceId: string) {
    return this.prisma.aIAgent.findMany({
      where: { workspaceId },
      include: { schedules: true, _count: { select: { logs: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMarketplaceAgents() {
    return [
      {
        id: 'market_1',
        name: 'Agile Sprint Manager',
        role: 'Scrum Master',
        description: 'Auto-summarizes task progress, flags overdue tasks, and organizes sprint backlogs.',
        systemPrompt: 'You are an expert Agile Scrum Master agent.',
        tools: JSON.stringify(['create_task', 'search_docs', 'send_channel_message']),
      },
      {
        id: 'market_2',
        name: 'Code Sentinel & Reviewer',
        role: 'Tech Lead',
        description: 'Reviews code pull requests, checks security issues, and writes documentation.',
        systemPrompt: 'You are a senior tech lead agent.',
        tools: JSON.stringify(['search_docs', 'send_channel_message']),
      },
      {
        id: 'market_3',
        name: 'Workspace Knowledge Curator',
        role: 'Docs Architect',
        description: 'Indexes workspace documents into RAG vector storage and answers queries.',
        systemPrompt: 'You are a knowledge manager agent.',
        tools: JSON.stringify(['search_docs']),
      },
    ];
  }

  async createAgent(workspaceId: string, creatorId: string, data: { name: string; role?: string; description?: string; systemPrompt?: string; provider?: string; model?: string; tools?: string[] }) {
    return this.prisma.aIAgent.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name,
        role: data.role ?? 'Assistant',
        description: data.description,
        systemPrompt: data.systemPrompt ?? 'You are an autonomous AI employee.',
        provider: data.provider ?? 'ollama',
        model: data.model ?? 'llama3',
        tools: JSON.stringify(data.tools ?? ['search_docs', 'create_task']),
      },
    });
  }

  async executeAgent(agentId: string, promptText: string) {
    const agent = await this.prisma.aIAgent.findUniqueOrThrow({ where: { id: agentId } });
    this.logger.log(`Executing AI Agent '${agent.name}' (${agent.id})`);
    const availableTools = this.mcpRegistry.getToolDefinitions();

    const chatResult = await this.aiService.chat({
      provider: agent.provider as any,
      model: agent.model,
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: promptText },
      ],
    });

    const executionLog = await this.prisma.agentExecutionLog.create({
      data: {
        agentId: agent.id,
        status: 'SUCCESS',
        promptText,
        outputResult: chatResult.message.content,
        toolCalls: JSON.stringify(availableTools),
        tokensUsed: 140,
      },
    });

    return {
      agentName: agent.name,
      result: chatResult.message.content,
      logId: executionLog.id,
    };
  }

  async getExecutionLogs(agentId: string) {
    return this.prisma.agentExecutionLog.findMany({
      where: { agentId },
      orderBy: { executedAt: 'desc' },
      take: 20,
    });
  }
}
