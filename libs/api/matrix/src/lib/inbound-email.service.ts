import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import {
  EMAIL_EVENT_KEY,
  type ChannelEmailSettingsView,
} from '@org/types';
import type {
  InboundEmailInput,
  UpdateChannelEmailSettingsInput,
} from '@org/validation';
import { MatrixAdminService } from './matrix-admin.service.js';

interface NormalisedEmail {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
  attachmentNames: string[];
}

/**
 * Turns inbound provider webhooks into channel messages (brief §5).
 *
 * Mail sent to `<localpart>@<INBOUND_EMAIL_DOMAIN>` is posted into the linked
 * channel's Matrix room as the shared `@email-<channelId>` identity, threaded
 * by `In-Reply-To` / `References` (or by subject), with the RFC `Message-ID`
 * recorded so the same mail can't be ingested twice and our own outbound mail
 * can't loop back in.
 */
@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly config: ConfigService,
  ) {}

  private get domain(): string {
    return (
      this.config.get<string>('INBOUND_EMAIL_DOMAIN') || 'inbound.onetab.ai'
    );
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'channel'
    );
  }

  private async ensureAddress(workspaceId: string, channelId: string) {
    const existing = await this.prisma.channelEmailAddress.findUnique({
      where: { channelId },
    });
    if (existing) return existing;

    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { name: true, slug: true },
    });
    if (!channel) throw new NotFoundException('Channel not found.');

    for (let attempt = 0; attempt < 5; attempt++) {
      const localpart = `${this.slugify(channel.slug || channel.name)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      try {
        return await this.prisma.channelEmailAddress.create({
          data: { channelId, workspaceId, localpart },
        });
      } catch {
        // localpart collision — try another.
      }
    }
    throw new NotFoundException('Could not allocate an email address.');
  }

  private toView(row: {
    channelId: string;
    localpart: string;
    isEnabled: boolean;
    threadPerSubject: boolean;
    _count?: { messages: number };
  }): ChannelEmailSettingsView {
    return {
      channelId: row.channelId,
      address: `${row.localpart}@${this.domain}`,
      isEnabled: row.isEnabled,
      threadPerSubject: row.threadPerSubject,
      messageCount: row._count?.messages ?? 0,
    };
  }

  async getSettings(
    workspaceId: string,
    channelId: string,
  ): Promise<ChannelEmailSettingsView> {
    await this.ensureAddress(workspaceId, channelId);
    const row = await this.prisma.channelEmailAddress.findUniqueOrThrow({
      where: { channelId },
      include: { _count: { select: { messages: true } } },
    });
    return this.toView(row);
  }

  async updateSettings(
    workspaceId: string,
    channelId: string,
    input: UpdateChannelEmailSettingsInput,
  ): Promise<ChannelEmailSettingsView> {
    await this.ensureAddress(workspaceId, channelId);
    const row = await this.prisma.channelEmailAddress.update({
      where: { channelId },
      data: {
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.threadPerSubject !== undefined
          ? { threadPerSubject: input.threadPerSubject }
          : {}),
      },
      include: { _count: { select: { messages: true } } },
    });
    return this.toView(row);
  }

  /* --------------------------------------------------------------------- */

  private normalise(body: InboundEmailInput): NormalisedEmail {
    const b = body as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const header = (name: string) =>
      (b['Headers'] as { Name: string; Value: string }[] | undefined)?.find(
        (h) => h.Name.toLowerCase() === name.toLowerCase(),
      )?.Value;

    const fromFull = b['FromFull'] as
      | { Email?: string; Name?: string }
      | undefined;
    const from =
      fromFull?.Email ??
      str(b['From']) ??
      str(b['sender']) ??
      '';
    const to =
      (b['ToFull'] as { Email?: string }[] | undefined)?.[0]?.Email ??
      str(b['To']) ??
      str(b['recipient']) ??
      '';
    const attachments =
      (b['Attachments'] as { Name?: string }[] | undefined) ??
      (b['attachments'] as { Name?: string }[] | undefined) ??
      [];

    return {
      from: from.replace(/^.*<([^>]+)>.*$/, '$1').trim().toLowerCase(),
      fromName: fromFull?.Name ?? str(b['FromName']),
      to: to.replace(/^.*<([^>]+)>.*$/, '$1').trim().toLowerCase(),
      subject: (str(b['Subject']) ?? str(b['subject']) ?? '(no subject)').slice(0, 300),
      text: (
        str(b['TextBody']) ??
        str(b['stripped-text']) ??
        str(b['body-plain']) ??
        str(b['text']) ??
        ''
      ).slice(0, 8000),
      messageId: (
        str(b['MessageID']) ??
        str(b['Message-Id']) ??
        str(b['message-id']) ??
        header('Message-Id') ??
        `synthetic-${Date.now()}-${Math.random().toString(36).slice(2)}`
      ).trim(),
      inReplyTo: str(b['In-Reply-To']) ?? header('In-Reply-To'),
      references: str(b['References']) ?? header('References'),
      attachmentNames: attachments
        .map((a) => a?.Name)
        .filter((n): n is string => !!n),
    };
  }

  private normaliseSubject(subject: string): string {
    return subject
      .replace(/^\s*(re|fwd?|aw|sv)\s*:\s*/i, '')
      .trim()
      .toLowerCase()
      .slice(0, 200);
  }

  async handleInbound(
    secret: string | undefined,
    body: InboundEmailInput,
  ): Promise<{ ok: true; ignored?: string }> {
    const expected = this.config.get<string>('INBOUND_EMAIL_SECRET');
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid inbound-email secret.');
    }

    const email = this.normalise(body);
    if (!email.to) return { ok: true, ignored: 'no recipient' };

    const localpart = email.to.split('@')[0]?.toLowerCase();
    const address = localpart
      ? await this.prisma.channelEmailAddress.findUnique({
          where: { localpart },
          include: {
            channel: { select: { matrixRoomId: true } },
          },
        })
      : null;

    if (!address || !address.isEnabled) {
      return { ok: true, ignored: 'no enabled channel address' };
    }

    // Loop guards.
    const dup = await this.prisma.emailMessage.findUnique({
      where: { messageId: email.messageId },
      select: { id: true },
    });
    if (dup) return { ok: true, ignored: 'already ingested' };
    if (
      email.from.endsWith(`@${this.domain}`) ||
      /(auto-submitted|no-?reply|mailer-daemon|postmaster)/i.test(email.from)
    ) {
      return { ok: true, ignored: 'loop / automated sender' };
    }

    if (!address.channel.matrixRoomId || !this.admin.isEnabled) {
      // Record it so a later reply threads correctly, but there is nowhere to post.
      await this.recordMessage(address, email, null, null);
      return { ok: true, ignored: 'channel has no room yet' };
    }

    // Resolve the Matrix thread root.
    let threadRootId: string | null = null;
    const parentIds = [
      email.inReplyTo,
      ...(email.references?.split(/\s+/) ?? []),
    ].filter((v): v is string => !!v);
    if (parentIds.length > 0) {
      const parent = await this.prisma.emailMessage.findFirst({
        where: { channelId: address.channelId, messageId: { in: parentIds } },
        select: { matrixThreadRootId: true, matrixEventId: true },
        orderBy: { createdAt: 'asc' },
      });
      threadRootId = parent?.matrixThreadRootId ?? parent?.matrixEventId ?? null;
    }
    if (!threadRootId && address.threadPerSubject) {
      const sameSubject = await this.prisma.emailMessage.findFirst({
        where: {
          channelId: address.channelId,
          subject: { equals: this.normaliseSubject(email.subject), mode: 'insensitive' },
          matrixEventId: { not: null },
        },
        select: { matrixThreadRootId: true, matrixEventId: true },
        orderBy: { createdAt: 'asc' },
      });
      threadRootId =
        sameSubject?.matrixThreadRootId ?? sameSubject?.matrixEventId ?? null;
    }

    // Provision + join the shared email identity.
    let emailMatrixId = address.matrixUserId;
    if (!emailMatrixId) {
      const { matrixUserId } = await this.admin.provisionUser({
        userId: `email-${address.channelId}`,
        displayName: 'Email',
      });
      emailMatrixId = matrixUserId;
      await this.prisma.channelEmailAddress.update({
        where: { channelId: address.channelId },
        data: { matrixUserId: emailMatrixId },
      });
    }
    await this.admin
      .joinRoomAs(emailMatrixId, address.channel.matrixRoomId)
      .catch(() => undefined);

    const attachmentLine = email.attachmentNames.length
      ? `\n📎 ${email.attachmentNames.length} attachment(s): ${email.attachmentNames.join(', ')}`
      : '';
    const rendered = `✉ **${email.fromName ?? email.from}** — *${email.subject}*\n\n${email.text}${attachmentLine}`;

    const content: Record<string, unknown> = {
      msgtype: 'm.text',
      body: rendered,
      [EMAIL_EVENT_KEY]: {
        from: email.from,
        fromName: email.fromName,
        subject: email.subject,
        messageId: email.messageId,
      },
    };
    if (threadRootId) {
      content['m.relates_to'] = {
        rel_type: 'm.thread',
        event_id: threadRootId,
        'm.in_reply_to': { event_id: threadRootId },
        is_falling_back: true,
      };
    }

    const eventId = await this.admin.sendEventAs(
      address.channel.matrixRoomId,
      emailMatrixId,
      'm.room.message',
      content,
    );

    await this.recordMessage(address, email, eventId, threadRootId ?? eventId);
    this.logger.log(
      `Inbound email → #${address.channelId} (${email.from}), threaded=${!!threadRootId}`,
    );
    return { ok: true };
  }

  private async recordMessage(
    address: { id: string; channelId: string; workspaceId: string },
    email: NormalisedEmail,
    matrixEventId: string | null,
    matrixThreadRootId: string | null,
  ): Promise<void> {
    await this.prisma.emailMessage
      .create({
        data: {
          channelEmailAddressId: address.id,
          channelId: address.channelId,
          workspaceId: address.workspaceId,
          messageId: email.messageId,
          inReplyTo: email.inReplyTo ?? null,
          references: email.references ?? null,
          fromAddress: email.from,
          fromName: email.fromName ?? null,
          toAddress: email.to,
          subject: this.normaliseSubject(email.subject),
          matrixEventId,
          matrixThreadRootId,
          attachmentCount: email.attachmentNames.length,
        },
      })
      .catch((error) =>
        this.logger.warn(`email record failed: ${String(error)}`),
      );
  }
}
