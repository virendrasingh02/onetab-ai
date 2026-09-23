import type {
  CycleStatus,
  CustomFieldType,
  DocumentKind,
  IdentifierPrefixMode,
  IntakeSource,
  IntakeStatus,
  MeetingParticipantRole,
  MeetingRsvp,
  MeetingStatus,
  ProjectHealth,
  ProjectStatus,
  RelationType,
  TaskPriority,
  TaskStatus,
  ViewType,
  WorkItemType,
} from './enums.js';
import type { IconSelection, IsoDateString, PublicUser } from './entities.js';

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: IsoDateString | null;
  isCompleted: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: IsoDateString;
  endDate: IsoDateString;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Team extends IconSelection {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  color: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Initiative extends IconSelection {
  id: string;
  workspaceId: string;
  name: string;
  objective: string | null;
  description: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  priority: TaskPriority;
  targetDate: IsoDateString | null;
  color: string | null;
  projects?: ProjectDetail[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Epic {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  targetDate: IsoDateString | null;
  color: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  _count?: { workItems: number; completedWorkItems: number };
}

export interface Module {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  leadId: string | null;
  startDate: IsoDateString | null;
  targetDate: IsoDateString | null;
  status: ProjectStatus;
  color: string | null;
  lead?: PublicUser | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  _count?: { workItems: number };
}

export interface Cycle {
  id: string;
  projectId: string | null;
  teamId: string | null;
  workspaceId: string;
  name: string;
  description: string | null;
  goal: string | null;
  startDate: IsoDateString;
  endDate: IsoDateString;
  status: CycleStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  _count?: { workItems: number; completedWorkItems: number };
}

/**
 * `icon`/`iconColor` come from `IconSelection` and follow the same rules as a
 * workspace's.
 */
export interface Project extends IconSelection {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  health?: ProjectHealth;
  healthScore?: number | null;
  startDate: IsoDateString | null;
  targetDate: IsoDateString | null;
  teamId?: string | null;
  leadId?: string | null;
  initiativeId?: string | null;
  /**
   * The board's columns, left to right.
   */
  columnOrder: TaskStatus[];
  /** Uppercase stem of this project's ticket ids, e.g. `WEB` in `WEB-42`. */
  ticketPrefix: string | null;
  identifierPrefixMode?: IdentifierPrefixMode;
  ticketSeq?: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** A project as the list and board screens receive it. */
export interface ProjectDetail extends Project {
  milestones: Milestone[];
  sprints: Sprint[];
  epics?: Epic[];
  modules?: Module[];
  cycles?: Cycle[];
  _count: { tasks: number };
}

/**
 * The project badge carried on a task, without the full project payload.
 */
export interface TaskProjectRef extends IconSelection {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  ticketPrefix?: string | null;
}

/** The slim task carried on each side of a relation — `getRelations`' `select`. */
export interface RelationTaskRef {
  id: string;
  title: string;
  status: TaskStatus;
  identifier?: string | null;
}

export interface WorkItemRelation {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  createdAt: IsoDateString;
  /** The relation's own ends, as the API actually returns them. */
  source?: RelationTaskRef;
  target?: RelationTaskRef;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string | null;
  sprintId: string | null;
  milestoneId: string | null;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: IsoDateString | null;
  startDate?: IsoDateString | null;
  /** Position within its status column. Lower sorts first. */
  orderIndex: number;
  /**
   * This task's number within its project. With the project's `ticketPrefix` it
   * makes the card's human-readable id. Null for a task filed outside any
   * project, which has no prefix to hang a number off.
   */
  ticketNumber: number | null;
  identifier?: string | null;
  type?: WorkItemType;
  customTypeId?: string | null;
  reporterId?: string | null;
  teamId?: string | null;
  epicId?: string | null;
  cycleId?: string | null;
  moduleId?: string | null;
  parentId?: string | null;
  estimate?: number | null;
  timeSpent?: number | null;
  completedAt?: IsoDateString | null;
  labels?: string[];
  customFields?: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  assignee: PublicUser | null;
  assignees?: PublicUser[];
  assigneeIds?: string[];
  reporter?: PublicUser | null;
  project: TaskProjectRef | null;
  team?: Team | null;
  epic?: Epic | null;
  module?: Module | null;
  cycle?: Cycle | null;
  parent?: Task | null;
  subItems?: Task[];
  relations?: WorkItemRelation[];
  /** Set when this task was captured as an action item from a meeting. */
  meetingId?: string | null;
  meeting?: {
    id: string;
    title: string;
    startAt: IsoDateString;
    status: MeetingStatus;
  } | null;
  _count: { comments: number };
}

export type WorkItem = Task;

export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  author: PublicUser;
}

export interface CalendarEvent {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: IsoDateString;
  endAt: IsoDateString;
  isAllDay: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  organizer: PublicUser;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  userId: string;
  role: MeetingParticipantRole;
  rsvp: MeetingRsvp;
  addedAt: IsoDateString;
  user: PublicUser;
}

export interface MeetingNote {
  id: string;
  meetingId: string;
  body: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  author: PublicUser;
}

export interface MeetingDecision {
  id: string;
  meetingId: string;
  text: string;
  createdAt: IsoDateString;
  author: PublicUser;
}

/** A meeting row as it appears in the list. */
export interface Meeting {
  id: string;
  workspaceId: string;
  organizerId: string;
  projectId: string | null;
  /** Set when a calendar event was created alongside the meeting. */
  calendarEventId: string | null;
  title: string;
  description: string | null;
  agenda: string | null;
  /** A join URL or a physical location. */
  location: string | null;
  status: MeetingStatus;
  startAt: IsoDateString;
  endAt: IsoDateString;
  endedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  deletedAt?: IsoDateString | null;
  organizer: PublicUser;
  project: TaskProjectRef | null;
  participants: MeetingParticipant[];
  _count: {
    participants: number;
    notes: number;
    decisions: number;
    actionItems: number;
  };
}

/** The full meeting payload behind the detail view. */
export interface MeetingDetail extends Meeting {
  calendarEvent: { id: string } | null;
  notes: MeetingNote[];
  decisions: MeetingDecision[];
  /** Action items are real tasks linked back through `Task.meetingId`. */
  actionItems: Task[];
  /** Linked call sessions and summaries if this meeting was conducted as a call. */
  calls?: CallView[];
}

export type CallSessionKind = 'AUDIO' | 'VIDEO';
export type CallSessionStatus = 'ACTIVE' | 'ENDED';
export type CallSummaryStatus =
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'EDITED'
  | 'APPROVED';

export interface CallParticipantView {
  id: string;
  callId: string;
  userId: string;
  joinedAt: IsoDateString;
  leftAt: IsoDateString | null;
  user: PublicUser;
}

export interface CallNoteView {
  id: string;
  callId: string;
  workspaceId: string;
  authorId: string;
  content: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  author: PublicUser;
}

export interface CallActionItemView {
  id: string;
  callId: string;
  summaryId: string | null;
  workspaceId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: IsoDateString | null;
  status: string;
  priority: TaskPriority;
  sourceTimestamp: number | null;
  taskId: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  assignee: PublicUser | null;
  task?: Task | null;
}

export interface CallDecisionView {
  id: string;
  callId: string;
  summaryId: string | null;
  workspaceId: string;
  content: string;
  sourceTimestamp: number | null;
  madeById: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  madeBy: PublicUser | null;
}

export interface CallTranscriptItemView {
  id: string;
  callId: string;
  speakerId: string | null;
  speakerName: string;
  text: string;
  timestamp: number;
  createdAt: IsoDateString;
}

export interface CallSummaryFeedbackView {
  id: string;
  summaryId: string;
  userId: string;
  rating: string;
  feedback: string | null;
  createdAt: IsoDateString;
  user?: PublicUser;
}

export interface CallSummaryView {
  id: string;
  callId: string;
  workspaceId: string;
  status: CallSummaryStatus;
  overview: string | null;
  keyPoints: string[];
  openQuestions: string[];
  followUps: string[];
  importantLinks: Array<{ title: string; url: string }>;
  rawContent: string | null;
  version: number;
  failureReason: string | null;
  generatedById: string | null;
  generatedAt: IsoDateString;
  updatedAt: IsoDateString;
  feedbacks?: CallSummaryFeedbackView[];
}

export interface CallView {
  id: string;
  workspaceId: string;
  conversationId: string;
  channelId: string | null;
  meetingId: string | null;
  title: string;
  kind: CallSessionKind;
  status: CallSessionStatus;
  startedById: string;
  startedAt: IsoDateString;
  endedAt: IsoDateString | null;
  recordingUrl: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  startedBy: PublicUser;
  participants: CallParticipantView[];
  summary?: CallSummaryView | null;
  /** Explicit shares on top of the default audience (participants + channel). */
  sharedWithWorkspace: boolean;
  sharedWithUserIds: string[];
  _count?: {
    notes: number;
    actionItems: number;
    decisions: number;
    transcripts: number;
  };
}

/**
 * `POST /calls/:id/end`. Both sides of a call report the hang-up; `endedNow`
 * is true only for the request that actually closed the session, so exactly
 * one client posts the summary card into the conversation.
 */
export interface EndCallResponse extends CallView {
  endedNow: boolean;
}

/**
 * The one realtime event for changes inside a call (`call.updated`). It carries
 * ids only — whoever may see the call refetches it through the access-checked
 * API, so the broadcast itself reveals nothing about a private call.
 */
export interface CallUpdatedRealtimePayload {
  callId: string;
  entity: 'call' | 'note' | 'summary' | 'action_item' | 'decision' | 'transcript';
  action: string;
  /** Summary status when `entity === 'summary'`. */
  status?: CallSummaryStatus;
}

export interface CallDetailView extends CallView {
  notes: CallNoteView[];
  summary: CallSummaryView | null;
  actionItems: CallActionItemView[];
  decisions: CallDecisionView[];
  transcripts: CallTranscriptItemView[];
}

export interface CallNotesAssistRequest {
  action:
    | 'summarize'
    | 'cleanup'
    | 'extract_actions'
    | 'extract_decisions'
    | 'generate_followup'
    | 'format';
  notes: string;
}

export interface CallNotesAssistResponse {
  result: string;
  actionItems?: Array<{ title: string; assigneeName?: string }>;
  decisions?: string[];
}

export interface AskCallQuestionRequest {
  question: string;
}

export interface AskCallQuestionResponse {
  answer: string;
  groundedTimestamps?: number[];
  citations?: string[];
}

/** A child entry in the docs tree — enough to draw the sidebar row. */
export interface WorkDocumentChild {
  id: string;
  title: string;
  kind: DocumentKind;
}

export interface WorkDocument {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  content: string;
  kind: DocumentKind;
  isPublic: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  author: PublicUser;
  children: WorkDocumentChild[];
}

export interface Whiteboard {
  id: string;
  workspaceId: string;
  name: string;
  /** Opaque JSON string: `{ nodes, edges }` for the canvas. */
  canvasData: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  author: PublicUser;
}

export interface WorkItemCustomField {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  teamId?: string | null;
  name: string;
  key: string;
  type: CustomFieldType;
  options?: string[];
  required: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SavedView {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  name: string;
  type: ViewType;
  filters: Record<string, unknown>;
  sorting?: Record<string, unknown>;
  grouping?: Record<string, unknown>;
  visibleColumns?: string[];
  isDefault: boolean;
  isShared: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface IntakeRequest {
  id: string;
  workspaceId: string;
  teamId?: string | null;
  projectId?: string | null;
  title: string;
  description: string | null;
  source: IntakeSource;
  requesterName: string | null;
  requesterEmail: string | null;
  priority: TaskPriority;
  slaDueDate?: IsoDateString | null;
  status: IntakeStatus;
  suggestedProjectId?: string | null;
  suggestedAssigneeId?: string | null;
  suggestedLabels?: string[];
  convertedWorkItemId?: string | null;
  aiAnalysis?: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  authorId: string;
  status: ProjectHealth;
  title: string;
  body: string | null;
  completedSummary?: string | null;
  inProgressSummary?: string | null;
  blockersSummary?: string | null;
  nextStepsSummary?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  author?: PublicUser;
}

export interface WorkItemActivity {
  id: string;
  workspaceId: string;
  workItemId: string;
  actorId: string | null;
  action: string;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: IsoDateString;
  actor?: PublicUser | null;
}
