import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AICredentialService, AIInfrastructureService } from '@org/api-ai';
import {
  AppMatrixBridgeService,
  IntegrationsService,
  type AppChatRequest,
} from '@org/api-integrations';
import { MatrixAdminService, MatrixBotMessagingService } from '@org/api-matrix';
import {
  connectorToolName,
  getAppDisplayName,
  getAppLogoUrl,
  splitAppConnectionName,
  type AIAgentMessageContent,
  type AIChatMessage,
  type AIProvider,
  type AgentToolExecution,
  type AppActionDefinition,
} from '@org/types';

const MAX_ROUNDS = 5;
const MAX_RESULT_CHARS = 6_000;

function parseArguments(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Lets a connected app (Asana, GitHub, Linear…) work agentically in chat:
 * "@asana add a task to Launch for Friday" is planned by the model against the
 * app's own registered actions and run through `IntegrationsService`, so
 * permission checks, input validation, credentials and audit all behave exactly
 * as they do for a button or a `/command`.
 *
 * The person typing the request is the approval for what they asked: writes
 * run with their consent but under their own access (`assertIntegrationAccess`
 * with `manage`), and the model is told to do only what was asked.
 */
@Injectable()
export class AppChatAgentService implements OnModuleInit {
  private readonly logger = new Logger(AppChatAgentService.name);

  constructor(
    private readonly bridge: AppMatrixBridgeService,
    private readonly integrations: IntegrationsService,
    private readonly ai: AIInfrastructureService,
    private readonly credentials: AICredentialService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly admin: MatrixAdminService,
  ) {}

  onModuleInit(): void {
    this.bridge.setPlanner((request) => this.run(request));
  }

  private async run(request: AppChatRequest): Promise<void> {
    const { integration, roomId, userId, text, threadRootId, channel } = request;
    const botId = integration.matrixUserId;
    const workspaceId = integration.workspaceId ?? undefined;
    if (!botId) return;
    // The connection name is "Asana · balram"; the reply is from "Asana".
    const { accountLabel } = splitAppConnectionName(integration.displayName ?? '');
    const appName = getAppDisplayName(integration);

    try {
      await this.admin.joinRoomAs(botId, roomId);
    } catch {
      // Already joined.
    }

    const actions = (await this.integrations.getActions(
      integration.id,
      userId,
      workspaceId,
    )) as AppActionDefinition[];
    if (actions.length === 0) {
      throw new Error(`${appName} has no actions to run from chat yet.`);
    }

    const provider = (process.env['APP_CHAT_PROVIDER'] || 'nvidia') as AIProvider;
    const credential = await this.credentials.resolveCredential(provider, { workspaceId });
    if (!credential.apiKey) {
      throw new Error(
        'No AI model is configured for this workspace, so plain-language requests are unavailable. You can still run an action directly, e.g. /' +
          `${integration.provider.toLowerCase()} ${actions[0]!.id} {…}.`,
      );
    }
    const model = process.env['APP_CHAT_MODEL'] || credential.defaultModel || undefined;

    const byTool = new Map<string, AppActionDefinition>();
    const tools = actions.map((definition) => {
      const name = connectorToolName(integration.provider, definition.id);
      byTool.set(name, definition);
      return {
        type: 'function',
        function: {
          name,
          description: definition.description ? `${definition.label} — ${definition.description}` : definition.label,
          parameters: definition.inputSchema ?? { type: 'object', properties: {} },
        },
      };
    });

    const startedAt = Date.now();
    const base: Omit<
      AIAgentMessageContent,
      'status' | 'tools' | 'responseText' | 'errorMessage' | 'completedAt'
    > = {
      type: 'mie.ai.agent',
      agentId: integration.id,
      agentName: appName,
      agentRole: 'App',
      agentKind: 'app',
      appProvider: integration.provider,
      appAccountLabel: accountLabel,
      agentAvatarUrl: getAppLogoUrl(integration.provider, appName),
      workspaceId,
      model: model ?? provider,
      startedAt,
      title: `${appName} · App`,
    };
    const opts = { threadRootId };
    const eventId = await this.messaging.sendStructured(roomId, botId, { ...base, status: 'running' }, opts);
    const trace: AgentToolExecution[] = [];
    const publish = (patch: Record<string, unknown>) =>
      this.messaging.updateStructured(roomId, botId, eventId, { ...base, tools: trace, ...patch } as never, opts);

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: [
          `You are ${appName}, a connected app working inside a team chat${channel ? ` (channel #${channel.name})` : ''}.`,
          `Use the provided tools to do exactly what the person asks in ${appName}. Look things up before changing them (e.g. find the project or task id first), never invent ids, and do not change anything that was not requested.`,
          'If something needed is ambiguous or missing, ask one short question instead of guessing.',
          `Today is ${new Date().toISOString().slice(0, 10)}. Reply briefly in plain text; link to what you created or changed when a url is available.`,
        ].join('\n'),
      },
      { role: 'user', content: text },
    ];

    try {
      let reply = '';
      for (let round = 0; round <= MAX_ROUNDS; round++) {
        const response = await this.ai.chat({
          provider,
          model,
          apiKey: credential.apiKey,
          baseUrl: credential.baseUrl,
          messages,
          // The last round must answer, not ask for more tools.
          tools: round < MAX_ROUNDS ? tools : undefined,
        });
        const calls = response.message.toolCalls ?? [];
        if (calls.length === 0 || round === MAX_ROUNDS) {
          reply = response.message.content;
          break;
        }
        messages.push(response.message);
        for (const call of calls) {
          const definition = byTool.get(call.function.name);
          const input = parseArguments(call.function.arguments);
          const entry: AgentToolExecution = {
            id: call.id,
            name: definition?.label ?? call.function.name,
            status: 'running',
            input,
          };
          trace.push(entry);
          await publish({ status: 'running' });
          const toolStart = Date.now();
          let content: string;
          try {
            if (!definition) throw new Error(`${appName} has no action '${call.function.name}'.`);
            const result = await this.integrations.executeAction(
              integration.id,
              definition.id,
              input,
              true,
              userId,
              workspaceId,
            );
            entry.status = result.success ? 'success' : 'failed';
            entry.output = result.data ?? result.message;
            if (!result.success) entry.error = result.message;
            content = JSON.stringify({ success: result.success, message: result.message, data: result.data });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            entry.status = 'failed';
            entry.error = message;
            content = JSON.stringify({ error: message });
          }
          entry.durationMs = Date.now() - toolStart;
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.function.name,
            content: content.length > MAX_RESULT_CHARS ? `${content.slice(0, MAX_RESULT_CHARS)}…[truncated]` : content,
          });
        }
        await publish({ status: 'running' });
      }

      await publish({
        status: 'completed',
        responseText: reply || 'Done.',
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`App chat turn failed for ${integration.id}: ${message}`);
      await publish({
        status: 'failed',
        errorMessage: message,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
      });
    }
  }
}
