import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { buildBoardState, mergeBoards, exportBoard } from './normalize.js';
import { detectSource, parseImport, parseImportAuto } from './sources.js';

const build = (text: string, source: Parameters<typeof parseImport>[1], options = {}) =>
  buildBoardState(parseImport(text, source, options).board, { includeArchived: false });

/* ------------------------------------------------------------------ csv --- */

describe('parseCsv', () => {
  it('keeps quoted commas and embedded newlines in one field', () => {
    const table = parseCsv('Title,Description\n"A, B","line one\nline two"\n');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][0]).toBe('A, B');
    expect(table.rows[0][1]).toBe('line one\nline two');
  });

  it('unescapes doubled quotes', () => {
    const table = parseCsv('Title\n"He said ""hi"""\n');
    expect(table.rows[0][0]).toBe('He said "hi"');
  });

  it('handles CRLF and a BOM', () => {
    const table = parseCsv('﻿Title,Status\r\nOne,Done\r\n');
    expect(table.headers).toEqual(['Title', 'Status']);
    expect(table.rows).toEqual([['One', 'Done']]);
  });

  it('sniffs a semicolon delimiter', () => {
    const table = parseCsv('Title;Status\nOne;Done\n');
    expect(table.delimiter).toBe(';');
    expect(table.rows[0]).toEqual(['One', 'Done']);
  });

  it('collects repeated headers under one key', () => {
    const table = parseCsv('Summary,Labels,Labels\nOne,bug,ui\n');
    expect(table.index.get('labels')).toEqual([1, 2]);
  });

  it('preserves trailing empty fields', () => {
    const table = parseCsv('a,b,c\n1,2,\n');
    expect(table.rows[0]).toEqual(['1', '2', '']);
  });
});

/* --------------------------------------------------------------- trello --- */

const TRELLO = JSON.stringify({
  name: 'Roadmap',
  lists: [
    { id: 'l2', name: 'Doing', pos: 2 },
    { id: 'l1', name: 'To Do', pos: 1 },
    { id: 'l3', name: 'Archive', pos: 3, closed: true },
  ],
  labels: [
    { id: 'lab1', name: 'Bug', color: 'red' },
    { id: 'lab2', name: '', color: 'purple' },
    { id: 'lab3', name: 'High', color: 'orange' },
  ],
  members: [{ id: 'm1', fullName: 'Ada Lovelace', username: 'ada' }],
  cards: [
    {
      id: 'c2',
      name: 'Second',
      desc: 'has, a comma',
      idList: 'l1',
      pos: 2,
      idLabels: ['lab1', 'lab3'],
      idMembers: ['m1'],
      due: '2026-09-01T00:30:00.000Z',
      dueComplete: false,
    },
    { id: 'c1', name: 'First', idList: 'l1', pos: 1, idLabels: ['lab2'] },
    { id: 'c3', name: 'Old', idList: 'l3', pos: 1 },
    { id: 'c4', name: 'Dropped', idList: 'l1', pos: 4, closed: true },
  ],
  checklists: [
    {
      id: 'ck1',
      idCard: 'c1',
      checkItems: [
        { id: 'i2', name: 'Second step', state: 'incomplete', pos: 2 },
        { id: 'i1', name: 'First step', state: 'complete', pos: 1 },
      ],
    },
  ],
  actions: [
    {
      type: 'commentCard',
      date: '2026-01-02T00:00:00Z',
      data: { text: 'Looks good', card: { id: 'c1' } },
      memberCreator: { fullName: 'Ada Lovelace' },
    },
    { type: 'updateCard', data: { card: { id: 'c1' } } },
  ],
});

