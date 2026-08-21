import type {
  DocumentKind,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
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

/**
 * `icon`/`iconColor` come from `IconSelection` and follow the same rules as a
 * workspace's. They sit alongside `color` rather than replacing it: the colour
 * still tints boards, progress bars and task badges, while the icon takes the
 * place of the plain swatch wherever the project is named.
 */
export interface Project extends IconSelection {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  startDate: IsoDateString | null;
  targetDate: IsoDateString | null;
  /**
   * The board's columns, left to right.
   *
   * The set is fixed — it is `TaskStatus` — so only the order belongs to the
   * project. A status missing from the list is drawn after the ones that are in
   * it, in enum order, so a new column can never go unseen.
   */
  columnOrder: TaskStatus[];
  /** Uppercase stem of this project's ticket ids, e.g. `WEB` in `WEB-42`. */
  ticketPrefix: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** A project as the list and board screens receive it. */
export interface ProjectDetail extends Project {
  milestones: Milestone[];
  sprints: Sprint[];
  _count: { tasks: number };
}

/**
 * The project badge carried on a task, without the full project payload.
 *
 * It carries the icon as well as the colour so a card can draw the project the
 * same way the sidebar and the gallery do, without loading the project itself.
 */
export interface TaskProjectRef extends IconSelection {
  id: string;
  name: string;
  slug: string;
  color: string | null;
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
  /** Position within its status column. Lower sorts first. */
  orderIndex: number;
  /**
   * This task's number within its project. With the project's `ticketPrefix` it
   * makes the card's human-readable id. Null for a task filed outside any
   * project, which has no prefix to hang a number off.
   */
  ticketNumber: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  assignee: PublicUser | null;
  project: TaskProjectRef | null;
  _count: { comments: number };
}

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
