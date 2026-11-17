/*
 * Natural-language → board filter.
 *
 * The board's smart filter sends a sentence ("urgent bugs assigned to me due
 * this week") with the project's own statuses, members and milestones. The
 * answer is the same structured facets the Filter menu sets, so a smart
 * filter and a hand-picked one are the same thing to the board.
 *
 * Everything returned is checked against the ids the caller sent: a model
 * that invents a status or member id has that value dropped, never applied.
 */

export const TASK_FILTER_PRIORITIES = [
  'URGENT',
  'HIGH',
  'MEDIUM',
  'LOW',
] as const;
export type TaskFilterPriority = (typeof TASK_FILTER_PRIORITIES)[number];

export const TASK_FILTER_DUE = [
  'any',
  'overdue',
  'today',
  'week',
  'none',
] as const;
export type TaskFilterDue = (typeof TASK_FILTER_DUE)[number];

export interface TaskFilterContext {
  prompt: string;
  statuses: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  milestones: string[];
  /** The caller, for "me" / "my". */
  currentUserId?: string;
}

export interface TaskFilterResult {
  status: string[];
  priorities: TaskFilterPriority[];
  memberIds: string[];
  due: TaskFilterDue;
  milestones: string[];
  /** Words to match in title/description that no facet covered. */
  keywords: string[];
  /** Short human summary of what was applied. */
  summary: string;
  /** `ai` when a model parsed it, `rules` for the built-in parser. */
  source: 'ai' | 'rules';
}

const STOP_WORDS = new Set([
  'a', 'all', 'an', 'and', 'any', 'are', 'assigned', 'by', 'due', 'for',
  'from', 'give', 'has', 'have', 'in', 'is', 'issues', 'issue', 'items',
  'item', 'list', 'me', 'my', 'of', 'on', 'only', 'or', 'owned', 'please',
  'priority', 'show', 'status', 'task', 'tasks', 'that', 'the', 'this',
  'to', 'which', 'with', 'what', 'week', 'today', 'overdue', 'late',
  'tickets', 'ticket', 'cards', 'card', 'find', 'filter', 'get', 'mine',
  'milestone', 'milestones', 'no', 'date', 'dates', 'without', 'unassigned',
]);

const PRIORITY_WORDS: Record<string, TaskFilterPriority> = {
  urgent: 'URGENT',
  critical: 'URGENT',
  blocker: 'URGENT',
  asap: 'URGENT',
  high: 'HIGH',
  important: 'HIGH',
  medium: 'MEDIUM',
  normal: 'MEDIUM',
  low: 'LOW',
  minor: 'LOW',
};

const norm = (value: string) => value.trim().toLowerCase();

