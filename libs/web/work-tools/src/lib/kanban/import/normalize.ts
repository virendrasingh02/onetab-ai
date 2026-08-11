import { accentFor, type Accent } from '@org/design-system';
import { createId } from '../board-state.js';
import type {
  BoardLabel,
  BoardMember,
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
} from '../types.js';

/**
 * The shape every importer produces.
 *
 * Adapters only have to describe *what the export said* — flat tasks with
 * plain-text list, label, and assignee names. Turning names into the board's
 * id-keyed entities happens once, here, so a new source never has to think
 * about label palettes or member de-duplication.
 */

export type ImportSourceId =
  | 'trello'
  | 'linear'
  | 'asana'
  | 'jira'
  | 'github'
  | 'onetab'
  | 'csv';

export interface NormalizedTask {
  /** The key in the source system, kept so a re-import can be recognised. */
  externalId?: string;
  title: string;
  description?: string;
  /** Column name; grouped into lists by {@link buildBoardState}. */
  listName: string;
  labels?: string[];
  assignees?: string[];
  creator?: string;
  priority?: Priority;
  /** `yyyy-mm-dd`. */
  dueDate?: string;
  completed?: boolean;
  createdAt?: string;
  milestone?: string;
  initiative?: string;
  relations?: string[];
  checklist?: { text: string; done: boolean }[];
  comments?: { author?: string; body: string; createdAt?: string }[];
  /** Archived, closed, or cancelled at the source. Excluded unless asked for. */
  archived?: boolean;
}

export interface NormalizedBoard {
  title: string;
  source: ImportSourceId;
  /** Column order as the source presented it; unknown names are appended. */
  listOrder: string[];
  /**
   * Columns the source itself marked archived (a closed Trello list). Dropped
   * along with their cards unless archived items are being imported.
   */
  archivedLists?: string[];
  tasks: NormalizedTask[];
  /** Colours the source supplied, by label name. Others are derived. */
  labelColors?: Record<string, Accent>;
  /** Things that could not be carried over, surfaced before the user commits. */
  warnings?: string[];
}

export interface BuildOptions {
  /** Bring across archived / closed / cancelled items too. */
  includeArchived?: boolean;
  /** Overrides the board name taken from the file. */
  title?: string;
}

/**
 * The whole board lives in `localStorage`, so an unbounded import would throw
 * a quota error halfway through and leave nothing behind. Truncating with a
 * warning fails visibly instead.
 */
export const MAX_IMPORTED_CARDS = 2000;

/* ------------------------------------------------------------- priority --- */

/**
 * Priority vocabularies across the supported tools. Linear also exports
 * priority as `0`–`4` (0 being unset), which is why the digits appear.
 */
const PRIORITY_ALIASES: Record<string, Priority> = {
  urgent: 'URGENT',
  critical: 'URGENT',
  highest: 'URGENT',
  blocker: 'URGENT',
  immediate: 'URGENT',
  p0: 'URGENT',
  '1': 'URGENT',
  high: 'HIGH',
  major: 'HIGH',
  important: 'HIGH',
  p1: 'HIGH',
  '2': 'HIGH',
  medium: 'MEDIUM',
  normal: 'MEDIUM',
  moderate: 'MEDIUM',
  default: 'MEDIUM',
  p2: 'MEDIUM',
  '3': 'MEDIUM',
  low: 'LOW',
  minor: 'LOW',
  lowest: 'LOW',
  trivial: 'LOW',
  p3: 'LOW',
  p4: 'LOW',
  '4': 'LOW',
};

export function parsePriority(value?: string): Priority | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return PRIORITY_ALIASES[key];
}

/* ----------------------------------------------------------------- date --- */

/**
 * Normalises a source date to the board's `yyyy-mm-dd`.
 *
 * ISO timestamps are sliced rather than parsed: every one of these tools emits
 * UTC, and `new Date('2026-08-06T00:30:00Z')` renders as the 5th anywhere west
 * of Greenwich — the due date would silently shift a day on import.
 */
