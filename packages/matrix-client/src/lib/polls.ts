import {
  POLL_LIMITS,
  type MessagePoll,
  type PollAnswer,
  type PollDraft,
} from './types.js';

/**
 * Polls on the wire.
 *
 * A poll is an ordinary `m.room.message` whose body is a readable fallback and
 * whose content carries the poll under `POLL_KEY` — so notifications, sidebar
 * previews, search and unread counts treat it like any other message. Votes
 * and the author's "end poll" follow MSC3381: `m.reference` events pointing at
 * the poll, which the timeline never renders on their own. A person's latest
 * vote is the one that counts; an empty answer list withdraws it.
 */

export const POLL_KEY = 'org.onetab.poll';
export const POLL_RESPONSE_TYPE = 'org.matrix.msc3381.poll.response';
export const POLL_END_TYPE = 'org.matrix.msc3381.poll.end';

/*
 * The slices of SDK objects the tally reads. Structural, so this module stays
 * free of `matrix-js-sdk` imports (see isolation.spec) and is easy to fake.
 */
interface PollEvent {
  getId(): string | undefined;
  getSender(): string | undefined | null;
  getTs(): number;
  getContent(): Record<string, unknown>;
  isRedacted(): boolean;
}

interface PollRoom {
  getUnfilteredTimelineSet(): {
    relations?: {
      getChildEventsForEvent(
        eventId: string,
        relationType: string,
        eventType: string,
      ): { getRelations(): PollEvent[] } | undefined;
    };
  };
}

interface PollClient {
  getUserId(): string | null;
}

interface PollContent {
  question: string;
  answers: { id: string; text: string; emoji?: string }[];
  max_selections: number;
  ends_at: number;
}

/**
 * The user push rule that keeps votes and "end poll" events silent: they are
 * activity on a message, not messages. No default rule notifies for them
 * today, but a homeserver's own rules or a future "all activity" level could;
 * an override rule with no actions outranks those. In encrypted rooms the
 * client re-evaluates push rules after decryption, so it applies there too.
 */
export const POLL_PUSH_RULE_ID = 'org.onetab.poll_activity';
export const POLL_PUSH_RULE_PATTERN = 'org.matrix.msc3381.poll.*';

export function isPollRelationType(type: string): boolean {
  return type === POLL_RESPONSE_TYPE || type === POLL_END_TYPE;
}

/** The plain-text body a poll travels with — what previews and search see. */
export function pollFallbackBody(
  question: string,
  answers: { text: string }[],
): string {
  return `📊 ${question}\n${answers.map((answer) => `• ${answer.text}`).join('\n')}`;
}

/** Normalises a draft into the content stored on the poll event. */
export function buildPollContent(draft: PollDraft, now: number): PollContent {
  const answers = draft.answers
    .map((answer) => ({
      text: answer.text.trim().slice(0, POLL_LIMITS.answerLength),
      emoji: answer.emoji || undefined,
    }))
    .filter((answer) => answer.text)
    .slice(0, POLL_LIMITS.maxAnswers)
    .map((answer, index) => ({ id: `a${index + 1}`, ...answer }));
  return {
    question: draft.question.trim().slice(0, POLL_LIMITS.questionLength),
    answers,
    max_selections: Math.min(
      Math.max(1, Math.floor(draft.maxSelections)),
      answers.length,
    ),
    ends_at: now + Math.max(60_000, draft.durationMs),
  };
}

export function readPollContent(
  content: Record<string, unknown>,
): PollContent | null {
  const raw = content[POLL_KEY] as Partial<PollContent> | undefined;
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.question !== 'string' || !Array.isArray(raw.answers))
    return null;
  const answers = raw.answers.filter(
    (answer): answer is PollContent['answers'][number] =>
      !!answer &&
      typeof answer.id === 'string' &&
      typeof answer.text === 'string',
  );
  if (answers.length < POLL_LIMITS.minAnswers) return null;
  return {
    question: raw.question,
    answers,
    max_selections:
      typeof raw.max_selections === 'number' && raw.max_selections >= 1
        ? Math.min(Math.floor(raw.max_selections), answers.length)
        : 1,
    ends_at:
      typeof raw.ends_at === 'number' ? raw.ends_at : Number.POSITIVE_INFINITY,
  };
}

/** The poll's state before anyone has voted — the local echo shows this. */
export function emptyPoll(content: PollContent): MessagePoll {
  return {
    question: content.question,
    answers: content.answers.map((answer) => ({
      ...answer,
      votes: 0,
      voterIds: [],
    })),
    maxSelections: content.max_selections,
    endsAt: content.ends_at,
    totalVoters: 0,
    myAnswerIds: [],
  };
}

function relatedEvents(
  room: PollRoom | null,
  pollId: string,
  type: string,
): PollEvent[] {
  return (
    room
      ?.getUnfilteredTimelineSet()
      .relations?.getChildEventsForEvent(pollId, 'm.reference', type)
      ?.getRelations() ?? []
  );
}

/**
 * Tallies a poll from the votes the client holds. Votes cast after the poll
 * closed are ignored, and so is anything that names an unknown answer or more
 * answers than the poll allows — a spoiled ballot counts as no vote.
 */
export function toPoll(
  client: PollClient,
  room: PollRoom | null,
  event: PollEvent,
  content: Record<string, unknown>,
  now = Date.now(),
): MessagePoll | undefined {
  const poll = readPollContent(content);
  const pollId = event.getId();
  if (!poll || !pollId) return undefined;

  const author = event.getSender();
  const endedAt = relatedEvents(room, pollId, POLL_END_TYPE)
    .filter((end) => !end.isRedacted() && end.getSender() === author)
    .reduce<number | undefined>(
      (earliest, end) => Math.min(earliest ?? Infinity, end.getTs()),
      undefined,
    );
  const cutoff = Math.min(endedAt ?? Infinity, poll.ends_at);

  const latest = new Map<string, PollEvent>();
  for (const vote of relatedEvents(room, pollId, POLL_RESPONSE_TYPE)) {
    const voter = vote.getSender();
    if (!voter || vote.isRedacted() || vote.getTs() > cutoff) continue;
    const previous = latest.get(voter);
    if (!previous || previous.getTs() <= vote.getTs()) latest.set(voter, vote);
  }

  const known = new Set(poll.answers.map((answer) => answer.id));
  const votesByAnswer = new Map<string, string[]>();
  const myUserId = client.getUserId();
  let myAnswerIds: string[] = [];
  let totalVoters = 0;
  for (const [voter, vote] of latest) {
    const picked = (
      vote.getContent()[POLL_RESPONSE_TYPE] as { answers?: unknown } | undefined
    )?.answers;
    const answers = Array.isArray(picked) ? [...new Set(picked)] : [];
    if (
      answers.length === 0 ||
      answers.length > poll.max_selections ||
      !answers.every(
        (id): id is string => typeof id === 'string' && known.has(id),
      )
    ) {
      continue;
    }
    totalVoters += 1;
    if (voter === myUserId) myAnswerIds = answers;
    for (const id of answers)
      votesByAnswer.set(id, [...(votesByAnswer.get(id) ?? []), voter]);
  }

  const answers: PollAnswer[] = poll.answers.map((answer) => {
    const voterIds = votesByAnswer.get(answer.id) ?? [];
    return { ...answer, votes: voterIds.length, voterIds };
  });

  return {
    question: poll.question,
    answers,
    maxSelections: poll.max_selections,
    endsAt: poll.ends_at,
    closedAt: endedAt ?? (now >= poll.ends_at ? poll.ends_at : undefined),
    totalVoters,
    myAnswerIds,
  };
}
