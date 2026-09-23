import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AIInfrastructureService } from '@org/api-ai';
import { AppEvent, PUBLIC_USER_SELECT } from '@org/api-common';
import { PrismaService, type Prisma } from '@org/database';
import type {
  AskCallQuestionRequest,
  AskCallQuestionResponse,
  CallNotesAssistRequest,
  CallNotesAssistResponse,
  CallSummaryView,
  TaskPriority,
} from '@org/types';
import type {
  CallSummaryFeedbackInput,
  RegenerateCallSummarySectionInput,
  ShareCallSummaryInput,
  UpdateCallSummaryInput,
} from '@org/validation';
import { CallAccessService } from './call-access.service.js';
import { toCallSummaryView } from './call-mappers.js';

/**
 * A summary stuck in PROCESSING longer than this is treated as abandoned (the
 * API restarted mid-generation) and may be generated again without `force`.
 */
const PROCESSING_STALE_MS = 2 * 60_000;

const PRIORITIES: readonly TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

interface ExtractedDecision {
  text: string;
  speaker?: string | undefined;
  timestamp?: number | undefined;
}

interface ExtractedActionItem {
  title: string;
  description?: string | undefined;
  assignee?: string | undefined;
  priority: TaskPriority;
  timestamp?: number | undefined;
}

interface StructuredSummary {
  overview: string;
  keyPoints: string[];
  decisions: ExtractedDecision[];
  actionItems: ExtractedActionItem[];
  openQuestions: string[];
  followUps: string[];
  importantLinks: Array<{ title: string; url: string }>;
}

const str = (value: unknown, max = 2000): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

const strings = (value: unknown, limit = 30): string[] =>
  Array.isArray(value)
    ? value.map((v) => str(v, 1000)).filter((v): v is string => !!v).slice(0, limit)
    : [];

const seconds = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

/**
 * Model output is untrusted input: shapes drift, enums come back lower-cased,
 * timestamps arrive as "03:12". Everything is coerced here so a sloppy answer
 * degrades to a thinner summary instead of a Prisma error and a FAILED status.
 */
export function sanitizeSummary(raw: unknown): StructuredSummary {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);

  return {
    overview: str(data.overview, 4000) ?? '',
    keyPoints: strings(data.keyPoints),
    openQuestions: strings(data.openQuestions),
    followUps: strings(data.followUps),
    importantLinks: list(data.importantLinks)
      .map((link) => {
        const l = (link ?? {}) as Record<string, unknown>;
        const url = str(l.url, 2000);
        return url && /^https?:\/\//i.test(url)
          ? { title: str(l.title, 200) ?? url, url }
          : null;
      })
      .filter((l): l is { title: string; url: string } => l !== null)
      .slice(0, 20),
    decisions: list(data.decisions)
      .map((d): ExtractedDecision | null => {
        const rec = (d ?? {}) as Record<string, unknown>;
        const text = str(rec.text ?? d, 500);
        return text
          ? { text, speaker: str(rec.speaker, 200), timestamp: seconds(rec.timestamp) }
          : null;
      })
      .filter((d): d is ExtractedDecision => d !== null)
      .slice(0, 30),
    actionItems: list(data.actionItems)
      .map((a): ExtractedActionItem | null => {
        const rec = (a ?? {}) as Record<string, unknown>;
        const title = str(rec.title ?? a, 300);
        if (!title) return null;
        const priority = str(rec.priority)?.toUpperCase() as TaskPriority | undefined;
        return {
          title,
          description: str(rec.description, 5000),
          assignee: str(rec.assignee, 200),
          priority: priority && PRIORITIES.includes(priority) ? priority : 'MEDIUM',
          timestamp: seconds(rec.timestamp),
        };
      })
      .filter((a): a is ExtractedActionItem => a !== null)
      .slice(0, 30),
  };
}

/** Pulls the first JSON object out of a reply that may be fenced or chatty. */
function parseJsonObject(reply: string): unknown {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The AI reply contained no JSON object.');
  return JSON.parse(match[0]);
}

