import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type ConnectorEventReceivedEvent, type GithubPullRequestEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { memberPreferenceOn } from './core/member-preference.js';

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Turns a verified GitHub pull-request push (`ConnectorWebhookService` has
 * already checked the signature against the connection and resolved its
 * workspace) into `github.pull_request`, which workflows trigger on — only
 * while the connection owner's "GitHub PR event webhook" switch is on. The
 * switch is per member and per workspace, so it follows whoever connected
 * GitHub; a connection with no owner uses the Settings default (on).
 */
@Injectable()
export class GithubEventsListener {
  private readonly logger = new Logger(GithubEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(AppEvent.ConnectorEventReceived, { async: true })
  async onEvent(event: ConnectorEventReceivedEvent): Promise<void> {
    if (event.provider !== 'GITHUB' || !event.workspaceId) return;
    try {
      if (event.triggerId === 'pull_request') await this.onPullRequest(event as ConnectorEventReceivedEvent & { workspaceId: string });
    } catch (error) {
      this.logger.warn(`Handling a GitHub ${event.triggerId} event failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async owner(integrationId: string): Promise<string | null> {
    const row = await this.prisma.externalIntegration.findUnique({ where: { id: integrationId }, select: { userId: true } });
    return row?.userId ?? null;
  }

  private async onPullRequest(event: ConnectorEventReceivedEvent & { workspaceId: string }): Promise<void> {
    const owner = await this.owner(event.integrationId);
    if (!(await memberPreferenceOn(this.prisma, event.workspaceId, owner, 'githubPRWebhook', true))) return;
    const i = event.item;
    const payload: GithubPullRequestEvent = {
      workspaceId: event.workspaceId,
      actorId: null,
      integrationId: event.integrationId,
      action: str(i['action']) ?? 'opened',
      number: typeof i['number'] === 'number' ? i['number'] : 0,
      title: str(i['title']) ?? '',
      url: str(i['url']),
      author: str(i['author']),
      repository: str(i['repository']) ?? '',
      baseBranch: str(i['baseBranch']),
      headBranch: str(i['headBranch']),
      merged: i['merged'] === true,
      draft: i['draft'] === true,
    };
    this.events.emit(AppEvent.GithubPullRequest, payload);
  }
}