export function toISODay(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Spreadsheet round-trips produce `m/d/yyyy`. These exporters are US-locale
  // by default, so month-first is the right reading.
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(trimmed);
  if (slashed) {
    const [, month, day, rawYear] = slashed;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

/** A full timestamp for `createdAt`, falling back to now. */
export function toISOTimestamp(value?: string): string {
  if (value) {
    const parsed = new Date(value.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

/* --------------------------------------------------------------- fields --- */

/** Splits a delimited cell (`bug, ui, p1`) into trimmed values. */
export function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseBoolean(value?: string): boolean {
  if (!value) return false;
  const key = value.trim().toLowerCase();
  return key === 'true' || key === 'yes' || key === 'y' || key === '1' || key === 'done' || key === 'complete' || key === 'completed';
}

/** List names that mean "finished", used to tick off imported cards. */
const DONE_NAMES =
  /^(done|closed|resolved|complete[d]?|shipped|approved|archived|cancell?ed)\b/i;

export function isDoneList(name: string): boolean {
  return DONE_NAMES.test(name.trim());
}

/**
 * Canonical workflow order. Sources that group by status hand back column names
 * in whatever order the rows happened to appear, which puts `Done` first about
 * as often as not; ranking known names restores a board that reads left to
 * right. Unrecognised names keep their first-seen order, after these.
 */
const WORKFLOW_RANK: [RegExp, number][] = [
  [/^(icebox|idea)/i, 0],
  [/^(backlog|triage|inbox|new|reported|open)/i, 1],
  [/^(to ?do|not ?started|planned|selected|ready|next|up next)/i, 2],
  [/^(in progress|doing|started|development|investigating|active)/i, 3],
  [/^(in review|review|code review|qa|testing|verify)/i, 4],
  [/^(blocked|on hold|waiting)/i, 5],
  [/^(done|closed|resolved|complete|shipped|approved)/i, 6],
  [/^(cancell?ed|duplicate|wont ?fix|archived)/i, 7],
];

export function sortListNames(names: string[]): string[] {
  const rankOf = (name: string): number => {
    for (const [pattern, rank] of WORKFLOW_RANK) {
      if (pattern.test(name.trim())) return rank;
    }
    return 5.5; // Between "blocked" and "done": unknown work isn't finished.
  };

  return names
    .map((name, position) => ({ name, position, rank: rankOf(name) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((entry) => entry.name);
}

/* -------------------------------------------------------------- builder --- */

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

/**
 * Turns a normalised export into board state: names become ids, tasks become
 * cards, and column names become ordered lists.
 */
export function buildBoardState(
  normalized: NormalizedBoard,
  options: BuildOptions = {},
): { board: BoardState; warnings: string[] } {
  const warnings = [...(normalized.warnings ?? [])];

  const excluded = options.includeArchived
    ? []
    : normalized.tasks.filter((task) => task.archived);
  let tasks = options.includeArchived
    ? normalized.tasks
    : normalized.tasks.filter((task) => !task.archived);

  const archivedCount = excluded.length;
  if (archivedCount > 0) {
    warnings.push(
      `${archivedCount} archived or closed ${archivedCount === 1 ? 'item was' : 'items were'} skipped.`,
    );
  }

  if (tasks.length > MAX_IMPORTED_CARDS) {
    warnings.push(
      `Import capped at ${MAX_IMPORTED_CARDS} cards; ${tasks.length - MAX_IMPORTED_CARDS} were left out.`,
    );
    tasks = tasks.slice(0, MAX_IMPORTED_CARDS);
  }

  /* labels ---------------------------------------------------------------- */

  const labels: BoardLabel[] = [];
  const labelIds = new Map<string, string>();

  const labelId = (name: string): string => {
    const key = name.toLowerCase();
    const existing = labelIds.get(key);
    if (existing) return existing;
    const id = createId('l');
    labelIds.set(key, id);
    labels.push({
      id,
      name,
      // A source-supplied colour wins; otherwise the hash keeps a given label
      // the same colour across separate imports of the same project.
      color: normalized.labelColors?.[name] ?? accentFor(name),
    });
    return id;
  };

  /* members --------------------------------------------------------------- */

  // The viewer has to exist regardless of who the export mentions — comments
  // and the "assign me" shortcut are written against `currentMemberId`.
  const currentMemberId = 'm_you';
  const members: BoardMember[] = [{ id: currentMemberId, name: 'You' }];
  const memberIds = new Map<string, string>([['you', currentMemberId]]);

  const memberId = (name: string): string => {
    const key = name.toLowerCase();
    const existing = memberIds.get(key);
    if (existing) return existing;
    const id = createId('m');
    memberIds.set(key, id);
    members.push({ id, name });
    return id;
  };

  /* lists ----------------------------------------------------------------- */

  const key = (name: string) => (name.trim() || 'Imported').toLowerCase();

  const seen = new Set<string>();
  const listNames: string[] = [];
  const pushList = (name: string) => {
    const clean = name.trim() || 'Imported';
    if (seen.has(key(clean))) return;
    seen.add(key(clean));
    listNames.push(clean);
  };

  /*
   * A declared column survives even when empty — a Trello board's empty
   * "Doing" is part of the arrangement the user built. What must not survive
   * is a column left hollow by this import: the source's archive list, or a
   * status like "Canceled" whose every card was just filtered out. Those would
   * otherwise arrive as unexplained empty columns.
   */
  const populated = new Set(tasks.map((task) => key(task.listName)));
  const emptied = new Set(
    excluded
      .map((task) => key(task.listName))
      .filter((name) => !populated.has(name)),
  );
  for (const name of normalized.archivedLists ?? []) {
    if (!options.includeArchived && !populated.has(key(name))) {
      emptied.add(key(name));
    }
  }

  for (const name of normalized.listOrder) {
    if (emptied.has(key(name))) continue;
    pushList(name);
  }
  for (const task of tasks) pushList(task.listName);
  if (listNames.length === 0) pushList('Imported');

  const lists: KanbanList[] = listNames.map((title) => ({
    id: createId('list'),
    title,
    cards: [],
  }));
  const listByName = new Map(
    lists.map((list) => [list.title.toLowerCase(), list]),
  );

  /* cards ----------------------------------------------------------------- */

  for (const task of tasks) {
    const target =
      listByName.get((task.listName.trim() || 'Imported').toLowerCase()) ??
      lists[0];

    const done = task.completed ?? isDoneList(target.title);

    const card: KanbanCard = {
      id: createId('c'),
      title: task.title.trim() || 'Untitled',
      description: task.description?.trim() ?? '',
      labelIds: (task.labels ?? []).map(labelId),
      memberIds: (task.assignees ?? []).map(memberId),
      creatorId: task.creator ? memberId(task.creator) : undefined,
      milestone: task.milestone,
      initiative: task.initiative,
      relations: task.relations?.length ? task.relations : undefined,
      dueDate: task.dueDate,
      // A card only reads as "due complete" when it actually has a due date;
      // otherwise the badge has nothing to strike through.
      dueComplete: Boolean(task.dueDate) && done,
      priority: task.priority ?? 'MEDIUM',
      checklist: (task.checklist ?? []).map((item) => ({
        id: createId('ci'),
        text: item.text,
        done: item.done,
      })),
      comments: (task.comments ?? []).map((comment) => ({
        id: createId('cm'),
        authorId: comment.author ? memberId(comment.author) : currentMemberId,
        body: comment.body,
        createdAt: toISOTimestamp(comment.createdAt),
      })),
      createdAt: toISOTimestamp(task.createdAt),
    };

    if (task.checklist?.length) {
      card.issuesCount = task.checklist.length;
    }

    target.cards.push(card);
  }

  const board: BoardState = {
    title: (options.title ?? normalized.title).trim() || 'Imported board',
    lists,
    labels,
    members,
    currentMemberId,
  };

  return { board, warnings };
}

/* ---------------------------------------------------------------- merge --- */

/**
 * Folds `incoming` into `target`, matching lists, labels, and members by name
 * so a second import of the same project tops up the existing columns instead
 * of duplicating them. Ids from `incoming` are remapped, never reused.
 */
export function mergeBoards(
  target: BoardState,
  incoming: BoardState,
): BoardState {
  const labels = [...target.labels];
  const labelMap = new Map<string, string>();
  for (const label of incoming.labels) {
    const match = labels.find(
      (entry) => entry.name.toLowerCase() === label.name.toLowerCase(),
    );
    if (match) {
      labelMap.set(label.id, match.id);
    } else {
      const id = createId('l');
      labels.push({ ...label, id });
      labelMap.set(label.id, id);
    }
  }

  const members = [...target.members];
  const memberMap = new Map<string, string>();
  for (const member of incoming.members) {
    const match = members.find(
      (entry) => entry.name.toLowerCase() === member.name.toLowerCase(),
    );
    if (match) {
      memberMap.set(member.id, match.id);
    } else {
      const id = createId('m');
      members.push({ ...member, id });
      memberMap.set(member.id, id);
    }
  }

  const remap = (card: KanbanCard): KanbanCard => ({
    ...card,
    id: createId('c'),
    labelIds: card.labelIds.map((id) => labelMap.get(id) ?? id),
    memberIds: card.memberIds.map((id) => memberMap.get(id) ?? id),
    creatorId: card.creatorId ? memberMap.get(card.creatorId) : undefined,
    checklist: card.checklist.map((item) => ({ ...item, id: createId('ci') })),
    comments: card.comments.map((comment) => ({
      ...comment,
      id: createId('cm'),
      authorId: memberMap.get(comment.authorId) ?? target.currentMemberId,
    })),
  });

  const lists = target.lists.map((list) => ({ ...list, cards: [...list.cards] }));

  for (const list of incoming.lists) {
    const match = lists.find(
      (entry) => entry.title.toLowerCase() === list.title.toLowerCase(),
    );
    if (match) {
      match.cards.push(...list.cards.map(remap));
    } else {
      lists.push({
        id: createId('list'),
        title: list.title,
        cards: list.cards.map(remap),
      });
    }
  }

  return { ...target, lists, labels, members };
}

/* --------------------------------------------------------------- export --- */

export const ONETAB_EXPORT_KIND = 'onetab.kanban.board';

/** Serialises a board so it can be re-imported by the `onetab` adapter. */
export function exportBoard(board: BoardState): string {
  return JSON.stringify(
    { kind: ONETAB_EXPORT_KIND, version: 1, exportedAt: new Date().toISOString(), board },
    null,
    2,
  );
}

/** A colour name from the source palette, normalised to a design-system accent. */
export function toAccent(value: string | undefined, fallbackSeed: string): Accent {
  if (!value) return accentFor(fallbackSeed);
  const key = value.toLowerCase().replace(/_(dark|light)$/, '').trim();
  const mapped: Record<string, Accent> = {
    green: 'green',
    lime: 'green',
    yellow: 'amber',
    amber: 'amber',
    orange: 'orange',
    red: 'rose',
    rose: 'rose',
    purple: 'violet',
    violet: 'violet',
    blue: 'blue',
    navy: 'indigo',
    sky: 'cyan',
    cyan: 'cyan',
    pink: 'pink',
    magenta: 'pink',
    teal: 'teal',
    indigo: 'indigo',
    black: 'indigo',
    grey: 'indigo',
    gray: 'indigo',
  };
  return mapped[key] ?? accentFor(fallbackSeed);
}

export { titleCase };