const clock = (secs: number) =>
  `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

@Injectable()
export class CallSummaryService {
  private readonly logger = new Logger(CallSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
    private readonly events: EventEmitter2,
    private readonly access: CallAccessService,
  ) {}

  async getSummary(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallSummaryView | null> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const summary = await this.prisma.callSummary.findUnique({ where: { callId } });
    return summary ? toCallSummaryView(summary) : null;
  }

  /**
   * Builds the structured summary from the call's notes and transcript.
   *
   * Regenerating replaces what the previous run extracted — decisions and the
   * action items nobody has touched (still open, not turned into a task) — so
   * a second run never doubles the lists. Items people added by hand are kept.
   */
  async generateSummary(
    workspaceId: string,
    userId: string,
    callId: string,
    options: { force?: boolean } = {},
  ): Promise<CallSummaryView> {
    await this.access.assertCanView(workspaceId, userId, callId);

    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: {
        notes: {
          include: { author: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        transcripts: { orderBy: { timestamp: 'asc' } },
        participants: { include: { user: { select: PUBLIC_USER_SELECT } } },
        summary: true,
      },
    });

    const existing = call.summary;
    if (existing && !options.force) {
      if (existing.status !== 'PROCESSING' && existing.status !== 'FAILED') {
        return toCallSummaryView(existing);
      }
      // Another request (the hang-up hook, the other participant) is already
      // generating it — hand back the in-flight row instead of racing it.
      if (
        existing.status === 'PROCESSING' &&
        Date.now() - existing.updatedAt.getTime() < PROCESSING_STALE_MS
      ) {
        return toCallSummaryView(existing);
      }
    }

    const summaryRecord = await this.prisma.callSummary.upsert({
      where: { callId },
      create: { callId, workspaceId, status: 'PROCESSING', generatedById: userId },
      update: { status: 'PROCESSING', failureReason: null, generatedById: userId },
    });
    this.emitSummary(workspaceId, userId, callId, summaryRecord.id, 'PROCESSING');

    const participantIds = call.participants.map((p) => p.userId);
    const nameOf = (u: { name: string; displayName: string | null }) =>
      u.displayName || u.name;

    try {
      const notesText = call.notes
        .filter((n) => n.content.trim())
        .map((n) => `[${nameOf(n.author)}]: ${n.content}`)
        .join('\n');
      const transcriptText = call.transcripts
        .map((t) => `[${clock(t.timestamp)}] ${t.speakerName}: ${t.text}`)
        .join('\n');
      const participantNames = call.participants.map((p) => nameOf(p.user)).join(', ');

      let structured: StructuredSummary;
      let failureReason: string | null = null;

      if (!notesText && !transcriptText) {
        structured = sanitizeSummary({
          overview: `"${call.title}" ended with ${participantNames || 'the team'}. No notes or transcript were captured, so there is nothing to summarize yet — add notes and regenerate.`,
        });
      } else {
        try {
          const reply = await this.aiService.chat({
            messages: [
              {
                role: 'system',
                content:
                  'You summarize work calls. Reply with one JSON object only — no markdown fences, no commentary. Use only facts present in the notes and transcript.',
              },
              {
                role: 'user',
                content: `Return JSON with exactly these keys:
{
  "overview": "one short paragraph: what was discussed and decided",
  "keyPoints": ["..."],
  "decisions": [{ "text": "...", "speaker": "name if known", "timestamp": seconds_or_null }],
  "actionItems": [{ "title": "...", "description": "...", "assignee": "participant name if stated", "priority": "LOW|MEDIUM|HIGH|URGENT", "timestamp": seconds_or_null }],
  "openQuestions": ["..."],
  "followUps": ["..."],
  "importantLinks": [{ "title": "...", "url": "https://..." }]
}

Call title: ${call.title}
Participants: ${participantNames}

--- NOTES ---
${notesText || '(none)'}