describe('trello', () => {
  it('is detected from lists + cards', () => {
    expect(detectSource(TRELLO, 'trello.json')).toBe('trello');
  });

  it('keeps Trello list and card order from pos', () => {
    const { board } = build(TRELLO, 'trello');
    expect(board.lists.map((l) => l.title)).toEqual(['To Do', 'Doing']);
    expect(board.lists[0].cards.map((c) => c.title)).toEqual(['First', 'Second']);
  });

  it('excludes archived cards and cards in archived lists', () => {
    const { board, warnings } = build(TRELLO, 'trello');
    const titles = board.lists.flatMap((l) => l.cards.map((c) => c.title));
    expect(titles).not.toContain('Old');
    expect(titles).not.toContain('Dropped');
    expect(warnings.join(' ')).toContain('2 archived');
  });

  it('includes archived items when asked', () => {
    const parsed = parseImport(TRELLO, 'trello');
    const { board } = buildBoardState(parsed.board, { includeArchived: true });
    const titles = board.lists.flatMap((l) => l.cards.map((c) => c.title));
    expect(titles).toContain('Old');
  });

  it('reads a UTC due date as the day the source meant', () => {
    const { board } = build(TRELLO, 'trello');
    const second = board.lists[0].cards.find((c) => c.title === 'Second');
    expect(second?.dueDate).toBe('2026-09-01');
  });

  it('derives priority from a priority-named label', () => {
    const { board } = build(TRELLO, 'trello');
    const second = board.lists[0].cards.find((c) => c.title === 'Second');
    expect(second?.priority).toBe('HIGH');
  });

  it('names colour-only labels after their colour', () => {
    const { board } = build(TRELLO, 'trello');
    expect(board.labels.map((l) => l.name)).toContain('Purple');
  });

  it('carries checklists in order and comments', () => {
    const { board } = build(TRELLO, 'trello');
    const first = board.lists[0].cards.find((c) => c.title === 'First');
    expect(first?.checklist.map((i) => i.text)).toEqual(['First step', 'Second step']);
    expect(first?.checklist[0].done).toBe(true);
    expect(first?.comments).toHaveLength(1);
    expect(first?.comments[0].body).toBe('Looks good');
  });

  it('maps members onto cards', () => {
    const { board } = build(TRELLO, 'trello');
    const second = board.lists[0].cards.find((c) => c.title === 'Second');
    const ada = board.members.find((m) => m.name === 'Ada Lovelace');
    expect(second?.memberIds).toEqual([ada?.id]);
  });
});

/* --------------------------------------------------------------- linear --- */

const LINEAR = [
  'ID,Team,Title,Description,Status,Estimate,Priority,Project,Creator,Assignee,Labels,Cycle Number,Created,Completed,Canceled,Due Date,Project Milestone',
  'ENG-2,Core,"Fix, the parser","Multi\nline",Done,3,Urgent,Atlas,Ada,Grace,"bug,parser",4,2026-01-01T10:00:00Z,2026-02-01T10:00:00Z,,2026-02-05,M1',
  'ENG-1,Core,Add search,,In Progress,2,High,Atlas,Ada,Ada,search,4,2026-01-02T10:00:00Z,,,,',
  'ENG-3,Core,Drop this,,Canceled,,Low,Atlas,Ada,,,4,2026-01-03T10:00:00Z,,2026-02-02T10:00:00Z,,',
  'ENG-4,Core,Triage me,,Backlog,,No priority,Atlas,Ada,,,,2026-01-04T10:00:00Z,,,,',
].join('\n');

describe('linear', () => {
  it('is detected from Team + Status + Estimate', () => {
    expect(detectSource(LINEAR, 'export.csv')).toBe('linear');
  });

  it('orders status columns as a workflow, not as encountered', () => {
    const { board } = build(LINEAR, 'linear');
    expect(board.lists.map((l) => l.title)).toEqual([
      'Backlog',
      'In Progress',
      'Done',
    ]);
  });

  it('takes the board name from a single-project export', () => {
    const { board } = build(LINEAR, 'linear');
    expect(board.title).toBe('Atlas');
  });

  it('drops cancelled issues', () => {
    const { board } = build(LINEAR, 'linear');
    const titles = board.lists.flatMap((l) => l.cards.map((c) => c.title));
    expect(titles).not.toContain('Drop this');
  });

  it('maps priority names, splits labels, and keeps quoted fields', () => {
    const { board } = build(LINEAR, 'linear');
    const done = board.lists.find((l) => l.title === 'Done');
    const card = done?.cards[0];
    expect(card?.title).toBe('Fix, the parser');
    expect(card?.description).toBe('Multi\nline');
    expect(card?.priority).toBe('URGENT');
    expect(card?.dueDate).toBe('2026-02-05');
    expect(card?.dueComplete).toBe(true);
    expect(card?.milestone).toBe('M1');
    const names = card?.labelIds.map(
      (id) => board.labels.find((l) => l.id === id)?.name,
    );
    expect(names).toEqual(['bug', 'parser']);
  });

  it('falls back to MEDIUM for "No priority"', () => {
    const { board } = build(LINEAR, 'linear');
    const backlog = board.lists.find((l) => l.title === 'Backlog');
    expect(backlog?.cards[0].priority).toBe('MEDIUM');
  });

  it('regroups by any column on request', () => {
    const { board } = build(LINEAR, 'linear', { groupBy: 'Assignee' });
    expect(board.lists.map((l) => l.title)).toContain('Grace');
  });
});

/* ---------------------------------------------------------------- asana --- */

