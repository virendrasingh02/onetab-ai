import type { Accent } from '@org/design-system';
import type { Priority } from '../types.js';
import {
  cellValue,
  cellValues,
  hasColumn,
  normalizeHeader,
  parseCsv,
  type CsvTable,
} from './csv.js';
import {
  ONETAB_EXPORT_KIND,
  parseBoolean,
  parsePriority,
  sortListNames,
  splitList,
  titleCase,
  toAccent,
  toISODay,
  type ImportSourceId,
  type NormalizedBoard,
  type NormalizedTask,
} from './normalize.js';

/**
 * One adapter per export format. Each one is handed the raw file text and
 * returns the flat {@link NormalizedBoard} shape; nothing here builds board
 * state directly, so adding a source is a single function plus a detector.
 */

export interface SourceDefinition {
  id: ImportSourceId;
  name: string;
  /** File types the source produces, for the picker and the file input. */
  accepts: string;
  /** Where to find the export in that product. */
  help: string;
}

export const IMPORT_SOURCES: readonly SourceDefinition[] = [
  {
    id: 'trello',
    name: 'Trello',
    accepts: '.json',
    help: 'Board menu → Print, export, and share → Export as JSON.',
  },
  {
    id: 'linear',
    name: 'Linear',
    accepts: '.csv',
    help: 'Workspace settings → Import / Export → Export CSV.',
  },
  {
    id: 'asana',
    name: 'Asana',
    accepts: '.csv',
    help: 'Project dropdown → Export / Print → CSV.',
  },
  {
    id: 'jira',
    name: 'Jira',
    accepts: '.csv',
    help: 'Issue search → Export → Export CSV (all fields).',
  },
  {
    id: 'github',
    name: 'GitHub Issues',
    accepts: '.json',
    help: 'gh issue list --json number,title,body,state,labels,assignees,milestone,createdAt',
  },
  {
    id: 'onetab',
    name: 'OneTab board',
    accepts: '.json',
    help: 'A board exported from here, for backup or moving between workspaces.',
  },
  {
    id: 'csv',
    name: 'Other CSV',
    accepts: '.csv,.tsv,.txt',
    help: 'Monday, Notion, ClickUp, Basecamp, a spreadsheet — map the columns yourself.',
  },
];

export const ACCEPTED_FILE_TYPES = '.json,.csv,.tsv,.txt';

/* -------------------------------------------------------------- mapping --- */

/** Column mapping for the generic CSV adapter, by header name. */
export interface CsvFieldMapping {
  title: string;
  description?: string;
  list?: string;
  labels?: string;
  assignee?: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  completed?: string;
}

export type CsvFieldKey = keyof CsvFieldMapping;

export const CSV_FIELDS: { key: CsvFieldKey; label: string; required?: boolean }[] = [
  { key: 'title', label: 'Title', required: true },
  { key: 'list', label: 'Column / status' },
  { key: 'description', label: 'Description' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'labels', label: 'Labels / tags' },
  { key: 'priority', label: 'Priority' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'createdAt', label: 'Created at' },
  { key: 'completed', label: 'Completed' },
];

/** Header names each field answers to, best guess first. */
const FIELD_CANDIDATES: Record<CsvFieldKey, string[]> = {
  title: ['Title', 'Name', 'Summary', 'Task', 'Task Name', 'Subject', 'Issue'],
  description: ['Description', 'Notes', 'Body', 'Details', 'Content'],
  list: ['Status', 'Section/Column', 'Column', 'Section', 'State', 'Group', 'Stage', 'List', 'Bucket'],
  labels: ['Labels', 'Tags', 'Label', 'Tag', 'Categories', 'Components'],
  assignee: [
    'Assignee',
    'Assignees',
    'Assigned To',
    // Notion and Monday label the person column with a verb.
    'Assign',
    'Assigned',
    'Owner',
    'Person',
    'Responsible',
  ],
  priority: ['Priority', 'Urgency', 'Severity', 'Importance'],
  dueDate: ['Due Date', 'Due', 'Deadline', 'Target Date', 'End Date', 'Due On'],
  createdAt: ['Created At', 'Created', 'Created On', 'Date Created', 'Opened'],
  completed: ['Completed', 'Completed At', 'Done', 'Resolved', 'Closed At', 'Resolution'],
};

