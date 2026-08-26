import type {
  CycleStatus,
  CustomFieldType,
  DocumentKind,
  IdentifierPrefixMode,
  IntakeSource,
  IntakeStatus,
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

export interface WorkItemRelation {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  createdAt: IsoDateString;
  targetWorkItem?: Task;
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
  reporter?: PublicUser | null;
  project: TaskProjectRef | null;
  epic?: Epic | null;
  module?: Module | null;
  cycle?: Cycle | null;
  parent?: Task | null;
  subItems?: Task[];
  relations?: WorkItemRelation[];
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