function containsPhrase(text: string, phrase: string): boolean {
  const p = norm(phrase);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

function summarize(
  result: Omit<TaskFilterResult, 'summary' | 'source'>,
  ctx: TaskFilterContext,
): string {
  const parts: string[] = [];
  if (result.status.length) {
    parts.push(
      result.status
        .map((id) => ctx.statuses.find((s) => s.id === id)?.name ?? id)
        .join(' or '),
    );
  }
  if (result.priorities.length) {
    parts.push(
      `${result.priorities.map((p) => p.toLowerCase()).join(' or ')} priority`,
    );
  }
  if (result.memberIds.length) {
    const names = result.memberIds.map((id) =>
      id === ctx.currentUserId
        ? 'you'
        : (ctx.members.find((m) => m.id === id)?.name ?? 'someone'),
    );
    parts.push(`assigned to ${names.join(' or ')}`);
  }
  const dueText: Record<TaskFilterDue, string> = {
    any: '',
    overdue: 'overdue',
    today: 'due today',
    week: 'due this week',
    none: 'without a due date',
  };
  if (result.due !== 'any') parts.push(dueText[result.due]);
  if (result.milestones.length) {
    parts.push(`in ${result.milestones.join(' or ')}`);
  }
  if (result.keywords.length) {
    parts.push(`matching “${result.keywords.join(' ')}”`);
  }
  return parts.length ? parts.join(', ') : 'No filters recognised';
}

/** The built-in parser: no model, instant, works offline. */
export function parseTaskFilterRules(ctx: TaskFilterContext): TaskFilterResult {
  const text = norm(ctx.prompt);
  const consumed = new Set<string>();
  const eat = (phrase: string) =>
    norm(phrase)
      .split(/\s+/)
      .forEach((w) => consumed.add(w));

  // Longest names first so "In Review" wins over "Review".
  const status = [...ctx.statuses]
    .sort((a, b) => b.name.length - a.name.length)
    .filter((s) => {
      if (!containsPhrase(text, s.name)) return false;
      eat(s.name);
      return true;
    })
    .map((s) => s.id);
  if (!status.length) {
    const aliases: Array<[RegExp, string[]]> = [
      [/\b(done|finished|closed|complete)\b/, ['completed', 'done']],
      [/\b(open|todo|to do|not started)\b/, ['backlog', 'planned', 'todo']],
      [/\b(wip|ongoing|in progress|started)\b/, ['in progress']],
    ];
    for (const [re, names] of aliases) {
      const m = text.match(re);
      if (!m) continue;
      const hits = ctx.statuses.filter((s) => names.includes(norm(s.name)));
      if (hits.length) {
        hits.forEach((s) => status.push(s.id));
        eat(m[0]);
      }
    }
  }

  const priorities: TaskFilterPriority[] = [];
  for (const [word, p] of Object.entries(PRIORITY_WORDS)) {
    if (containsPhrase(text, word) && !priorities.includes(p)) {
      priorities.push(p);
      eat(word);
    }
  }

  const memberIds: string[] = [];
  if (
    ctx.currentUserId &&
    /\b(me|my|mine|myself|i own)\b/.test(text) &&
    ctx.members.some((m) => m.id === ctx.currentUserId)
  ) {
    memberIds.push(ctx.currentUserId);
  }
  for (const m of ctx.members) {
    const full = norm(m.name);
    const first = full.split(/\s+/)[0];
    const hit = containsPhrase(text, full)
      ? full
      : first.length > 2 && containsPhrase(text, first)
        ? first
        : null;
    if (hit && !memberIds.includes(m.id)) {
      memberIds.push(m.id);
      eat(hit);
    }
  }

  let due: TaskFilterDue = 'any';
  if (/\b(overdue|late|past due|missed)\b/.test(text)) due = 'overdue';
  else if (/\b(due )?today\b/.test(text)) due = 'today';
  else if (/\b(this week|next 7 days|due soon|week)\b/.test(text)) due = 'week';
  else if (/\b(no due( date)?|without (a )?due( date)?|undated)\b/.test(text))
    due = 'none';
  ['late', 'past', 'missed', 'soon', 'undated', 'next', '7', 'days'].forEach(
    (w) => due !== 'any' && consumed.add(w),
  );

  const milestones = ctx.milestones.filter((title) => {
    if (!containsPhrase(text, title)) return false;
    eat(title);
    return true;
  });

  const keywords = text
    .replace(/["“”']/g, ' ')
    .split(/[^a-z0-9#-]+/)
    .filter(
      (w) =>
        w.length > 1 &&
        !STOP_WORDS.has(w) &&
        !consumed.has(w) &&
        !(w in PRIORITY_WORDS),
    );

  const base = { status, priorities, memberIds, due, milestones, keywords };
  return { ...base, summary: summarize(base, ctx), source: 'rules' };
}

/** JSON schema the model is asked to fill. */
export function taskFilterJsonSchema(ctx: TaskFilterContext) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'priorities', 'memberIds', 'due', 'milestones', 'keywords'],
    properties: {
      status: { type: 'array', items: { type: 'string', enum: ctx.statuses.map((s) => s.id) } },
      priorities: { type: 'array', items: { type: 'string', enum: [...TASK_FILTER_PRIORITIES] } },
      memberIds: { type: 'array', items: { type: 'string', enum: ctx.members.map((m) => m.id) } },
      due: { type: 'string', enum: [...TASK_FILTER_DUE] },
      milestones: { type: 'array', items: { type: 'string', enum: ctx.milestones } },
      keywords: { type: 'array', items: { type: 'string' } },
    },
  };
}

export function taskFilterSystemPrompt(ctx: TaskFilterContext): string {
  return [
    'You turn a request about which tasks to show on a project board into a JSON filter.',
    'Reply with ONLY a JSON object with keys: status, priorities, memberIds, due, milestones, keywords.',
    'Use only the ids and values listed below. Leave a facet empty ([] or "any") unless the request asks for it.',
    'keywords: at most 4 content words to match in task titles/descriptions that no other facet covers; never include filler like "show", "tasks", "me".',
    `statuses (id: name): ${JSON.stringify(ctx.statuses.map((s) => `${s.id}: ${s.name}`))}`,
    `priorities: ${JSON.stringify(TASK_FILTER_PRIORITIES)}`,
    `members (id: name): ${JSON.stringify(ctx.members.map((m) => `${m.id}: ${m.name}`))}`,
    ctx.currentUserId
      ? `The person asking ("me", "my") has member id ${ctx.currentUserId}.`
      : '',
    `due: one of ${JSON.stringify(TASK_FILTER_DUE)} ("week" = due within 7 days).`,
    `milestones: ${JSON.stringify(ctx.milestones)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Pull the first JSON object out of a model reply. */
function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : reply;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Validate a model reply against the caller's own ids. Returns null when the
 * reply is not usable, so the caller can fall back to the rule parser.
 */
export function sanitizeTaskFilterReply(
  reply: string,
  ctx: TaskFilterContext,
): TaskFilterResult | null {
  const raw = extractJson(reply);
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const statusIds = new Set(ctx.statuses.map((s) => s.id));
  const memberIds = new Set(ctx.members.map((m) => m.id));
  const milestoneSet = new Set(ctx.milestones);

  const due = TASK_FILTER_DUE.includes(obj['due'] as TaskFilterDue)
    ? (obj['due'] as TaskFilterDue)
    : 'any';
  const base = {
    status: [...new Set(strings(obj['status']).filter((id) => statusIds.has(id)))],
    priorities: [
      ...new Set(
        strings(obj['priorities'])
          .map((p) => p.toUpperCase())
          .filter((p): p is TaskFilterPriority =>
            (TASK_FILTER_PRIORITIES as readonly string[]).includes(p),
          ),
      ),
    ],
    memberIds: [...new Set(strings(obj['memberIds']).filter((id) => memberIds.has(id)))],
    due,
    milestones: [...new Set(strings(obj['milestones']).filter((t) => milestoneSet.has(t)))],
    keywords: strings(obj['keywords'])
      .map((k) => norm(k))
      .filter((k) => k.length > 1 && !STOP_WORDS.has(k))
      .slice(0, 4),
  };
  return { ...base, summary: summarize(base, ctx), source: 'ai' };
}