/** Pre-fills the mapping editor by matching headers against known aliases. */
export function guessMapping(table: CsvTable): CsvFieldMapping {
  const byKey = new Map(
    table.headers.map((header) => [normalizeHeader(header), header]),
  );

  const pick = (field: CsvFieldKey): string | undefined => {
    for (const candidate of FIELD_CANDIDATES[field]) {
      const match = byKey.get(normalizeHeader(candidate));
      if (match) return match;
    }
    return undefined;
  };

  return {
    title: pick('title') ?? table.headers[0] ?? '',
    description: pick('description'),
    list: pick('list'),
    labels: pick('labels'),
    assignee: pick('assignee'),
    priority: pick('priority'),
    dueDate: pick('dueDate'),
    createdAt: pick('createdAt'),
    completed: pick('completed'),
  };
}

export interface ParseOptions {
  /** Overrides the column each adapter would otherwise group by. */
  groupBy?: string;
  /** Generic CSV only. */
  mapping?: CsvFieldMapping;
  /** Falls back to the file name when the export carries no board name. */
  fallbackTitle?: string;
}

/* --------------------------------------------------------------- Trello --- */

interface TrelloExport {
  name?: string;
  closed?: boolean;
  lists?: { id: string; name: string; closed?: boolean; pos?: number }[];
  cards?: {
    id: string;
    name: string;
    desc?: string;
    idList: string;
    idLabels?: string[];
    idMembers?: string[];
    due?: string | null;
    dueComplete?: boolean;
    closed?: boolean;
    pos?: number;
    dateLastActivity?: string;
  }[];
  labels?: { id: string; name?: string; color?: string }[];
  members?: { id: string; fullName?: string; username?: string }[];
  checklists?: {
    id: string;
    idCard: string;
    name?: string;
    checkItems?: { id: string; name: string; state?: string; pos?: number }[];
  }[];
  actions?: {
    type: string;
    date?: string;
    data?: { text?: string; card?: { id?: string } };
    memberCreator?: { fullName?: string; username?: string };
  }[];
}

function parseTrello(raw: TrelloExport, options: ParseOptions): NormalizedBoard {
  const byPos = <T extends { pos?: number }>(a: T, b: T) =>
    (a.pos ?? 0) - (b.pos ?? 0);

  const lists = [...(raw.lists ?? [])].sort(byPos);
  const listNames = new Map(lists.map((list) => [list.id, list.name]));
  // A card in an archived list is archived too, even when its own flag is off.
  const closedLists = new Set(
    lists.filter((list) => list.closed).map((list) => list.id),
  );

  const labelColors: Record<string, Accent> = {};
  const labelNames = new Map<string, string>();
  for (const label of raw.labels ?? []) {
    // Trello allows colour-only labels; showing "Purple" beats showing nothing.
    const name = label.name?.trim() || titleCase(label.color ?? 'label');
    labelNames.set(label.id, name);
    labelColors[name] = toAccent(label.color, name);
  }

  const memberNames = new Map(
    (raw.members ?? []).map((member) => [
      member.id,
      member.fullName?.trim() || member.username || 'Member',
    ]),
  );

  const checklistsByCard = new Map<string, { text: string; done: boolean }[]>();
  for (const checklist of raw.checklists ?? []) {
    const items = [...(checklist.checkItems ?? [])]
      .sort(byPos)
      .map((item) => ({ text: item.name, done: item.state === 'complete' }));
    if (items.length === 0) continue;
    const existing = checklistsByCard.get(checklist.idCard);
    if (existing) existing.push(...items);
    else checklistsByCard.set(checklist.idCard, items);
  }

  const commentsByCard = new Map<
    string,
    { author?: string; body: string; createdAt?: string }[]
  >();
  for (const action of raw.actions ?? []) {
    if (action.type !== 'commentCard') continue;
    const cardId = action.data?.card?.id;
    const body = action.data?.text;
    if (!cardId || !body) continue;
    const entry = {
      author:
        action.memberCreator?.fullName?.trim() ||
        action.memberCreator?.username,
      body,
      createdAt: action.date,
    };
    const existing = commentsByCard.get(cardId);
    if (existing) existing.push(entry);
    else commentsByCard.set(cardId, [entry]);
  }

  const tasks: NormalizedTask[] = [...(raw.cards ?? [])]
    .sort(byPos)
    .map((card) => ({
      externalId: card.id,
      title: card.name,
      description: card.desc,
      listName: listNames.get(card.idList) ?? 'Imported',
      labels: (card.idLabels ?? [])
        .map((id) => labelNames.get(id))
        .filter((name): name is string => Boolean(name)),
      assignees: (card.idMembers ?? [])
        .map((id) => memberNames.get(id))
        .filter((name): name is string => Boolean(name)),
      // Trello has no priority field; labels named for one are the convention.
      priority: (card.idLabels ?? [])
        .map((id) => parsePriority(labelNames.get(id)))
        .find((value): value is Priority => Boolean(value)),
      dueDate: toISODay(card.due ?? undefined),
      completed: card.dueComplete,
      createdAt: card.dateLastActivity,
      checklist: checklistsByCard.get(card.id),
      comments: commentsByCard.get(card.id),
      archived: Boolean(card.closed) || closedLists.has(card.idList),
    }));

  return {
    title: raw.name?.trim() || options.fallbackTitle || 'Trello board',
    source: 'trello',
    // Trello's own column order is the user's arrangement — don't re-rank it.
    listOrder: lists.map((list) => list.name),
    archivedLists: lists
      .filter((list) => list.closed)
      .map((list) => list.name),
    tasks,
    labelColors,
  };
}