const ASANA = [
  'Task ID,Created At,Completed At,Name,Section/Column,Assignee,Assignee Email,Due Date,Tags,Notes,Projects,Parent task,Priority',
  '1,2026-01-01,,Launch plan,Planning,Ada,ada@x.com,2026-03-01,"launch,q1",Kick off,Website,,High',
  '2,2026-01-01,2026-01-05,Book venue,,Ada,ada@x.com,,,,Website,Launch plan,',
  '3,2026-01-01,,Send invites,,Ada,ada@x.com,,,,Website,Launch plan,',
  '4,2026-01-02,2026-02-01,Publish site,Shipping,Grace,g@x.com,2026-02-01,,,Website,,Low',
].join('\n');

describe('asana', () => {
  it('is detected from Task ID / Section', () => {
    expect(detectSource(ASANA, 'asana.csv')).toBe('asana');
  });

  it('folds subtasks into the parent checklist instead of loose cards', () => {
    const { board } = build(ASANA, 'asana');
    const titles = board.lists.flatMap((l) => l.cards.map((c) => c.title));
    expect(titles).toEqual(['Launch plan', 'Publish site']);

    const parent = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Launch plan');
    expect(parent?.checklist.map((i) => i.text)).toEqual([
      'Book venue',
      'Send invites',
    ]);
    expect(parent?.checklist[0].done).toBe(true);
    expect(parent?.checklist[1].done).toBe(false);
  });

  it('uses the project name and section columns', () => {
    const { board } = build(ASANA, 'asana');
    expect(board.title).toBe('Website');
    expect(board.lists.map((l) => l.title)).toEqual(['Planning', 'Shipping']);
  });

  it('marks a task with a completion timestamp as done', () => {
    const { board } = build(ASANA, 'asana');
    const shipped = board.lists.find((l) => l.title === 'Shipping');
    expect(shipped?.cards[0].dueComplete).toBe(true);
    expect(shipped?.cards[0].priority).toBe('LOW');
  });
});

/* ----------------------------------------------------------------- jira --- */

const JIRA = [
  'Summary,Issue key,Issue Type,Status,Priority,Assignee,Reporter,Created,Due Date,Description,Resolution,Labels,Labels,Sprint',
  'Login fails,WEB-1,Bug,In Progress,Highest,Ada,Grace,01/15/2026 09:00,02/01/2026,"Steps: 1, 2",Unresolved,auth,regression,Sprint 4',
  'Old thing,WEB-2,Task,Done,Low,Ada,Grace,01/10/2026 09:00,,,"Won\'t Fix",,,Sprint 4',
  'Ship it,WEB-3,Story,Done,Medium,Grace,Ada,01/11/2026 09:00,,,Fixed,,,Sprint 4',
].join('\n');

describe('jira', () => {
  it('is detected from Issue key', () => {
    expect(detectSource(JIRA, 'jira.csv')).toBe('jira');
  });

  it('collects the repeated Labels columns', () => {
    const { board } = build(JIRA, 'jira');
    const card = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Login fails');
    const names = card?.labelIds.map(
      (id) => board.labels.find((l) => l.id === id)?.name,
    );
    expect(names).toEqual(['auth', 'regression']);
  });

  it('maps Highest to URGENT and parses m/d/yyyy dates', () => {
    const { board } = build(JIRA, 'jira');
    const card = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Login fails');
    expect(card?.priority).toBe('URGENT');
    expect(card?.dueDate).toBe('2026-02-01');
    expect(card?.milestone).toBe('Sprint 4');
  });

  it("drops Won't Fix but keeps Fixed", () => {
    const { board } = build(JIRA, 'jira');
    const titles = board.lists.flatMap((l) => l.cards.map((c) => c.title));
    expect(titles).not.toContain('Old thing');
    expect(titles).toContain('Ship it');
  });

  it('treats Unresolved as not complete', () => {
    const { board } = build(JIRA, 'jira');
    const card = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Login fails');
    expect(card?.dueComplete).toBe(false);
  });
});

/* --------------------------------------------------------------- github --- */

const GITHUB = JSON.stringify([
  {
    number: 7,
    title: 'Crash on save',
    body: 'stack trace',
    state: 'OPEN',
    labels: [{ name: 'bug' }, { name: 'high' }],
    assignees: [{ login: 'ada' }],
    milestone: { title: 'v1.2' },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    number: 8,
    title: 'Docs typo',
    state: 'CLOSED',
    labels: ['docs'],
    assignees: [],
    milestone: null,
    createdAt: '2026-01-02T00:00:00Z',
  },
  { number: 9, title: 'A PR', state: 'OPEN', pull_request: {}, labels: [] },
]);