--- TRANSCRIPT ---
${transcriptText || '(none)'}`,
              },
            ],
            temperature: 0.2,
            maxTokens: 2500,
          });
          structured = sanitizeSummary(parseJsonObject(reply.message?.content ?? ''));
          if (!structured.overview) throw new Error('The AI reply had no overview.');
        } catch (aiErr) {
          this.logger.warn(`AI summary failed for call ${callId}: ${String(aiErr)}`);
          // Notes are never lost to a model outage: fall back to them verbatim
          // and say so, so the reader knows this is not an AI summary.
          failureReason =
            'The AI summary could not be generated, so this was built from the notes. Try regenerating later.';
          structured = sanitizeSummary({
            overview: `Notes captured during "${call.title}".`,
            keyPoints: call.notes.map((n) => n.content.slice(0, 300)),
          });
        }
      }

      const participantByName = new Map<string, string>();
      for (const p of call.participants) {
        participantByName.set(p.user.name.toLowerCase(), p.userId);
        if (p.user.displayName) participantByName.set(p.user.displayName.toLowerCase(), p.userId);
      }
      const resolve = (name?: string) =>
        name ? (participantByName.get(name.toLowerCase()) ?? null) : null;

      const hadContent = Boolean(summaryRecord.overview);
      const { saved, createdItems } = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.callSummary.update({
          where: { id: summaryRecord.id },
          data: {
            status: 'READY',
            overview: structured.overview || 'Call concluded.',
            keyPoints: structured.keyPoints,
            openQuestions: structured.openQuestions,
            followUps: structured.followUps,
            importantLinks: structured.importantLinks,
            rawContent: [
              structured.overview,
              ...structured.keyPoints.map((k) => `• ${k}`),
            ].join('\n'),
            failureReason,
            generatedAt: new Date(),
            // The first successful run is version 1; each regeneration bumps it.
            version: hadContent ? summaryRecord.version + 1 : summaryRecord.version,
          },
        });
        await tx.callDecision.deleteMany({
          where: { callId, summaryId: summaryRecord.id },
        });
        await tx.callActionItem.deleteMany({
          where: { callId, summaryId: summaryRecord.id, taskId: null, status: 'TODO' },
        });
        if (structured.decisions.length > 0) {
          await tx.callDecision.createMany({
            data: structured.decisions.map((d) => ({
              callId,
              summaryId: summaryRecord.id,
              workspaceId,
              content: d.text,
              sourceTimestamp: d.timestamp ?? null,
              // Attributed to whoever said it when we can tell — never to the
              // person who happened to press "end call".
              madeById: resolve(d.speaker),
            })),
          });
        }
        const createdItems =
          structured.actionItems.length > 0
            ? await tx.callActionItem.createManyAndReturn({
                data: structured.actionItems.map((a) => ({
                  callId,
                  summaryId: summaryRecord.id,
                  workspaceId,
                  title: a.title,
                  description: a.description ?? null,
                  assigneeId: resolve(a.assignee),
                  priority: a.priority,
                  sourceTimestamp: a.timestamp ?? null,
                  status: 'TODO',
                })),
                select: { id: true, title: true, assigneeId: true },
              })
            : [];
        return { saved, createdItems };
      });

      this.events.emit(AppEvent.CallSummaryUpdated, {
        workspaceId,
        actorId: userId,
        callId,
        summaryId: saved.id,
        status: 'READY',
        title: call.title,
        // "Summary ready" is news once; a regeneration refreshes open views only.
        participantIds: hadContent ? undefined : participantIds,
      });
      for (const item of createdItems) {
        if (!item.assigneeId) continue;
        this.events.emit(AppEvent.CallActionItemUpdated, {
          workspaceId,
          actorId: userId,
          callId,
          actionItemId: item.id,
          action: 'created',
          title: item.title,
          assigneeId: item.assigneeId,
        });
      }

      return toCallSummaryView(saved);
    } catch (err) {
      this.logger.error(`Failed to generate summary for call ${callId}`, err);
      const failed = await this.prisma.callSummary.update({
        where: { id: summaryRecord.id },
        data: { status: 'FAILED', failureReason: "We couldn't generate the summary." },
      });
      this.emitSummary(workspaceId, userId, callId, failed.id, 'FAILED');
      return toCallSummaryView(failed);
    }
  }

  /**
   * Regenerates the whole summary or one field of it. A summary a person has
   * edited or approved is only overwritten with explicit confirmation.
   */
  async regenerate(
    workspaceId: string,
    userId: string,
    callId: string,
    input: RegenerateCallSummarySectionInput,
  ): Promise<CallSummaryView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const existing = await this.prisma.callSummary.findUnique({ where: { callId } });

    if (existing && (existing.status === 'EDITED' || existing.status === 'APPROVED') && !input.confirmOverwrite) {
      throw new ConflictException(
        'This summary was edited by a person. Confirm to overwrite it.',
      );
    }
    if (input.section === 'all' || !existing) {
      return this.generateSummary(workspaceId, userId, callId, { force: true });
    }

    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: {
        notes: { orderBy: { createdAt: 'asc' } },
        transcripts: { orderBy: { timestamp: 'asc' } },
      },
    });

    const section = input.section;
    let reply: string;
    try {
      const response = await this.aiService.chat({
        messages: [
          {
            role: 'system',
            content:
              'You rewrite one section of a work-call summary. Reply with one JSON object only. Use only facts from the call.',
          },
          {
            role: 'user',
            content: `Regenerate the "${section}" section. ${
              section === 'overview'
                ? 'Return { "overview": "one short paragraph" }.'
                : `Return { "${section}": ["...", "..."] }.`
            }

--- NOTES ---
${call.notes.map((n) => n.content).join('\n') || '(none)'}

