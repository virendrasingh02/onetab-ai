import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AIInfrastructureService } from '@org/api-ai';
import { AppEvent, PUBLIC_USER_SELECT } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  type AskCallQuestionRequest,
  type AskCallQuestionResponse,
  type CallNotesAssistRequest,
  type CallNotesAssistResponse,
  type CallSummaryStatus,
  type CallSummaryView,
  type TaskPriority,
} from '@org/types';
import {
  type CallSummaryFeedbackInput,
  type RegenerateCallSummarySectionInput,
  type ShareCallSummaryInput,
  type UpdateCallSummaryInput,
} from '@org/validation';

interface ExtractedDecision {
  text: string;
  speaker?: string;
  timestamp?: number;
}

interface ExtractedActionItem {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  timestamp?: number;
}

interface StructuredAISummaryOutput {
  overview: string;
  keyPoints: string[];
  decisions: ExtractedDecision[];
  actionItems: ExtractedActionItem[];
  openQuestions: string[];
  followUps: string[];
  importantLinks: Array<{ title: string; url: string }>;
}

@Injectable()
export class CallSummaryService {
  private readonly logger = new Logger(CallSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Helper to format a CallSummary into the wire view DTO.
   */
  private toSummaryView(
    summary: {
      id: string;
      callId: string;
      workspaceId: string;
      status: string;
      overview: string | null;
      keyPoints: unknown;
      openQuestions: unknown;
      followUps: unknown;
      importantLinks: unknown;
      rawContent: string | null;
      version: number;
      failureReason: string | null;
      generatedById: string | null;
      generatedAt: Date;
      updatedAt: Date;
      feedbacks?: Array<{
        id: string;
        summaryId: string;
        userId: string;
        rating: string;
        feedback: string | null;
        createdAt: Date;
        user?: unknown;
      }>;
    },
  ): CallSummaryView {
    return {
      id: summary.id,
      callId: summary.callId,
      workspaceId: summary.workspaceId,
      status: summary.status as CallSummaryStatus,
      overview: summary.overview,
      keyPoints: Array.isArray(summary.keyPoints)
        ? (summary.keyPoints as string[])
        : [],
      openQuestions: Array.isArray(summary.openQuestions)
        ? (summary.openQuestions as string[])
        : [],
      followUps: Array.isArray(summary.followUps)
        ? (summary.followUps as string[])
        : [],
      importantLinks: Array.isArray(summary.importantLinks)
        ? (summary.importantLinks as Array<{ title: string; url: string }>)
        : [],
      rawContent: summary.rawContent,
      version: summary.version,
      failureReason: summary.failureReason,
      generatedById: summary.generatedById,
      generatedAt: summary.generatedAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
      feedbacks: summary.feedbacks?.map((f) => ({
        id: f.id,
        summaryId: f.summaryId,
        userId: f.userId,
        rating: f.rating,
        feedback: f.feedback,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Retrieve the summary for a call.
   */
  async getSummary(
    workspaceId: string,
    callId: string,
  ): Promise<CallSummaryView | null> {
    const summary = await this.prisma.callSummary.findUnique({
      where: { callId },
      include: {
        feedbacks: {
          include: {
            user: { select: PUBLIC_USER_SELECT },
          },
        },
      },
    });

    if (!summary || summary.workspaceId !== workspaceId) {
      return null;
    }

    return this.toSummaryView(summary);
  }

  /**
   * Generate an AI Call Summary using notes, transcript, and call context.
   */
  async generateSummary(
    workspaceId: string,
    userId: string,
    callId: string,
    options?: { force?: boolean },
  ): Promise<CallSummaryView> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        notes: {
          include: { author: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        transcripts: {
          orderBy: { timestamp: 'asc' },
        },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: true,
      },
    });

    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call session not found.');
    }

    // Check if summary already exists and is ready
    if (call.summary && call.summary.status === 'READY' && !options?.force) {
      return this.toSummaryView(call.summary);
    }

    // Set or upsert summary to PROCESSING state
    const summaryRecord = await this.prisma.callSummary.upsert({
      where: { callId },
      create: {
        callId,
        workspaceId,
        status: 'PROCESSING',
        generatedById: userId,
      },
      update: {
        status: 'PROCESSING',
        failureReason: null,
      },
    });

    this.events.emit(AppEvent.CallSummaryUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      summaryId: summaryRecord.id,
      status: 'PROCESSING',
    });

    const participantIds = call.participants.map((p) => p.userId);

    try {
      // Assemble conversation context
      const participantNames = call.participants
        .map((p) => p.user.displayName || p.user.name)
        .join(', ');

      const notesText = call.notes
        .map((n) => `[${n.author.displayName || n.author.name}]: ${n.content}`)
        .join('\n');

      const transcriptText = call.transcripts
        .map((t) => {
          const mins = Math.floor(t.timestamp / 60);
          const secs = (t.timestamp % 60).toString().padStart(2, '0');
          return `[${mins}:${secs}] ${t.speakerName}: ${t.text}`;
        })
        .join('\n');

      if (!notesText.trim() && !transcriptText.trim()) {
        // Lightweight fallback when call had no notes and no transcript recorded
        const emptyOutput: StructuredAISummaryOutput = {
          overview: `Call "${call.title}" concluded with participants: ${participantNames || 'Team members'}. No notes or transcript were recorded during this session.`,
          keyPoints: ['Call completed without manual notes or transcript.'],
          decisions: [],
          actionItems: [],
          openQuestions: [],
          followUps: [],
          importantLinks: [],
        };

        const updated = await this.prisma.callSummary.update({
          where: { id: summaryRecord.id },
          data: {
            status: 'READY',
            overview: emptyOutput.overview,
            keyPoints: emptyOutput.keyPoints,
            openQuestions: emptyOutput.openQuestions,
            followUps: emptyOutput.followUps,
            importantLinks: emptyOutput.importantLinks,
            rawContent: emptyOutput.overview,
            updatedAt: new Date(),
          },
        });

        this.events.emit(AppEvent.CallSummaryUpdated, {
          workspaceId,
          actorId: userId,
          callId,
          summaryId: updated.id,
          status: 'READY',
          title: call.title,
          participantIds,
        });

        return this.toSummaryView(updated);
      }

      const prompt = `You are an expert AI meeting assistant. Analyze the following call information and generate a comprehensive, structured summary.
Strictly return only valid JSON matching this schema:
{
  "overview": "A concise executive summary paragraph of what was discussed and achieved.",
  "keyPoints": ["Key discussion topic 1", "Key discussion topic 2"],
  "decisions": [
    { "text": "Decision statement", "speaker": "Name if known", "timestamp": 0 }
  ],
  "actionItems": [
    { "title": "Specific action item", "description": "Details", "assignee": "Name if mentioned", "dueDate": "ISO or string if mentioned", "priority": "LOW|MEDIUM|HIGH|URGENT", "timestamp": 0 }
  ],
  "openQuestions": ["Unresolved question or open issue"],
  "followUps": ["Recommended follow-up topic grounded strictly in call content"],
  "importantLinks": [
    { "title": "Reference name", "url": "https://..." }
  ]
}

Call Title: ${call.title}
Participants: ${participantNames}

--- USER NOTES ---
${notesText || '(None)'}

--- TRANSCRIPT ---
${transcriptText || '(None)'}
`;

      let parsedOutput: StructuredAISummaryOutput;

      try {
        const aiResponse = await this.aiService.chat({
          messages: [
            {
              role: 'system',
              content:
                'You are an executive assistant extracting meeting notes. Return pure JSON only without markdown code blocks.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          maxTokens: 2500,
        });

        const raw = (aiResponse.message?.content || '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI output did not contain valid JSON.');
        }

        parsedOutput = JSON.parse(jsonMatch[0]) as StructuredAISummaryOutput;
      } catch (aiErr) {
        this.logger.warn(
          `AI generation failed or output invalid for call ${callId}: ${String(aiErr)}`,
        );

        // Deterministic fallback from notes so manual notes are never lost
        parsedOutput = {
          overview: `Summary of call "${call.title}" based on notes captured during the session.`,
          keyPoints: call.notes.map((n) => n.content.slice(0, 150)).filter(Boolean),
          decisions: [],
          actionItems: [],
          openQuestions: [],
          followUps: [],
          importantLinks: [],
        };
      }

      // Persist structured summary
      const savedSummary = await this.prisma.callSummary.update({
        where: { id: summaryRecord.id },
        data: {
          status: 'READY',
          overview: parsedOutput.overview || 'Call concluded.',
          keyPoints: parsedOutput.keyPoints || [],
          openQuestions: parsedOutput.openQuestions || [],
          followUps: parsedOutput.followUps || [],
          importantLinks: parsedOutput.importantLinks || [],
          rawContent: `${parsedOutput.overview}\n\nKey Points:\n${(parsedOutput.keyPoints || []).map((k) => `• ${k}`).join('\n')}`,
          version: summaryRecord.version + 1,
          updatedAt: new Date(),
        },
      });

      // Insert extracted decisions if none exist yet for this call
      if (parsedOutput.decisions && parsedOutput.decisions.length > 0) {
        for (const dec of parsedOutput.decisions) {
          if (dec.text?.trim()) {
            await this.prisma.callDecision.create({
              data: {
                callId,
                summaryId: savedSummary.id,
                workspaceId,
                content: dec.text.trim(),
                sourceTimestamp: dec.timestamp ?? null,
                madeById: userId,
              },
            });
          }
        }
      }

      // Insert extracted action items if none exist yet
      if (parsedOutput.actionItems && parsedOutput.actionItems.length > 0) {
        // Resolve member IDs if possible
        const memberMap = new Map<string, string>();
        for (const part of call.participants) {
          memberMap.set(part.user.name.toLowerCase(), part.user.id);
          if (part.user.displayName) {
            memberMap.set(part.user.displayName.toLowerCase(), part.user.id);
          }
        }

        for (const item of parsedOutput.actionItems) {
          if (item.title?.trim()) {
            const assigneeId = item.assignee
              ? memberMap.get(item.assignee.toLowerCase()) ?? null
              : null;

            await this.prisma.callActionItem.create({
              data: {
                callId,
                summaryId: savedSummary.id,
                workspaceId,
                title: item.title.trim(),
                description: item.description ?? null,
                assigneeId,
                priority: (item.priority as TaskPriority) ?? 'MEDIUM',
                sourceTimestamp: item.timestamp ?? null,
                status: 'TODO',
              },
            });
          }
        }
      }

      this.events.emit(AppEvent.CallSummaryUpdated, {
        workspaceId,
        actorId: userId,
        callId,
        summaryId: savedSummary.id,
        status: 'READY',
        title: call.title,
        participantIds,
      });

      return this.toSummaryView(savedSummary);
    } catch (err) {
      this.logger.error(`Failed to generate summary for call ${callId}`, err);

      const failedSummary = await this.prisma.callSummary.update({
        where: { id: summaryRecord.id },
        data: {
          status: 'FAILED',
          failureReason:
            err instanceof Error
              ? err.message
              : "We couldn't generate the summary.",
          updatedAt: new Date(),
        },
      });

      this.events.emit(AppEvent.CallSummaryUpdated, {
        workspaceId,
        actorId: userId,
        callId,
        summaryId: failedSummary.id,
        status: 'FAILED',
      });

      return this.toSummaryView(failedSummary);
    }
  }

  /**
   * Regenerate specific section or entire summary with confirmation guard.
   */
  async regenerate(
    workspaceId: string,
    userId: string,
    callId: string,
    input: RegenerateCallSummarySectionInput,
  ): Promise<CallSummaryView> {
    const existing = await this.prisma.callSummary.findUnique({
      where: { callId },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException('Summary not found.');
    }

    if (existing.status === 'EDITED' && !input.confirmOverwrite) {
      throw new ConflictException(
        'This summary was manually edited. Confirm overwrite to regenerate.',
      );
    }

    if (input.section === 'all') {
      return this.generateSummary(workspaceId, userId, callId, { force: true });
    }

    // Section-level regeneration
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        notes: true,
        transcripts: true,
      },
    });

    if (!call) throw new NotFoundException('Call not found.');

    const context = `Call Notes: ${call.notes.map((n) => n.content).join(' ')}\nTranscript: ${call.transcripts.map((t) => t.text).join(' ')}`;

    const prompt = `Regenerate only the "${input.section}" section of the call summary based on this content:
${context}
Return JSON: { "${input.section}": ... }`;

    try {
      const resp = await this.aiService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const raw = (resp.message?.content || '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const dataToUpdate: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (input.section in parsed) {
          dataToUpdate[input.section] = parsed[input.section];
        }

        const updated = await this.prisma.callSummary.update({
          where: { id: existing.id },
          data: dataToUpdate as any,
        });

        return this.toSummaryView(updated);
      }
    } catch (err) {
      this.logger.error(`Failed to regenerate section ${input.section}`, err);
    }

    return this.toSummaryView(existing);
  }