describe('github', () => {
  it('is detected from an array of issue objects', () => {
    expect(detectSource(GITHUB, 'issues.json')).toBe('github');
  });

  it('skips pull requests and groups by milestone then state', () => {
    const { board } = build(GITHUB, 'github');
    const titles = board.lists.flatMap((l) => l.cards.map((c) => c.title));
    expect(titles).not.toContain('A PR');
    expect(board.lists.map((l) => l.title).sort()).toEqual(['Done', 'v1.2']);
  });

  it('reads labels in both string and object form, and infers priority', () => {
    const { board } = build(GITHUB, 'github');
    const crash = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Crash on save');
    expect(crash?.priority).toBe('HIGH');
    expect(crash?.labelIds).toHaveLength(2);

    const typo = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Docs typo');
    expect(typo?.labelIds).toHaveLength(1);
  });
});

/* ------------------------------------------------------------ generic csv --- */

const NOTION = [
  'Name,Status,Assign,Due,Tags,Notes',
  'Write brief,In progress,Ada,2026-04-01,"writing, q2",First draft',
  'Review brief,Not started,Grace,,review,',
].join('\n');

describe('generic csv', () => {
  it('falls back to generic CSV when nothing else matches', () => {
    expect(detectSource(NOTION, 'notion.csv')).toBe('csv');
  });

  it('guesses the mapping from common header aliases', () => {
    const { board } = build(NOTION, 'csv');
    expect(board.lists.map((l) => l.title)).toEqual(['Not started', 'In progress']);
    const card = board.lists
      .flatMap((l) => l.cards)
      .find((c) => c.title === 'Write brief');
    expect(card?.description).toBe('First draft');
    expect(card?.dueDate).toBe('2026-04-01');
    expect(card?.labelIds).toHaveLength(2);
    expect(board.members.map((m) => m.name)).toContain('Ada');
  });

  it('honours an explicit mapping override', () => {
    const parsed = parseImport(NOTION, 'csv', {
      mapping: { title: 'Notes', list: 'Assign' },
    });
    const { board } = buildBoardState(parsed.board, {});
    expect(board.lists.map((l) => l.title)).toEqual(['Ada', 'Grace']);
    expect(board.lists[0].cards[0].title).toBe('First draft');
  });
});

/* ------------------------------------------------------- round trip + merge --- */

describe('round trip', () => {
  it('re-imports a board this app exported', () => {
    const { board } = build(TRELLO, 'trello');
    const json = exportBoard(board);

    expect(detectSource(json, 'backup.json')).toBe('onetab');

    const again = buildBoardState(parseImportAuto(json, 'backup.json').board, {}).board;
    expect(again.lists.map((l) => l.title)).toEqual(board.lists.map((l) => l.title));
    expect(again.lists[0].cards.map((c) => c.title)).toEqual(
      board.lists[0].cards.map((c) => c.title),
    );
    const first = again.lists[0].cards.find((c) => c.title === 'First');
    expect(first?.checklist.map((i) => i.text)).toEqual([
      'First step',
      'Second step',
    ]);
    expect(first?.comments[0].body).toBe('Looks good');
  });
});

describe('mergeBoards', () => {
  it('tops up matching lists and adds new ones, without reusing ids', () => {
    const target = build(TRELLO, 'trello').board;
    const incoming = build(LINEAR, 'linear').board;
    const merged = mergeBoards(target, incoming);

    const titles = merged.lists.map((l) => l.title);
    expect(titles.slice(0, 2)).toEqual(['To Do', 'Doing']);
    expect(titles).toContain('Backlog');

    const ids = merged.lists.flatMap((l) => l.cards.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reuses a label of the same name instead of duplicating it', () => {
    const target = build(TRELLO, 'trello').board;
    const incoming = build(TRELLO, 'trello').board;
    const merged = mergeBoards(target, incoming);
    expect(merged.labels.map((l) => l.name).sort()).toEqual(
      target.labels.map((l) => l.name).sort(),
    );
  });
});

/* --------------------------------------------------------------- errors --- */

describe('failure modes', () => {
  it('rejects an empty file', () => {
    expect(() => parseImport('   ', 'csv')).toThrow(/empty/i);
  });

  it('rejects JSON that is not a Trello board', () => {
    expect(() => parseImport('{"foo":1}', 'trello')).toThrow(/Trello/);
  });

  it('rejects a CSV with headers but no rows', () => {
    expect(() => parseImport('Title,Status\n', 'csv')).toThrow(/no rows/i);
  });

  it('rejects malformed JSON with a readable message', () => {
    expect(() => parseImport('{not json', 'trello')).toThrow(/valid JSON/);
  });
});
