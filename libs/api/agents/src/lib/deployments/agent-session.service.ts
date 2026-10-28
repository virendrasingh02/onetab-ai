import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { randomBytes } from 'node:crypto';
import type {
  AgentConversationHandle,
  AgentWidgetConversation,
  AgentSessionAttachment,
  AgentSessionMessage,
} from '@org/types';
import { aiEntityAvatarFromLegacy, aiEntityAvatarImageUrl } from '@org/types';
import { AgentDeploymentService } from './agent-deployment.service.js';

/** An uploaded file as the session keeps it: what the visitor sees, plus its text for the model. */
export interface AgentSessionAttachmentRecord extends AgentSessionAttachment {
  text: string;
  createdAt: string;
}

/** How many uploads one conversation keeps; older ones fall off. */
const MAX_SESSION_ATTACHMENTS = 20;
/** How much of one file's text a conversation keeps. */
const MAX_ATTACHMENT_TEXT = 60_000;
const MAX_HISTORY_ITEMS = 50;
/** A conversation the visitor deleted: kept for analytics, gone from their history. */
const DELETED = 'DELETED';

const VISITOR_KEY = /^ot_vis_[a-f0-9]{48}$/;

/** A history title from a conversation's first message. */
export function conversationTitle(message: string, attachments: AgentSessionAttachment[] = []): string | null {
  const text = message.replace(/\s+/g, ' ').trim();
  const base = text || attachments[0]?.name || '';
  if (!base) return null;
  return base.length > 80 ? `${base.slice(0, 79).trimEnd()}…` : base;
}

const AVATAR_URL = /^(https?:\/\/|\/(?!\/))[^\s"'<>]+$/i;
const AVATAR_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

/**
 * The first candidate a third-party page can safely put in an `<img src>`:
 * an http(s) URL, a same-origin path, or a base64 image data URL.
 */
/** The widget's brand colour when it's a plain hex, for an icon saved without a colour. */
function brandHex(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value) ? value : undefined;
}