/* ----------------------------------------------------------- GitHub JSON --- */

interface GithubIssue {
  number?: number;
  title?: string;
  body?: string;
  state?: string;
  labels?: (string | { name?: string })[];
  assignees?: (string | { login?: string; name?: string })[];
  milestone?: string | { title?: string };
  createdAt?: string;
  created_at?: string;
  closedAt?: string;
  closed_at?: string;
  pull_request?: unknown;
  url?: string;
  html_url?: string;
}

function parseGithub(
  raw: GithubIssue[],
  options: ParseOptions,
): NormalizedBoard {
  const name = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const entry = value as { name?: string; login?: string; title?: string };
      return entry.name ?? entry.login ?? entry.title;
    }
    return undefined;
  };

  // `gh issue list` excludes PRs, but the REST endpoint folds them in.
  const issues = raw.filter((issue) => !issue.pull_request);

  const tasks: NormalizedTask[] = issues.map((issue) => {
    const closed = (issue.state ?? '').toLowerCase() === 'closed';
    const milestone = name(issue.milestone);

    return {
      externalId: issue.number ? `#${issue.number}` : undefined,
      title: issue.title ?? 'Untitled issue',
      description: issue.body,
      // Grouping by milestone when the repo uses them gives a board with real
      // columns; otherwise open/closed is the only signal available.
      listName:
        options.groupBy === 'state'
          ? closed
            ? 'Done'
            : 'Open'
          : milestone ?? (closed ? 'Done' : 'Open'),
      labels: (issue.labels ?? [])
        .map(name)
        .filter((value): value is string => Boolean(value)),
      assignees: (issue.assignees ?? [])
        .map(name)
        .filter((value): value is string => Boolean(value)),
      priority: (issue.labels ?? [])
        .map((label) => parsePriority(name(label)))
        .find((value): value is Priority => Boolean(value)),
      milestone,
      completed: closed,
      createdAt: issue.createdAt ?? issue.created_at,
      archived: false,
    };
  });

  return {
    title: options.fallbackTitle || 'GitHub issues',
    source: 'github',
    listOrder: sortListNames([...new Set(tasks.map((task) => task.listName))]),
    tasks,
  };
}

/* ------------------------------------------------------------------ CSV --- */

/** Reads a task's column name, honouring a user-chosen grouping override. */
function listNameFor(
  table: CsvTable,
  row: string[],
  defaults: string[],
  options: ParseOptions,
  fallback: string,
): string {
  const names = options.groupBy ? [options.groupBy, ...defaults] : defaults;
  return cellValue(table, row, names) || fallback;
}

const LINEAR_COLUMNS = {
  id: ['ID', 'Identifier'],
  title: ['Title'],
  description: ['Description'],
  status: ['Status', 'State'],
  priority: ['Priority'],
  assignee: ['Assignee'],
  creator: ['Creator'],
  labels: ['Labels'],
  due: ['Due Date'],
  created: ['Created'],
  completed: ['Completed'],
  canceled: ['Canceled'],
  project: ['Project'],
  milestone: ['Project Milestone'],
  initiative: ['Initiative'],
  parent: ['Parent issue'],
  cycle: ['Cycle Name', 'Cycle Number'],
} as const;