--- TRANSCRIPT ---
${call.transcripts.map((t) => `[${clock(t.timestamp)}] ${t.speakerName}: ${t.text}`).join('\n') || '(none)'}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 1200,
      });
      reply = response.message?.content ?? '';
    } catch (err) {
      this.logger.warn(`Section regeneration failed for call ${callId}: ${String(err)}`);
      throw new ServiceUnavailableException(
        'The AI service is unavailable right now. Try again in a moment.',
      );
    }

    let data: Prisma.CallSummaryUpdateInput;
    try {
      const parsed = sanitizeSummary(parseJsonObject(reply));
      if (section === 'overview') {
        if (!parsed.overview) throw new Error('empty overview');
        data = { overview: parsed.overview };
      } else {
        if (parsed[section].length === 0) throw new Error(`empty ${section}`);
        data = { [section]: parsed[section] };
      }
    } catch {
      throw new ServiceUnavailableException(
        'The AI returned an unusable answer. Try regenerating again.',
      );
    }

    const updated = await this.prisma.callSummary.update({
      where: { id: existing.id },
      data: { ...data, status: 'READY', version: { increment: 1 } },
    });
    this.emitSummary(workspaceId, userId, callId, updated.id, 'READY');
    return toCallSummaryView(updated);
  }

  /** A person's edit. Marks the summary EDITED (or APPROVED when they approve it). */
  async updateSummary(
    workspaceId: string,
    userId: string,
    callId: string,
    input: UpdateCallSummaryInput,
  ): Promise<CallSummaryView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const existing = await this.prisma.callSummary.findUnique({ where: { callId } });
    if (!existing) throw new NotFoundException('Summary not found.');

    const updated = await this.prisma.callSummary.update({
      where: { id: existing.id },
      data: {
        ...(input.overview !== undefined ? { overview: input.overview } : {}),
        ...(input.keyPoints !== undefined ? { keyPoints: input.keyPoints } : {}),
        ...(input.openQuestions !== undefined ? { openQuestions: input.openQuestions } : {}),
        ...(input.followUps !== undefined ? { followUps: input.followUps } : {}),
        ...(input.importantLinks !== undefined
          ? { importantLinks: input.importantLinks }
          : {}),
        ...(input.rawContent !== undefined ? { rawContent: input.rawContent } : {}),
        status: input.status ?? 'EDITED',
        version: { increment: 1 },
      },
    });

    this.emitSummary(workspaceId, userId, callId, updated.id, updated.status);
    return toCallSummaryView(updated);
  }

  /** "Ask about this call" — answered strictly from the call's own record. */
  async askQuestion(
    workspaceId: string,
    userId: string,
    callId: string,
    input: AskCallQuestionRequest,
  ): Promise<AskCallQuestionResponse> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: {
        notes: { include: { author: { select: PUBLIC_USER_SELECT } } },
        summary: true,
        actionItems: true,
        decisions: true,
        transcripts: { orderBy: { timestamp: 'asc' } },
      },
    });

    const summaryContext = call.summary
      ? [
          `Overview: ${call.summary.overview ?? ''}`,
          `Key points: ${JSON.stringify(call.summary.keyPoints ?? [])}`,
        ].join('\n')
      : 'No summary yet.';

    try {
      const response = await this.aiService.chat({
        messages: [
          {
            role: 'system',
            content:
              'Answer questions about one work call using only the record provided. If the record does not answer it, say it was not discussed. Cite timestamps (m:ss) when relevant. Be concise.',
          },
          {
            role: 'user',
            content: `Title: ${call.title}
${summaryContext}
Decisions: ${call.decisions.map((d) => d.content).join('; ') || '(none)'}
Action items: ${call.actionItems.map((a) => a.title).join('; ') || '(none)'}

--- NOTES ---
${call.notes.map((n) => `[${n.author.displayName || n.author.name}]: ${n.content}`).join('\n') || '(none)'}

--- TRANSCRIPT ---
${call.transcripts.map((t) => `[${clock(t.timestamp)}] ${t.speakerName}: ${t.text}`).join('\n') || '(none)'}

Question: ${input.question}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 800,
      });
      return {
        answer:
          response.message?.content?.trim() || 'I could not find an answer in this call.',
      };
    } catch (err) {
      this.logger.warn(`Ask-about-call failed for ${callId}: ${String(err)}`);
      throw new ServiceUnavailableException(
        'The AI service is unavailable right now. Try again in a moment.',
      );
    }
  }

  /** AI helpers for the live notes editor (clean up, extract, format…). */
  async assistNotes(
    workspaceId: string,
    userId: string,
    callId: string,
    input: CallNotesAssistRequest,
  ): Promise<CallNotesAssistResponse> {
    await this.access.assertCanView(workspaceId, userId, callId);

    const instruction: Record<CallNotesAssistRequest['action'], string> = {
      summarize: 'Summarize these notes in a few tight bullet points.',
      cleanup: 'Fix typos, grammar and structure. Keep every fact; add nothing.',
      format: 'Format these notes as clean markdown with headings and bullets. Keep every fact.',
      generate_followup: 'Draft a short follow-up message to the attendees based on these notes.',
      extract_actions:
        'List every action item as a line starting with "- [ ] ". Output only those lines.',
      extract_decisions:
        'List every decision as a line starting with "Decision: ". Output only those lines.',
    };

    let result: string;
    try {
      const response = await this.aiService.chat({
        messages: [
          { role: 'system', content: 'You help people tidy up their call notes.' },
          { role: 'user', content: `${instruction[input.action]}\n\nNotes:\n${input.notes}` },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      });
      result = response.message?.content?.trim() || input.notes;
    } catch (err) {
      this.logger.warn(`Notes assist failed for call ${callId}: ${String(err)}`);
      throw new ServiceUnavailableException(
        'The AI service is unavailable right now. Your notes are unchanged.',
      );
    }

    const actionItems: Array<{ title: string }> = [];
    const decisions: string[] = [];
    for (const line of result.split('\n')) {
      const trimmed = line.trim();
      if (/^- \[[ x]\]/i.test(trimmed)) {
        const title = trimmed.replace(/^- \[[ x]\]\s*/i, '').trim();
        if (title) actionItems.push({ title: title.slice(0, 300) });
      } else if (/^decision:/i.test(trimmed)) {
        const text = trimmed.replace(/^decision:\s*/i, '').trim();
        if (text) decisions.push(text.slice(0, 500));
      }
    }

    return {
      result,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
      decisions: decisions.length > 0 ? decisions : undefined,
    };
  }

  /** One rating per person — a second click replaces the first. */
  async submitFeedback(
    workspaceId: string,
    userId: string,
    callId: string,
    input: CallSummaryFeedbackInput,
  ): Promise<void> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const summary = await this.prisma.callSummary.findUnique({
      where: { callId },
      select: { id: true },
    });
    if (!summary) throw new NotFoundException('Summary not found.');

    await this.prisma.$transaction([
      this.prisma.callSummaryFeedback.deleteMany({
        where: { summaryId: summary.id, userId },
      }),
      this.prisma.callSummaryFeedback.create({
        data: {
          summaryId: summary.id,
          userId,
          rating: input.rating,
          feedback: input.feedback ?? null,
        },
      }),
    ]);
  }

  /**
   * Shares the call: widens who may open it (workspace / named people) and
   * notifies the recipients. `participants` only notifies — they can already
   * see it. `conversation` / `link` are handled by the client, which holds the
   * Matrix session that posts into the room.
   */
  async shareSummary(
    workspaceId: string,
    userId: string,
    callId: string,
    input: ShareCallSummaryInput,
  ): Promise<{ success: boolean; shareUrl: string; recipientCount: number }> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      select: {
        title: true,
        sharedWithUserIds: true,
        participants: { select: { userId: true } },
      },
    });

    let recipientIds: string[] = [];
    if (input.target === 'participants') {
      recipientIds = call.participants.map((p) => p.userId);
    } else if (input.target === 'specific_users') {
      recipientIds = await this.access.filterWorkspaceMembers(
        workspaceId,
        input.userIds ?? [],
      );
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          sharedWithUserIds: [...new Set([...call.sharedWithUserIds, ...recipientIds])],
        },
      });
    } else if (input.target === 'workspace') {
      await this.prisma.call.update({
        where: { id: callId },
        data: { sharedWithWorkspace: true },
      });
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: { userId: true },
      });
      recipientIds = members.map((m) => m.userId);
    }

    recipientIds = recipientIds.filter((id) => id !== userId);
    if (recipientIds.length > 0) {
      this.events.emit(AppEvent.CallSummaryShared, {
        workspaceId,
        actorId: userId,
        callId,
        title: call.title,
        target: input.target,
        recipientIds,
      });
    }

    return {
      success: true,
      // Workspace-relative, like every notification deep link.
      shareUrl: `calls?callId=${callId}`,
      recipientCount: recipientIds.length,
    };
  }

  private emitSummary(
    workspaceId: string,
    actorId: string,
    callId: string,
    summaryId: string,
    status: string,
  ): void {
    this.events.emit(AppEvent.CallSummaryUpdated, {
      workspaceId,
      actorId,
      callId,
      summaryId,
      status,
    });
  }
}