  /**
   * Update summary manually. Marks status as EDITED.
   */
  async updateSummary(
    workspaceId: string,
    userId: string,
    callId: string,
    input: UpdateCallSummaryInput,
  ): Promise<CallSummaryView> {
    const existing = await this.prisma.callSummary.findUnique({
      where: { callId },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException('Summary not found.');
    }

    const updated = await this.prisma.callSummary.update({
      where: { id: existing.id },
      data: {
        overview: input.overview !== undefined ? input.overview : existing.overview,
        keyPoints: input.keyPoints !== undefined ? (input.keyPoints as any) : (existing.keyPoints as any),
        openQuestions: input.openQuestions !== undefined ? (input.openQuestions as any) : (existing.openQuestions as any),
        followUps: input.followUps !== undefined ? (input.followUps as any) : (existing.followUps as any),
        importantLinks: input.importantLinks !== undefined ? (input.importantLinks as any) : (existing.importantLinks as any),
        rawContent: input.rawContent !== undefined ? input.rawContent : existing.rawContent,
        status: (input.status as CallSummaryStatus) ?? 'EDITED',
        version: existing.version + 1,
        updatedAt: new Date(),
      },
    });

    this.events.emit(AppEvent.CallSummaryUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      summaryId: updated.id,
      status: updated.status,
    });

    return this.toSummaryView(updated);
  }

