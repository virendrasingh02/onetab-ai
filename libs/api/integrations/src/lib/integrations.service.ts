import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';

/**
 * Fields safe to send to a browser.
 *
 * `accessToken` is deliberately absent: it is a third-party credential, and
 * nothing in the UI needs its value — only whether a provider is connected.
 * Returning it would put a live OAuth token inside reach of any script on the
 * page.
 */
const INTEGRATION_SELECT = {
  id: true,
  workspaceId: true,
  provider: true,
  status: true,
  configJson: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConnectedIntegrations(workspaceId: string) {
    return this.prisma.externalIntegration.findMany({
      where: { workspaceId },
      select: INTEGRATION_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async connectProvider(
    workspaceId: string,
    provider: string,
    accessToken?: string,
    config: Record<string, unknown> = {},
  ) {
    this.logger.log(
      `Connecting integration provider '${provider}' for workspace ${workspaceId}`,
    );
    return this.prisma.externalIntegration.upsert({
      where: { id: `${workspaceId}_${provider}` },
      create: {
        id: `${workspaceId}_${provider}`,
        workspaceId,
        provider,
        status: 'CONNECTED',
        accessToken,
        configJson: JSON.stringify(config),
      },
      update: {
        status: 'CONNECTED',
        accessToken,
        configJson: JSON.stringify(config),
      },
      select: INTEGRATION_SELECT,
    });
  }

  /**
   * Marks a provider disconnected and drops the stored credential.
   *
   * Keeping the token on a disconnected row would leave a usable credential
   * sitting in the database with nothing in the UI admitting it is there.
   */
  async disconnectProvider(workspaceId: string, provider: string) {
    const result = await this.prisma.externalIntegration.updateMany({
      where: { workspaceId, provider },
      data: { status: 'DISCONNECTED', accessToken: null },
    });

    if (result.count === 0) {
      throw new NotFoundException('That provider is not connected.');
    }

    return { count: result.count };
  }
}