function parseLinear(table: CsvTable, options: ParseOptions): NormalizedBoard {
  const tasks: NormalizedTask[] = table.rows.map((row) => {
    const status = cellValue(table, row, LINEAR_COLUMNS.status);
    const canceled = Boolean(cellValue(table, row, LINEAR_COLUMNS.canceled));

    return {
      externalId: cellValue(table, row, LINEAR_COLUMNS.id) || undefined,
      title: cellValue(table, row, LINEAR_COLUMNS.title),
      description: cellValue(table, row, LINEAR_COLUMNS.description),
      listName: listNameFor(table, row, [...LINEAR_COLUMNS.status], options, 'Backlog'),
      labels: splitList(cellValue(table, row, LINEAR_COLUMNS.labels)),
      assignees: splitList(cellValue(table, row, LINEAR_COLUMNS.assignee)),
      creator: cellValue(table, row, LINEAR_COLUMNS.creator) || undefined,
      priority: parsePriority(cellValue(table, row, LINEAR_COLUMNS.priority)),
      dueDate: toISODay(cellValue(table, row, LINEAR_COLUMNS.due)),
      completed: Boolean(cellValue(table, row, LINEAR_COLUMNS.completed)),
      createdAt: cellValue(table, row, LINEAR_COLUMNS.created),
      milestone: cellValue(table, row, LINEAR_COLUMNS.milestone) || undefined,
      initiative: cellValue(table, row, LINEAR_COLUMNS.initiative) || undefined,
      relations: splitList(cellValue(table, row, LINEAR_COLUMNS.parent)),
      // Cancelled issues carry a timestamp rather than a distinct status in
      // some workspaces, so both signals are checked.
      archived: canceled || /^cancell?ed$/i.test(status),
    };
  });

  const title =
    // A Linear export is usually scoped to one project; if it is, use its name.
    new Set(
      table.rows
        .map((row) => cellValue(table, row, LINEAR_COLUMNS.project))
        .filter(Boolean),
    ).size === 1
      ? cellValue(table, table.rows[0], LINEAR_COLUMNS.project)
      : options.fallbackTitle || 'Linear issues';

  return {
    title,
    source: 'linear',
    listOrder: sortListNames([...new Set(tasks.map((task) => task.listName))]),
    tasks,
  };
}

const ASANA_COLUMNS = {
  id: ['Task ID'],
  title: ['Name'],
  notes: ['Notes', 'Description'],
  section: ['Section/Column', 'Section', 'Column'],
  projects: ['Projects'],
  assignee: ['Assignee'],
  tags: ['Tags'],
  due: ['Due Date'],
  start: ['Start Date'],
  created: ['Created At'],
  completed: ['Completed At'],
  priority: ['Priority'],
  parent: ['Parent task', 'Parent Task'],
} as const;

function parseAsana(table: CsvTable, options: ParseOptions): NormalizedBoard {
  const warnings: string[] = [];

  const rows = table.rows.map((row) => ({
    id: cellValue(table, row, ASANA_COLUMNS.id),
    title: cellValue(table, row, ASANA_COLUMNS.title),
    parent: cellValue(table, row, ASANA_COLUMNS.parent),
    completedAt: cellValue(table, row, ASANA_COLUMNS.completed),
    row,
  }));

  /*
   * Asana exports subtasks as their own rows, linked by parent *name*. Left
   * alone they arrive as loose cards with no context; folding them into the
   * parent's checklist is what the board's checklist is for.
   */
  const parents = new Map(
    rows.filter((entry) => !entry.parent).map((entry) => [entry.title, entry]),
  );
  const subtasks = new Map<string, { text: string; done: boolean }[]>();
  let orphanSubtasks = 0;

  for (const entry of rows) {
    if (!entry.parent) continue;
    if (!parents.has(entry.parent)) {
      orphanSubtasks += 1;
      continue;
    }
    const items = subtasks.get(entry.parent) ?? [];
    items.push({ text: entry.title, done: Boolean(entry.completedAt) });
    subtasks.set(entry.parent, items);
  }

  if (orphanSubtasks > 0) {
    warnings.push(
      `${orphanSubtasks} subtask${orphanSubtasks === 1 ? '' : 's'} had no parent in this export and were imported as cards.`,
    );
  }

  const tasks: NormalizedTask[] = rows
    .filter((entry) => !entry.parent || !parents.has(entry.parent))
    .map(({ row, title, id, completedAt }) => ({
      externalId: id || undefined,
      title,
      description: cellValue(table, row, ASANA_COLUMNS.notes),
      listName: listNameFor(
        table,
        row,
        [...ASANA_COLUMNS.section, ...ASANA_COLUMNS.projects],
        options,
        'Untitled section',
      ),
      labels: splitList(cellValue(table, row, ASANA_COLUMNS.tags)),
      assignees: splitList(cellValue(table, row, ASANA_COLUMNS.assignee)),
      priority: parsePriority(cellValue(table, row, ASANA_COLUMNS.priority)),
      dueDate: toISODay(cellValue(table, row, ASANA_COLUMNS.due)),
      completed: Boolean(completedAt),
      createdAt: cellValue(table, row, ASANA_COLUMNS.created),
      checklist: subtasks.get(title),
      archived: false,
    }));

  const projects = new Set(
    table.rows
      .map((row) => cellValue(table, row, ASANA_COLUMNS.projects))
      .filter(Boolean),
  );

  return {
    title:
      projects.size === 1
        ? [...projects][0]
        : options.fallbackTitle || 'Asana project',
    source: 'asana',
    // Section order in an Asana CSV is the project's own order.
    listOrder: [...new Set(tasks.map((task) => task.listName))],
    tasks,
    warnings,
  };
}

