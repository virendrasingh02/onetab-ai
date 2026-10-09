import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { randomBytes } from 'node:crypto';
import type { AgentSessionMessage } from '@org/types';
import { AgentDeploymentService } from './agent-deployment.service.js';

@Injectable()
export class AgentSessionService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly deploymentService: AgentDeploymentService,
  ) {}

  generateSessionToken(): string {
    return `ot_sess_${randomBytes(24).toString('hex')}`;
  }

  /**
   * Verify origin against allowedOrigins.
   * If allowedOrigins contains '*', allows all.
   * If caller provided an origin, matches against hostname/full url.
   */
  validateOrigin(allowedOrigins: string[], clientOrigin?: string | null): boolean {
    if (!allowedOrigins || allowedOrigins.length === 0) return true;
    if (allowedOrigins.includes('*')) return true;
    if (!clientOrigin) return true; // Server-to-server or mobile/electron

    try {
      const url = new URL(clientOrigin.startsWith('http') ? clientOrigin : `https://${clientOrigin}`);
      const hostname = url.hostname;
      return allowedOrigins.some((allowed) => {
        if (allowed === hostname || allowed === clientOrigin) return true;
        if (allowed.startsWith('*.') && hostname.endsWith(allowed.slice(2))) return true;
        if (allowed === 'localhost' && (hostname === 'localhost' || hostname === '127.0.0.1')) return true;
        return false;
      });
    } catch {
      return allowedOrigins.includes(clientOrigin);
    }
  }

  async initSession(
    publicKey: string,
    userContext: Record<string, unknown> = {},
    clientOrigin?: string | null,
  ): Promise<{ sessionToken: string; sessionId: string; expiresAt: string; deployment: any }> {
    const deployment = await this.deploymentService.getDeploymentByPublicKey(publicKey);

    if (deployment.status !== 'ACTIVE') {
      throw new ForbiddenException(`Deployment is currently ${deployment.status.toLowerCase()}.`);
    }

    if (!this.validateOrigin(deployment.allowedOrigins, clientOrigin)) {
      throw new ForbiddenException(`Origin "${clientOrigin}" is not authorized for this deployment.`);
    }

    const sessionToken = this.generateSessionToken();
    const durationMinutes =
      ((deployment.widgetConfig as any)?.behavior?.sessionDurationMinutes as number) || 1440; // 24 hours default
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Initial greeting if configured
    const initialGreeting =
      ((deployment.widgetConfig as any)?.appearance?.welcomeMessage as string) ||
      deployment.agent.welcomeMessage ||
      `Hello! I am ${deployment.agent.name}. How can I assist you today?`;

    const initialMessages: AgentSessionMessage[] = [
      {
        id: `msg_${randomBytes(8).toString('hex')}`,
        role: 'assistant',
        content: initialGreeting,
        timestamp: new Date().toISOString(),
      },
    ];

    const session = await this.prisma.agentDeploymentSession.create({
      data: {
        deploymentId: deployment.id,
        agentId: deployment.agentId,
        sessionToken,
        clientOrigin: clientOrigin ?? null,
        userContext: userContext as any,
        messages: initialMessages as any,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    return {
      sessionToken: session.sessionToken,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      deployment: {
        id: deployment.id,
        name: deployment.name,
        agentId: deployment.agentId,
        agentName: deployment.agent.name,
        agentRole: deployment.agent.role,
        avatarUrl: deployment.agent.avatarUrl,
        versionNumber: deployment.versionNumber,
        widgetConfig: deployment.widgetConfig,
      },
    };
  }

  async getSessionByToken(sessionToken: string) {
    const session = await this.prisma.agentDeploymentSession.findUnique({
      where: { sessionToken },
      include: {
        deployment: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session token.');
    }

    if (session.expiresAt < new Date() || session.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session has expired.');
    }

    if (session.deployment.status !== 'ACTIVE') {
      throw new ForbiddenException(`Deployment is ${session.deployment.status.toLowerCase()}.`);
    }

    return session;
  }

  async getSessionById(sessionId: string) {
    const session = await this.prisma.agentDeploymentSession.findUnique({
      where: { id: sessionId },
      include: {
        deployment: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    return session;
  }

  async getMessages(sessionId: string): Promise<AgentSessionMessage[]> {
    const session = await this.getSessionById(sessionId);
    return Array.isArray(session.messages) ? (session.messages as any as AgentSessionMessage[]) : [];
  }

  async appendMessage(
    sessionId: string,
    message: AgentSessionMessage,
  ): Promise<AgentSessionMessage[]> {
    const session = await this.getSessionById(sessionId);
    const existing = Array.isArray(session.messages)
      ? (session.messages as any as AgentSessionMessage[])
      : [];
    const updated = [...existing, message];

    // Cap conversation history at 100 messages for token hygiene
    const capped = updated.length > 100 ? updated.slice(updated.length - 100) : updated;

    await this.prisma.agentDeploymentSession.update({
      where: { id: sessionId },
      data: {
        messages: capped as any,
        updatedAt: new Date(),
      },
    });

    return capped;
  }

  async resetSession(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    const initialGreeting =
      ((session.deployment.widgetConfig as any)?.appearance?.welcomeMessage as string) ||
      session.deployment.agent.welcomeMessage ||
      `Hello! I am ${session.deployment.agent.name}. How can I assist you today?`;

    const freshMessages: AgentSessionMessage[] = [
      {
        id: `msg_${randomBytes(8).toString('hex')}`,
        role: 'assistant',
        content: initialGreeting,
        timestamp: new Date().toISOString(),
      },
    ];

    await this.prisma.agentDeploymentSession.update({
      where: { id: sessionId },
      data: {
        messages: freshMessages as any,
        updatedAt: new Date(),
      },
    });
  }
}