  /**
   * "Ask about this call" grounded interactive Q&A.
   */
  async askQuestion(
    workspaceId: string,
    _userId: string,
    callId: string,
    input: AskCallQuestionRequest,
  ): Promise<AskCallQuestionResponse> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        notes: true,
        summary: true,
        actionItems: true,
        decisions: true,
        transcripts: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call not found.');
    }

    const summaryContext = call.summary
      ? `Summary Overview: ${call.summary.overview || ''}
Key Points: ${JSON.stringify(call.summary.keyPoints || [])}
Decisions: ${call.decisions.map((d) => d.content).join('; ')}
Action Items: ${call.actionItems.map((a) => a.title).join('; ')}`
      : 'No structured summary available.';

    const transcriptContext = call.transcripts
      .map(
        (t) =>
          `[${Math.floor(t.timestamp / 60)}:${(t.timestamp % 60).toString().padStart(2, '0')}] ${t.speakerName || 'Speaker'}: ${t.text}`,
      )
      .join('\n');

    const prompt = `You are an AI assistant answering questions grounded specifically in the following call record.
Only use the facts provided below. If you do not know the answer, politely state that it was not discussed.

--- CALL SUMMARY & METADATA ---
Title: ${call.title}
${summaryContext}

--- TRANSCRIPT & NOTES ---
${transcriptContext}

--- USER QUESTION ---
${input.question}

Answer concisely and reference any relevant timestamp (in minutes:seconds) if applicable.`;

    const response = await this.aiService.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 800,
    });

    return {
      answer: response.message?.content || 'I could not find an answer in this call.',
    };
  }

  /**
   * Notes AI assistance (summarize, cleanup, extract_actions, extract_decisions, generate_followup, format).
   */
  async assistNotes(
    workspaceId: string,
    input: CallNotesAssistRequest,
  ): Promise<CallNotesAssistResponse> {
    const prompt = `Perform the following action on these meeting notes:
Action: ${input.action}
Notes:
${input.notes}

Return the improved or extracted text clearly. If extracting action items, prefix each with "- [ ] ". If extracting decisions, prefix each with "Decision: ".`;

    const response = await this.aiService.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const result = response.message?.content || input.notes;

    const actionItems: Array<{ title: string }> = [];
    const decisions: string[] = [];

    for (const line of result.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ]')) {
        actionItems.push({ title: trimmed.replace(/^- \[[ x]\]\s*/, '') });
      } else if (trimmed.startsWith('Decision:')) {
        decisions.push(trimmed.replace(/^Decision:\s*/, ''));
      }
    }

    return {
      result,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
      decisions: decisions.length > 0 ? decisions : undefined,
    };
  }

  /**
   * Submit feedback on AI summary (Helpful / Not helpful).
   */
  async submitFeedback(
    workspaceId: string,
    userId: string,
    callId: string,
    input: CallSummaryFeedbackInput,
  ): Promise<void> {
    const summary = await this.prisma.callSummary.findUnique({
      where: { callId },
    });

    if (!summary || summary.workspaceId !== workspaceId) {
      throw new NotFoundException('Summary not found.');
    }

    await this.prisma.callSummaryFeedback.create({
      data: {
        summaryId: summary.id,
        userId,
        rating: input.rating,
        feedback: input.feedback ?? null,
      },
    });
  }

  /**
   * Share call summary with participants, the whole workspace, or specific
   * users — resolves the recipient list per `target` and fans out an in-app
   * notification for each (via {@link AppEvent.CallSummaryShared}, handled by
   * `DomainEventsListener`). `target: 'conversation'` and `postMessageToChat`
   * are posted by the caller directly through the Matrix client it already
   * holds (same as the call-summary card `CallModal` posts on hang-up) — the
   * API has no live Matrix session to piggyback on here.
   */
  async shareSummary(
    workspaceId: string,
    userId: string,
    callId: string,
    input: ShareCallSummaryInput,
  ): Promise<{ success: boolean; shareUrl: string }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call not found.');
    }

    const shareUrl = `/workspaces/${workspaceId}/calls/${callId}`;

    let recipientIds: string[] = [];
    if (input.target === 'participants') {
      recipientIds = call.participants.map((p) => p.userId);
    } else if (input.target === 'specific_users') {
      recipientIds = input.userIds ?? [];
    } else if (input.target === 'workspace') {
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: { userId: true },
      });
      recipientIds = members.map((m) => m.userId);
    }
    // 'conversation' and 'link' carry no in-app recipients of their own.

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
      shareUrl,
    };
  }
}
