import { PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import type { Prisma } from '@org/database';
import type {
  CallActionItemView,
  CallDecisionView,
  CallNoteView,
  CallSessionKind,
  CallSessionStatus,
  CallSummaryStatus,
  CallSummaryView,
  CallTranscriptItemView,
  CallView,
  Task,
  TaskPriority,
} from '@org/types';

/*
 * Row → wire-DTO mappers for call sessions, shared by the calls and summary
 * services (kept apart from both so neither imports the other).
 */

export const CALL_INCLUDE = {
  startedBy: { select: PUBLIC_USER_SELECT },
  participants: { include: { user: { select: PUBLIC_USER_SELECT } } },
  summary: true,
} satisfies Prisma.CallInclude;

export const ACTION_ITEM_INCLUDE = {
  assignee: { select: PUBLIC_USER_SELECT },
  task: true,
} satisfies Prisma.CallActionItemInclude;

export type CallRow = Prisma.CallGetPayload<{ include: typeof CALL_INCLUDE }> & {
  _count?: {
    notes: number;
    actionItems: number;
    decisions: number;
    transcripts: number;
  };
};
type NoteRow = Prisma.CallNoteGetPayload<{
  include: { author: { select: typeof PUBLIC_USER_SELECT } };
}>;
type ActionItemRow = Prisma.CallActionItemGetPayload<{
  include: typeof ACTION_ITEM_INCLUDE;
}>;
type DecisionRow = Prisma.CallDecisionGetPayload<{
  include: { madeBy: { select: typeof PUBLIC_USER_SELECT } };
}>;
type TranscriptRow = Prisma.CallTranscriptItemGetPayload<object>;
type SummaryRow = Prisma.CallSummaryGetPayload<object>;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export function toCallSummaryView(summary: SummaryRow): CallSummaryView {
  return {
    id: summary.id,
    callId: summary.callId,
    workspaceId: summary.workspaceId,
    status: summary.status as CallSummaryStatus,
    overview: summary.overview,
    keyPoints: asStringArray(summary.keyPoints),
    openQuestions: asStringArray(summary.openQuestions),
    followUps: asStringArray(summary.followUps),
    importantLinks: Array.isArray(summary.importantLinks)
      ? (summary.importantLinks as Array<{ title: string; url: string }>)
      : [],
    rawContent: summary.rawContent,
    version: summary.version,
    failureReason: summary.failureReason,
    generatedById: summary.generatedById,
    generatedAt: summary.generatedAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}

export function toCallView(call: CallRow): CallView {
  return {
    id: call.id,
    workspaceId: call.workspaceId,
    conversationId: call.conversationId,
    channelId: call.channelId,
    meetingId: call.meetingId,
    title: call.title,
    kind: call.kind as CallSessionKind,
    status: call.status as CallSessionStatus,
    startedById: call.startedById,
    startedAt: call.startedAt.toISOString(),
    endedAt: call.endedAt?.toISOString() ?? null,
    recordingUrl: call.recordingUrl,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
    startedBy: toPublicUser(call.startedBy),
    participants: call.participants.map((p) => ({
      id: p.id,
      callId: p.callId,
      userId: p.userId,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt?.toISOString() ?? null,
      user: toPublicUser(p.user),
    })),
    summary: call.summary ? toCallSummaryView(call.summary) : null,
    sharedWithWorkspace: call.sharedWithWorkspace,
    sharedWithUserIds: call.sharedWithUserIds,
    _count: call._count,
  };
}

export function toNoteView(note: NoteRow): CallNoteView {
  return {
    id: note.id,
    callId: note.callId,
    workspaceId: note.workspaceId,
    authorId: note.authorId,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    author: toPublicUser(note.author),
  };
}

export function toActionItemView(item: ActionItemRow): CallActionItemView {
  return {
    id: item.id,
    callId: item.callId,
    summaryId: item.summaryId,
    workspaceId: item.workspaceId,
    title: item.title,
    description: item.description,
    assigneeId: item.assigneeId,
    dueDate: item.dueDate?.toISOString() ?? null,
    status: item.status,
    priority: item.priority as TaskPriority,
    sourceTimestamp: item.sourceTimestamp,
    taskId: item.taskId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    assignee: item.assignee ? toPublicUser(item.assignee) : null,
    // The linked row is only ever used for its id/status/title; the full Task
    // DTO (with relations) comes from the tasks API.
    task: item.task as unknown as Task | null,
  };
}

export function toDecisionView(decision: DecisionRow): CallDecisionView {
  return {
    id: decision.id,
    callId: decision.callId,
    summaryId: decision.summaryId,
    workspaceId: decision.workspaceId,
    content: decision.content,
    sourceTimestamp: decision.sourceTimestamp,
    madeById: decision.madeById,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
    madeBy: decision.madeBy ? toPublicUser(decision.madeBy) : null,
  };
}

export function toTranscriptView(item: TranscriptRow): CallTranscriptItemView {
  return {
    id: item.id,
    callId: item.callId,
    speakerId: item.speakerId,
    speakerName: item.speakerName,
    text: item.text,
    timestamp: item.timestamp,
    createdAt: item.createdAt.toISOString(),
  };
}

