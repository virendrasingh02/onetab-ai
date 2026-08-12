import type {
  DocumentKind,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from './enums.js';
import type { IsoDateString, PublicUser } from './entities.js';

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

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  startDate: IsoDateString | null;
  targetDate: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** A project as the list and board screens receive it. */
export interface ProjectDetail extends Project {
  milestones: Milestone[];
  sprints: Sprint[];
  _count: { tasks: number };
}

/** The project badge carried on a task, without the full project payload. */
export interface TaskProjectRef {
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
