import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { createHmac, randomBytes } from 'node:crypto';
import type {
  AgentDeploymentWebhookView,
  AgentWebhookDeliveryView,
} from '@org/types';
import type { CreateAgentDeploymentWebhookInput } from '@org/validation';

@Injectable()
export class AgentDeploymentWebhookService {
  private readonly logger = new Logger(AgentDeploymentWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  generateSecret(): string {
    return `whsec_${randomBytes(20).toString('hex')}`;
  }

  /**
   * SSRF Guard: validates destination URL to prevent internal probing
   */
  validateDestinationUrl(targetUrl: string, allowPrivateForDev = true): boolean {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      const hostname = parsed.hostname.toLowerCase();

      // In production or when strict, block internal/private networks
      if (!allowPrivateForDev || process.env['NODE_ENV'] === 'production') {
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('169.254.')
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async listWebhooks(deploymentId: string): Promise<AgentDeploymentWebhookView[]> {
    const webhooks = await this.prisma.agentDeploymentWebhook.findMany({
      where: { deploymentId },
      include: {
        _count: { select: { deliveries: true } },
        deliveries: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((w) => ({
      id: w.id,
      deploymentId: w.deploymentId,
      url: w.url,
      secretMasked: `${w.secret.slice(0, 10)}...`,
      events: w.events,
      isActive: w.isActive,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
      deliveriesCount: w._count.deliveries,
      lastDeliveryStatus: w.deliveries[0]?.status ?? null,
      lastDeliveryAt: w.deliveries[0]?.createdAt?.toISOString() ?? null,
    }));
  }

  async createWebhook(
    deploymentId: string,
    input: CreateAgentDeploymentWebhookInput,
  ): Promise<AgentDeploymentWebhookView> {
    if (!this.validateDestinationUrl(input.url)) {
      throw new BadRequestException('Destination URL is invalid or targets a restricted private network.');
    }

    const secret = input.secret || this.generateSecret();

    const created = await this.prisma.agentDeploymentWebhook.create({
      data: {
        deploymentId,
        url: input.url,
        secret,
        events: input.events || [
          'agent.run.completed',
          'agent.run.failed',
          'agent.approval.requested',
        ],
        isActive: true,
      },
    });

    return {
      id: created.id,
      deploymentId: created.deploymentId,
      url: created.url,
      secretMasked: `${created.secret.slice(0, 10)}...`,
      events: created.events,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      deliveriesCount: 0,
      lastDeliveryStatus: null,
      lastDeliveryAt: null,
    };
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.prisma.agentDeploymentWebhook.delete({
      where: { id: webhookId },
    });
  }

  async getDeliveries(webhookId: string): Promise<AgentWebhookDeliveryView[]> {
    const deliveries = await this.prisma.agentWebhookDelivery.findMany({
      where: { webhookId },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return deliveries.map((d) => ({
      id: d.id,
      webhookId: d.webhookId,
      event: d.event,
      payload: (d.payload as Record<string, unknown>) || {},
      status: d.status as 'SUCCESS' | 'FAILED',
      statusCode: d.statusCode,
      latencyMs: d.latencyMs,
      error: d.error,
      attempts: d.attempts,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  /**
   * Dispatches an event payload to all matching webhooks for a deployment
   */
  async dispatchEvent(deploymentId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.prisma.agentDeploymentWebhook.findMany({
      where: { deploymentId, isActive: true },
    });

    for (const webhook of webhooks) {
      if (webhook.events.includes(event) || webhook.events.includes('*')) {
        // Run in background without blocking caller
        this.sendDeliveryWithRetry(webhook.id, webhook.url, webhook.secret, event, payload).catch((err) =>
          this.logger.error(`Webhook delivery failure for ${webhook.id}: ${err.message}`),
        );
      }
    }
  }

  /**
   * Manual test delivery
   */
  async testWebhook(webhookId: string): Promise<AgentWebhookDeliveryView> {
    const webhook = await this.prisma.agentDeploymentWebhook.findUnique({
      where: { id: webhookId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found.');

    const testEvent = 'agent.run.completed';
    const testPayload = {
      test: true,
      message: 'OneTab AI Agent Webhook Test Event',
      timestamp: new Date().toISOString(),
      sampleData: {
        agentId: 'buy-mac-system',
        status: 'COMPLETED',
        output: 'MacBook Pro 16-inch M3 Max selected with 36GB unified memory.',
      },
    };

    return this.sendDeliveryWithRetry(webhook.id, webhook.url, webhook.secret, testEvent, testPayload);
  }

  private async sendDeliveryWithRetry(
    webhookId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<AgentWebhookDeliveryView> {
    const deliveryId = `del_${randomBytes(12).toString('hex')}`;
    const timestamp = Date.now().toString();
    const bodyStr = JSON.stringify({
      id: deliveryId,
      event,
      timestamp,
      payload,
    });

    const signature = createHmac('sha256', secret).update(bodyStr).digest('hex');

    let attempts = 0;
    let success = false;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    const startTime = Date.now();

    while (attempts < 3 && !success) {
      attempts += 1;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-onetab-delivery-id': deliveryId,
            'x-onetab-event': event,
            'x-onetab-timestamp': timestamp,
            'x-onetab-signature': `sha256=${signature}`,
          },
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = res.status;
        if (res.ok) {
          success = true;
        } else {
          errorMessage = `HTTP error ${res.status}`;
          if (attempts < 3) await new Promise((r) => setTimeout(r, 1000 * attempts));
        }
      } catch (err: any) {
        errorMessage = err.name === 'AbortError' ? 'Webhook delivery timed out after 8s' : err.message;
        if (attempts < 3) await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    const latencyMs = Date.now() - startTime;

    const deliveryRecord = await this.prisma.agentWebhookDelivery.create({
      data: {
        id: deliveryId,
        webhookId,
        event,
        payload: payload as any,
        status: success ? 'SUCCESS' : 'FAILED',
        statusCode,
        latencyMs,
        error: errorMessage,
        attempts,
      },
    });

    return {
      id: deliveryRecord.id,
      webhookId: deliveryRecord.webhookId,
      event: deliveryRecord.event,
      payload: payload,
      status: deliveryRecord.status as 'SUCCESS' | 'FAILED',
      statusCode: deliveryRecord.statusCode,
      latencyMs: deliveryRecord.latencyMs,
      error: deliveryRecord.error,
      attempts: deliveryRecord.attempts,
      createdAt: deliveryRecord.createdAt.toISOString(),
    };
  }
}