export function widgetAvatarUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const value = c.trim();
    if (value && (AVATAR_URL.test(value) || AVATAR_DATA_URL.test(value))) return value;
  }
  return null;
}

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

  generateVisitorKey(): string {
    return `ot_vis_${randomBytes(24).toString('hex')}`;
  }

  private sessionMinutes(widgetConfig: unknown): number {
    return ((widgetConfig as any)?.behavior?.sessionDurationMinutes as number) || 1440; // 24 hours default
  }

  private greeting(deployment: { widgetConfig: unknown; agent: { name: string; welcomeMessage: string | null } }): AgentSessionMessage {
    return {
      id: `msg_${randomBytes(8).toString('hex')}`,
      role: 'assistant',
      content:
        ((deployment.widgetConfig as any)?.appearance?.welcomeMessage as string) ||
        deployment.agent.welcomeMessage ||
        `Hello! I am ${deployment.agent.name}. How can I assist you today?`,
      timestamp: new Date().toISOString(),
    };
  }

  async initSession(
    publicKey: string,
    userContext: Record<string, unknown> = {},
    clientOrigin?: string | null,
    options: { visitorKey?: string; resumeSessionId?: string } = {},
  ): Promise<{
    sessionToken: string;
    sessionId: string;
    expiresAt: string;
    visitorKey: string;
    resumed: boolean;
    deployment: any;
  }> {
    const deployment = await this.deploymentService.getDeploymentByPublicKey(publicKey);

    if (deployment.status !== 'ACTIVE') {
      throw new ForbiddenException(`Deployment is currently ${deployment.status.toLowerCase()}.`);
    }

    if (!this.validateOrigin(deployment.allowedOrigins, clientOrigin)) {
      throw new ForbiddenException(`Origin "${clientOrigin}" is not authorized for this deployment.`);
    }

    // A browser keeps its visitor key, so its earlier conversations stay in its history.
    const visitorKey =
      options.visitorKey && VISITOR_KEY.test(options.visitorKey) ? options.visitorKey : this.generateVisitorKey();
    const minutes = this.sessionMinutes(deployment.widgetConfig);

    const resumed = options.resumeSessionId
      ? await this.reopen(deployment.id, visitorKey, options.resumeSessionId, minutes)
      : null;

    const session =
      resumed ??
      (await this.prisma.agentDeploymentSession.create({
        data: {
          deploymentId: deployment.id,
          agentId: deployment.agentId,
          sessionToken: this.generateSessionToken(),
          visitorKey,
          clientOrigin: clientOrigin ?? null,
          userContext: userContext as any,
          messages: [this.greeting(deployment)] as any,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + minutes * 60 * 1000),
        },
      }));

    return {
      sessionToken: session.sessionToken,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      visitorKey,
      resumed: !!resumed,
      deployment: {
        id: deployment.id,
        name: deployment.name,
        agentId: deployment.agentId,
        agentName: deployment.agent.name,
        agentRole: deployment.agent.role,
        // The widget's own avatar wins; otherwise the agent's live avatar, so a
        // later change to the agent shows up without re-saving the widget.
        // An icon identity (`icon:bot:emerald`) becomes the same glyph-on-colour
        // as an SVG image, so the widget looks like the agent does in the app.
        avatarUrl: widgetAvatarUrl(
          (deployment.widgetConfig as any)?.appearance?.avatarUrl,
          aiEntityAvatarImageUrl(
            aiEntityAvatarFromLegacy(deployment.agent.avatarUrl, (deployment.agent as { configuration?: any }).configuration),
            brandHex((deployment.widgetConfig as any)?.appearance?.primaryColor),
          ),
        ),
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

    // The first thing the visitor says names the conversation in their history.
    const title =
      !session.title && message.role === 'user' ? conversationTitle(message.content, message.attachments) : null;

    await this.prisma.agentDeploymentSession.update({
      where: { id: sessionId },
      data: {
        messages: capped as any,
        ...(title ? { title } : {}),
        updatedAt: new Date(),
      },
    });

    return capped;
  }

  async resetSession(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    await this.prisma.agentDeploymentSession.update({
      where: { id: sessionId },
      data: {
        messages: [this.greeting(session.deployment)] as any,
        attachments: [],
        title: null,
        updatedAt: new Date(),
      },
    });
  }

  /* ---------------------------- conversations ---------------------------- */

  /**
   * One of a visitor's own conversations on a deployment, live again for
   * another session length. A conversation that isn't theirs, or was deleted,
   * is indistinguishable from one that doesn't exist.
   */
  private async reopen(deploymentId: string, visitorKey: string, sessionId: string, minutes: number) {
    const found = await this.prisma.agentDeploymentSession.findFirst({
      where: { id: sessionId, deploymentId, visitorKey, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!found) return null;
    return this.prisma.agentDeploymentSession.update({
      where: { id: found.id },
      data: { expiresAt: new Date(Date.now() + minutes * 60 * 1000) },
    });
  }

  private handle(session: {
    id: string;
    sessionToken: string;
    expiresAt: Date;
    visitorKey: string | null;
  }): AgentConversationHandle {
    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt.toISOString(),
      visitorKey: session.visitorKey,
    };
  }

  /** The visitor's conversations on this deployment, newest first; untouched ones other than the current one are left out. */
  async listConversations(session: SessionWithDeployment): Promise<AgentWidgetConversation[]> {
    const rows = session.visitorKey
      ? await this.prisma.agentDeploymentSession.findMany({
          where: {
            deploymentId: session.deploymentId,
            visitorKey: session.visitorKey,
            status: 'ACTIVE',
            OR: [{ title: { not: null } }, { id: session.id }],
          },
          orderBy: { updatedAt: 'desc' },
          take: MAX_HISTORY_ITEMS,
          select: { id: true, title: true, updatedAt: true },
        })
      : [session];
    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? 'New conversation',
      updatedAt: r.updatedAt.toISOString(),
      current: r.id === session.id,
    }));
  }

  /** A fresh conversation for the same visitor. */
  async createConversation(session: SessionWithDeployment): Promise<AgentConversationHandle> {
    const created = await this.prisma.agentDeploymentSession.create({
      data: {
        deploymentId: session.deploymentId,
        agentId: session.agentId,
        sessionToken: this.generateSessionToken(),
        visitorKey: session.visitorKey,
        clientOrigin: session.clientOrigin,
        userContext: (session.userContext ?? {}) as any,
        messages: [this.greeting(session.deployment)] as any,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + this.sessionMinutes(session.deployment.widgetConfig) * 60 * 1000),
      },
    });
    return this.handle(created);
  }

  /** Switch to another of the visitor's conversations. */
  async openConversation(session: SessionWithDeployment, targetId: string): Promise<AgentConversationHandle> {
    if (targetId === session.id) return this.handle(session);
    const target = session.visitorKey
      ? await this.reopen(
          session.deploymentId,
          session.visitorKey,
          targetId,
          this.sessionMinutes(session.deployment.widgetConfig),
        )
      : null;
    if (!target) throw new NotFoundException('Conversation not found.');
    return this.handle(target);
  }

  /** Remove one of the visitor's conversations from their history. */
  async deleteConversation(session: SessionWithDeployment, targetId: string): Promise<void> {
    const mine =
      targetId === session.id
        ? { id: session.id }
        : session.visitorKey
          ? { id: targetId, deploymentId: session.deploymentId, visitorKey: session.visitorKey, status: 'ACTIVE' }
          : null;
    const { count } = mine
      ? await this.prisma.agentDeploymentSession.updateMany({ where: mine, data: { status: DELETED, attachments: [] } })
      : { count: 0 };
    if (!count) throw new NotFoundException('Conversation not found.');
  }

  /* ------------------------------ attachments ----------------------------- */

  /** Keep an uploaded file's text on the session, for a later message to send along. */
  async addAttachment(
    session: { id: string; attachments: unknown },
    file: { name: string; mimeType: string; size: number; text: string },
  ): Promise<AgentSessionAttachment> {
    const record: AgentSessionAttachmentRecord = {
      id: `att_${randomBytes(10).toString('hex')}`,
      name: file.name.slice(0, 200),
      mimeType: file.mimeType,
      size: file.size,
      text: file.text.slice(0, MAX_ATTACHMENT_TEXT),
      createdAt: new Date().toISOString(),
    };
    await this.prisma.agentDeploymentSession.update({
      where: { id: session.id },
      data: {
        attachments: [...attachmentRecords(session.attachments), record].slice(-MAX_SESSION_ATTACHMENTS) as any,
      },
    });
    return { id: record.id, name: record.name, mimeType: record.mimeType, size: record.size };
  }

  /** The session's uploads with these ids, in the order asked; an id it doesn't hold is refused. */
  resolveAttachments(session: { attachments: unknown }, ids: string[]): AgentSessionAttachmentRecord[] {
    const records = attachmentRecords(session.attachments);
    return [...new Set(ids)].map((id) => {
      const found = records.find((r) => r.id === id);
      if (!found) throw new NotFoundException('That file is no longer part of this conversation. Upload it again.');
      return found;
    });
  }
}

export type SessionWithDeployment = Awaited<ReturnType<AgentSessionService['getSessionById']>>;

function attachmentRecords(value: unknown): AgentSessionAttachmentRecord[] {
  return Array.isArray(value) ? (value as AgentSessionAttachmentRecord[]) : [];
}