const JIRA_COLUMNS = {
  key: ['Issue key', 'Key'],
  title: ['Summary'],
  description: ['Description'],
  status: ['Status'],
  priority: ['Priority'],
  assignee: ['Assignee'],
  reporter: ['Reporter', 'Creator'],
  labels: ['Labels', 'Component/s', 'Components'],
  due: ['Due Date', 'Due date'],
  created: ['Created'],
  resolution: ['Resolution'],
  project: ['Project name', 'Project'],
  sprint: ['Sprint'],
  parent: ['Parent', 'Parent id'],
  epic: ['Custom field (Epic Link)', 'Epic Link'],
} as const;

function parseJira(table: CsvTable, options: ParseOptions): NormalizedBoard {
  const tasks: NormalizedTask[] = table.rows.map((row) => {
    const status = cellValue(table, row, JIRA_COLUMNS.status);
    const resolution = cellValue(table, row, JIRA_COLUMNS.resolution);

    return {
      externalId: cellValue(table, row, JIRA_COLUMNS.key) || undefined,
      title: cellValue(table, row, JIRA_COLUMNS.title),
      description: cellValue(table, row, JIRA_COLUMNS.description),
      listName: listNameFor(table, row, [...JIRA_COLUMNS.status], options, 'To Do'),
      // Jira writes one `Labels` column per value instead of joining them.
      labels: cellValues(table, row, JIRA_COLUMNS.labels),
      assignees: splitList(cellValue(table, row, JIRA_COLUMNS.assignee)),
      creator: cellValue(table, row, JIRA_COLUMNS.reporter) || undefined,
      priority: parsePriority(cellValue(table, row, JIRA_COLUMNS.priority)),
      dueDate: toISODay(cellValue(table, row, JIRA_COLUMNS.due)),
      completed: Boolean(resolution) && !/unresolved/i.test(resolution),
      createdAt: cellValue(table, row, JIRA_COLUMNS.created),
      milestone: cellValue(table, row, JIRA_COLUMNS.sprint) || undefined,
      initiative: cellValue(table, row, JIRA_COLUMNS.epic) || undefined,
      relations: splitList(cellValue(table, row, JIRA_COLUMNS.parent)),
      // Jira ships "Won't Fix" with a curly or straight apostrophe depending on
      // the instance's language pack, so the quote is optional here.
      archived:
        /^(cancell?ed|won.?t ?fix|duplicate)$/i.test(resolution ?? '') ||
        /^cancell?ed$/i.test(status),
    };
  });

  const projects = new Set(
    table.rows
      .map((row) => cellValue(table, row, JIRA_COLUMNS.project))
      .filter(Boolean),
  );

  return {
    title:
      projects.size === 1
        ? [...projects][0]
        : options.fallbackTitle || 'Jira issues',
    source: 'jira',
    listOrder: sortListNames([...new Set(tasks.map((task) => task.listName))]),
    tasks,
  };
}

