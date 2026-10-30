import { describe, expect, it } from 'vitest';
import {
  POLL_END_TYPE,
  POLL_KEY,
  POLL_RESPONSE_TYPE,
  buildPollContent,
  readPollContent,
  toPoll,
} from './polls.js';

interface FakeEvent {
  sender: string;
  ts: number;
  content: Record<string, unknown>;
}

const fake = ({ sender, ts, content }: FakeEvent) => ({
  getId: () => `$${sender}-${ts}`,
  getSender: () => sender,
  getTs: () => ts,
  getContent: () => content,
  isRedacted: () => false,
});

const vote = (sender: string, ts: number, answers: unknown[]) =>
  fake({ sender, ts, content: { [POLL_RESPONSE_TYPE]: { answers } } });

function setup(
  related: {
    votes?: ReturnType<typeof fake>[];
    ends?: ReturnType<typeof fake>[];
  },
  draft = { maxSelections: 1, durationMs: 3_600_000 },
) {
  const content = {
    [POLL_KEY]: buildPollContent(
      {
        question: 'Lunch?',
        answers: [{ text: 'Pizza' }, { text: 'Sushi' }, { text: '  ' }],
        ...draft,
      },
      1_000,
    ),
  };
  const event = fake({ sender: '@ana:x', ts: 1_000, content });
  const room = {
    getUnfilteredTimelineSet: () => ({
      relations: {
        getChildEventsForEvent: (_id: string, _rel: string, type: string) => ({
          getRelations: () =>
            type === POLL_RESPONSE_TYPE
              ? (related.votes ?? [])
              : (related.ends ?? []),
        }),
      },
    }),
  };
  const client = { getUserId: () => '@me:x' };
  return (now = 2_000) =>
    toPoll(client as never, room as never, event as never, content, now);
}

describe('polls', () => {
  it('drops blank answers and clamps max selections', () => {
    const content = buildPollContent(
      {
        question: ' Q ',
        answers: [{ text: 'A' }, { text: '' }, { text: 'B' }],
        maxSelections: 9,
        durationMs: 1,
      },
      0,
    );
    expect(content.answers.map((a) => a.text)).toEqual(['A', 'B']);
    expect(content.max_selections).toBe(2);
    expect(readPollContent({ [POLL_KEY]: content })?.question).toBe('Q');
  });

  it("counts each voter's latest valid vote", () => {
    const tally = setup({
      votes: [
        vote('@me:x', 1_100, ['a1']),
        vote('@me:x', 1_200, ['a2']),
        vote('@bo:x', 1_150, ['a1']),
        vote('@cy:x', 1_160, ['a1', 'a2']), // too many for a single-choice poll
        vote('@di:x', 1_170, ['nope']),
      ],
    })();
    expect(tally?.answers.map((a) => a.votes)).toEqual([1, 1]);
    expect(tally?.totalVoters).toBe(2);
    expect(tally?.myAnswerIds).toEqual(['a2']);
  });

  it('an empty vote withdraws an earlier one', () => {
    const tally = setup({
      votes: [vote('@me:x', 1_100, ['a1']), vote('@me:x', 1_200, [])],
    })();
    expect(tally?.totalVoters).toBe(0);
    expect(tally?.myAnswerIds).toEqual([]);
  });

  it("ignores votes after the author's end, and anyone else's end", () => {
    const tally = setup({
      votes: [vote('@bo:x', 1_100, ['a1']), vote('@cy:x', 1_300, ['a2'])],
      ends: [
        fake({ sender: '@bo:x', ts: 1_050, content: {} }),
        fake({ sender: '@ana:x', ts: 1_200, content: {} }),
      ],
    })();
    expect(tally?.closedAt).toBe(1_200);
    expect(tally?.answers.map((a) => a.votes)).toEqual([1, 0]);
  });

  it('closes on its own once the duration passes', () => {
    const tally = setup({ votes: [] });
    expect(tally(2_000)?.closedAt).toBeUndefined();
    expect(tally(1_000 + 3_600_000)?.closedAt).toBe(1_000 + 3_600_000);
  });

  it('is not a poll without at least two answers', () => {
    expect(
      readPollContent({
        [POLL_KEY]: { question: 'Q', answers: [{ id: 'a1', text: 'A' }] },
      }),
    ).toBeNull();
    expect(POLL_END_TYPE).toContain('poll.end');
  });
});