function parseGenericCsv(
  table: CsvTable,
  options: ParseOptions,
): NormalizedBoard {
  const mapping = options.mapping ?? guessMapping(table);
  const read = (row: string[], header?: string): string =>
    header ? cellValue(table, row, [header]) : '';

  const tasks: NormalizedTask[] = table.rows.map((row) => {
    const completedCell = read(row, mapping.completed);

    return {
      title: read(row, mapping.title),
      description: read(row, mapping.description),
      listName:
        (options.groupBy ? read(row, options.groupBy) : '') ||
        read(row, mapping.list) ||
        'Imported',
      labels: splitList(read(row, mapping.labels)),
      assignees: splitList(read(row, mapping.assignee)),
      priority: parsePriority(read(row, mapping.priority)),
      dueDate: toISODay(read(row, mapping.dueDate)),
      // The column may hold a flag ("yes") or a completion timestamp; both
      // read as done, and anything unparseable but present counts as a date.
      completed: completedCell
        ? parseBoolean(completedCell) || Boolean(toISODay(completedCell))
        : undefined,
      createdAt: read(row, mapping.createdAt),
      archived: false,
    };
  });

  return {
    title: options.fallbackTitle || 'Imported board',
    source: 'csv',
    listOrder: sortListNames([...new Set(tasks.map((task) => task.listName))]),
    tasks,
  };
}

/* ------------------------------------------------------- OneTab re-import --- */

function parseOnetab(raw: unknown, options: ParseOptions): NormalizedBoard {
  const payload = raw as { board?: unknown; lists?: unknown; title?: string };
  const board = (
    payload.board && typeof payload.board === 'object' ? payload.board : payload
  ) as {
    title?: string;
    lists?: { title?: string; cards?: Record<string, unknown>[] }[];
    labels?: { id: string; name: string; color?: string }[];
    members?: { id: string; name: string }[];
  };

  const labelNames = new Map(
    (board.labels ?? []).map((label) => [label.id, label.name]),
  );
  const labelColors: Record<string, Accent> = {};
  for (const label of board.labels ?? []) {
    labelColors[label.name] = toAccent(label.color, label.name);
  }
  const memberNames = new Map(
    (board.members ?? []).map((member) => [member.id, member.name]),
  );

  const tasks: NormalizedTask[] = [];
  for (const list of board.lists ?? []) {
    for (const card of list.cards ?? []) {
      const entry = card as {
        id?: string;
        title?: string;
        description?: string;
        labelIds?: string[];
        memberIds?: string[];
        creatorId?: string;
        priority?: Priority;
        dueDate?: string;
        dueComplete?: boolean;
        createdAt?: string;
        milestone?: string;
        initiative?: string;
        relations?: string[];
        checklist?: { text: string; done: boolean }[];
        comments?: { authorId?: string; body: string; createdAt?: string }[];
      };

      tasks.push({
        externalId: entry.id,
        title: entry.title ?? 'Untitled',
        description: entry.description,
        listName: list.title ?? 'Imported',
        labels: (entry.labelIds ?? [])
          .map((id) => labelNames.get(id))
          .filter((name): name is string => Boolean(name)),
        assignees: (entry.memberIds ?? [])
          .map((id) => memberNames.get(id))
          .filter((name): name is string => Boolean(name)),
        creator: entry.creatorId ? memberNames.get(entry.creatorId) : undefined,
        priority: entry.priority,
        dueDate: entry.dueDate,
        completed: entry.dueComplete,
        createdAt: entry.createdAt,
        milestone: entry.milestone,
        initiative: entry.initiative,
        relations: entry.relations,
        checklist: entry.checklist,
        comments: (entry.comments ?? []).map((comment) => ({
          author: comment.authorId ? memberNames.get(comment.authorId) : undefined,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
      });
    }
  }

  return {
    title: board.title?.trim() || options.fallbackTitle || 'Imported board',
    source: 'onetab',
    listOrder: (board.lists ?? []).map((list) => list.title ?? 'Imported'),
    tasks,
    labelColors,
  };
}

/* -------------------------------------------------------------- detect --- */

function looksLikeJson(text: string): boolean {
  const head = text.trimStart()[0];
  return head === '{' || head === '[';
}

/**
 * Identifies the export by its distinguishing fields rather than by file name,
 * since a download is as likely to be called `export (3).csv` as anything.
 * Returns `undefined` when nothing matches confidently — the caller then falls
 * back to generic CSV mapping and lets the user pick.
 */
export function detectSource(
  text: string,
  fileName?: string,
): ImportSourceId | undefined {
  if (looksLikeJson(text)) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return undefined;
    }

    if (Array.isArray(raw)) {
      const first = raw[0] as Record<string, unknown> | undefined;
      if (
        first &&
        ('html_url' in first || 'node_id' in first || 'number' in first)
      ) {
        return 'github';
      }
      return undefined;
    }

    const object = raw as Record<string, unknown>;
    if (object.kind === ONETAB_EXPORT_KIND) return 'onetab';
    if (Array.isArray(object.lists) && Array.isArray(object.cards)) {
      return 'trello';
    }
    // Our own board shape: lists holding their own cards.
    if (
      Array.isArray(object.lists) &&
      Array.isArray(object.labels) &&
      'currentMemberId' in object
    ) {
      return 'onetab';
    }
    return undefined;
  }

  const table = parseCsv(text);
  if (table.headers.length === 0) return undefined;

  if (hasColumn(table, ['Issue key']) || hasColumn(table, ['Issue Type'])) {
    return 'jira';
  }
  if (hasColumn(table, ['Task ID']) || hasColumn(table, ['Section/Column'])) {
    return 'asana';
  }
  // Linear has no single unique header, but this trio only co-occurs there.
  if (
    hasColumn(table, ['Team']) &&
    hasColumn(table, ['Status']) &&
    (hasColumn(table, ['Estimate']) || hasColumn(table, ['Cycle Number']))
  ) {
    return 'linear';
  }
  if (fileName && /linear/i.test(fileName) && hasColumn(table, ['Status'])) {
    return 'linear';
  }

  return 'csv';
}

/* ---------------------------------------------------------------- parse --- */

export interface ParsedFile {
  source: ImportSourceId;
  board: NormalizedBoard;
  /** Present for CSV sources, so the UI can offer column mapping. */
  table?: CsvTable;
  mapping?: CsvFieldMapping;
}

export class ImportError extends Error {}

/**
 * Reads `text` as `source`. Throws {@link ImportError} with a message meant for
 * the dialog when the file cannot be read as that format.
 */
export function parseImport(
  text: string,
  source: ImportSourceId,
  options: ParseOptions = {},
): ParsedFile {
  if (!text.trim()) throw new ImportError('That file is empty.');

  if (source === 'trello' || source === 'github' || source === 'onetab') {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ImportError(
        `A ${source === 'trello' ? 'Trello' : source === 'github' ? 'GitHub' : 'OneTab'} export must be JSON, and this file is not valid JSON.`,
      );
    }

    if (source === 'github') {
      const issues = Array.isArray(raw)
        ? raw
        : (raw as { issues?: unknown }).issues;
      if (!Array.isArray(issues)) {
        throw new ImportError(
          'Expected a JSON array of issues, like the output of `gh issue list --json ...`.',
        );
      }
      return { source, board: parseGithub(issues as GithubIssue[], options) };
    }

    if (source === 'trello') {
      const board = raw as TrelloExport;
      if (!Array.isArray(board.cards) || !Array.isArray(board.lists)) {
        throw new ImportError(
          'This does not look like a Trello board export — no `lists` and `cards` were found.',
        );
      }
      return { source, board: parseTrello(board, options) };
    }

    const board = parseOnetab(raw, options);
    if (board.tasks.length === 0 && board.listOrder.length === 0) {
      throw new ImportError('No board was found in this file.');
    }
    return { source, board };
  }

  const table = parseCsv(text);
  if (table.headers.length === 0) {
    throw new ImportError('No columns were found — is this a CSV file?');
  }
  if (table.rows.length === 0) {
    throw new ImportError('That CSV has headers but no rows.');
  }

  const mapping = options.mapping ?? guessMapping(table);

  switch (source) {
    case 'linear':
      return { source, board: parseLinear(table, options), table, mapping };
    case 'asana':
      return { source, board: parseAsana(table, options), table, mapping };
    case 'jira':
      return { source, board: parseJira(table, options), table, mapping };
    default: {
      if (!mapping.title) {
        throw new ImportError('Pick which column holds the task title.');
      }
      return {
        source: 'csv',
        board: parseGenericCsv(table, { ...options, mapping }),
        table,
        mapping,
      };
    }
  }
}

/** Detects the format, then parses. */
export function parseImportAuto(
  text: string,
  fileName?: string,
  options: ParseOptions = {},
): ParsedFile {
  const detected = detectSource(text, fileName);
  if (!detected) {
    throw new ImportError(
      'Could not recognise this file. Pick the source it came from and try again.',
    );
  }
  return parseImport(text, detected, options);
}
