import type { Message, RoomMember } from '@org/matrix-client';

/**
 * Sample conversation data for the channel surface.
 *
 * The chat features are designed against a real Matrix room, but a deployment
 * without a homeserver — which is every local checkout — has nothing to render,
 * so the whole surface used to collapse to "chat is not configured". This
 * module produces a conversation with the same shape `useRoom` returns, so the
 * design can be built and reviewed before the bridge is switched on.
 *
 * Everything here is deterministic per channel: the same channel always gets
 * the same people, messages and threads, so a screenshot taken today matches
 * one taken tomorrow and nothing reshuffles between renders.
 */

export const MOCK_USER_ID = '@you:onetab.local';

interface MockPerson {
  userId: string;
  displayName: string;
  powerLevel: number;
}

const PEOPLE: MockPerson[] = [
  { userId: MOCK_USER_ID, displayName: 'You', powerLevel: 50 },
  { userId: '@priya:onetab.local', displayName: 'Priya Raman', powerLevel: 100 },
  { userId: '@dev:onetab.local', displayName: 'Dev User', powerLevel: 50 },
  { userId: '@marco:onetab.local', displayName: 'Marco Silva', powerLevel: 0 },
  { userId: '@aisha:onetab.local', displayName: 'Aisha Khan', powerLevel: 0 },
  { userId: '@tom:onetab.local', displayName: 'Tom Becker', powerLevel: 0 },
];

/** Stable 32-bit hash, so each channel draws a different slice of the script. */
function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Midnight-anchored so the day separators land on real day boundaries. */
function dayStart(daysAgo: number): number {
  const date = new Date();
  date.setHours(9, 12, 0, 0);
  return date.getTime() - daysAgo * DAY;
}

interface ScriptEntry {
  /** Index into `PEOPLE`. */
  who: number;
  body: string;
  /** Minutes after the day's anchor. */
  at: number;
  daysAgo: number;
  reactions?: [emoji: string, count: number, mine?: boolean][];
  edited?: boolean;
  /** Names this entry so replies can point at it without using its position. */
  key?: string;
  /** The `key` of the entry this replies to, making it a threaded reply. */
  thread?: string;
  attachment?: 'image' | 'file' | 'voice';
}

/**
 * The conversation itself.
 *
 * Written as data rather than generated from word lists: a channel full of
 * lorem ipsum tells you nothing about whether the design holds up, and the
 * lengths here are deliberate — one-liners next to paragraphs, so grouping,
 * wrapping and the hover actions all get exercised.
 */
const SCRIPT: ScriptEntry[] = [
  {
    who: 1,
    daysAgo: 2,
    at: 0,
    body: 'Morning all — the workspace import lands on staging today. Anything you want in before I cut the build, shout now.',
    reactions: [
      ['🎉', 4],
      ['🚀', 2, true],
    ],
  },
  {
    who: 2,
    daysAgo: 2,
    at: 6,
    key: 'importer-fix',
    body: 'One thing: the Slack importer still drops thread replies onto the root timeline. I have a fix but it needs a review.',
  },
  {
    who: 2,
    daysAgo: 2,
    at: 7,
    body: 'Branch is `fix/import-thread-parents` if anyone has a spare twenty minutes.',
  },
  {
    who: 1,
    daysAgo: 2,
    at: 14,
    body: 'Grabbing it now.',
    thread: 'importer-fix',
  },
  {
    who: 3,
    daysAgo: 2,
    at: 21,
    body: 'Read through it — the parent lookup is right, but it will fall over on messages whose root was deleted before the export. Worth a guard.',
    thread: 'importer-fix',
  },
  {
    who: 2,
    daysAgo: 2,
    at: 33,
    body: 'Good catch. Pushed a guard that reparents orphans to the channel root instead of dropping them.',
    thread: 'importer-fix',
    reactions: [['✅', 3, true]],
  },
  {
    who: 4,
    daysAgo: 1,
    at: 0,
    body: 'Design review notes from yesterday, for anyone who missed it.',
    attachment: 'file',
    reactions: [['🙏', 2]],
  },
  {
    who: 4,
    daysAgo: 1,
    at: 2,
    body: 'Headline: the sidebar grouping tested well, but nobody found the archived section. We either surface it or fold it into search.',
  },
  {
    who: 5,
    daysAgo: 1,
    at: 26,
    body: 'Fold it into search. Archived channels are a "I know what I am looking for" case, not a browse case.',
    reactions: [
      ['💯', 3],
      ['👀', 1],
    ],
  },
  {
    who: 3,
    daysAgo: 1,
    at: 41,
    body: 'Agreed. I will take the search side of it this sprint.',
  },
  {
    who: 4,
    daysAgo: 1,
    at: 52,
    body: '@You do you still have the density spec from the header pass? I want to line the search results up with it.',
    reactions: [['👀', 1, true]],
  },
  {
    who: 1,
    daysAgo: 1,
    at: 95,
    key: 'header-shot',
    body: 'Here is where the new channel header ended up after the density pass.',
    attachment: 'image',
    reactions: [
      ['🔥', 5, true],
      ['❤️', 2],
    ],
  },
  {
    who: 5,
    daysAgo: 1,
    at: 104,
    body: 'That is much better. The topic row earning its own line was the right call.',
    thread: 'header-shot',
  },
  {
    who: 4,
    daysAgo: 1,
    at: 118,
    body: 'Only note: the member stack overlaps the huddle button under 900px. Easy fix.',
    thread: 'header-shot',
  },
  {
    who: 2,
    daysAgo: 0,
    at: 0,
    body: 'Staging is up with the import build. Anyone want to break it?',
    reactions: [['😄', 2]],
  },
  {
    who: 6,
    daysAgo: 0,
    at: 12,
    body: 'On it. Running the 4k-message export through now.',
  },
  {
    who: 6,
    daysAgo: 0,
    at: 48,
    body: 'Import finished in 2m14s, no dropped threads. Attachments came through with the right mime types too.',
    reactions: [
      ['🎉', 6, true],
      ['🚀', 3],
    ],
  },
  {
    who: 3,
    daysAgo: 0,
    at: 55,
    body: 'Quick voice note on the rate limiting we hit halfway through.',
    attachment: 'voice',
  },
  {
    who: 6,
    daysAgo: 0,
    at: 63,
    body: '@here staging will bounce for two minutes while I roll the new build out. Nothing to do, just so nobody files a bug.',
    reactions: [['👍', 4, true]],
  },
  {
    who: 1,
    daysAgo: 0,
    at: 71,
    body: 'Nice work everyone. I will write this up for the release notes this afternoon.',
    edited: true,
  },
  {
    who: 5,
    daysAgo: 0,
    at: 78,
    body: 'One open question before we ship: do we keep the original Slack timestamps, or stamp them at import time? It changes how the first week of history reads.',
    reactions: [['🤔', 2]],
  },
];

const IMAGE_ATTACHMENT = {
  name: 'channel-header-density.png',
  mimeType: 'image/png',
  size: 284_193,
  url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22640%22%20height%3D%22360%22%3E%3Crect%20width%3D%22640%22%20height%3D%22360%22%20fill%3D%22%2318181B%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2224%22%20width%3D%22592%22%20height%3D%2264%22%20rx%3D%228%22%20fill%3D%22%2327272A%22%2F%3E%3Crect%20x%3D%2240%22%20y%3D%2244%22%20width%3D%22180%22%20height%3D%2212%22%20rx%3D%226%22%20fill%3D%22%236E56CF%22%2F%3E%3Crect%20x%3D%2240%22%20y%3D%2264%22%20width%3D%22300%22%20height%3D%228%22%20rx%3D%224%22%20fill%3D%22%233F3F46%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%22104%22%20width%3D%22592%22%20height%3D%22232%22%20rx%3D%228%22%20fill%3D%22%2327272A%22%2F%3E%3C%2Fsvg%3E',
  width: 640,
  height: 360,
};

const FILE_ATTACHMENT = {
  name: 'design-review-notes.pdf',
  mimeType: 'application/pdf',
  size: 118_402,
  url: '#',
};

const VOICE_ATTACHMENT = {
  name: 'rate-limiting-note.ogg',
  mimeType: 'audio/ogg',
  size: 42_118,
  url: '#',
  duration: 47,
  waveform: [
    0.2, 0.5, 0.8, 0.6, 0.35, 0.7, 0.9, 0.55, 0.3, 0.45, 0.75, 0.85, 0.4, 0.25,
    0.6, 0.8, 0.5, 0.3, 0.65, 0.4, 0.2, 0.55, 0.7, 0.45, 0.3, 0.6, 0.35, 0.15,
  ],
};

/** A link or canvas pinned to the channel header. */
export interface MockBookmark {
  id: string;
  label: string;
  href: string;
  emoji: string;
}

export interface MockConversation {
  roomId: string;
  members: RoomMember[];
  messages: Message[];
  bookmarks: MockBookmark[];
  /** Ids of messages pinned to the channel. */
  pinnedIds: string[];
  /** Ids the reader saved for later. */
  savedIds: string[];
  /** First message the reader has not seen; drives the unread divider. */
  firstUnreadId: string | null;
  /** People currently in the channel huddle, empty when none is running. */
  huddleParticipants: RoomMember[];
}

/**
 * Builds the conversation for one channel.
 *
 * The channel id only picks the starting offset into the script and the huddle
 * state, which is enough for two channels to look like different rooms without
 * maintaining a second script.
 */
export function buildMockConversation(
  channelId: string,
  channelName: string,
): MockConversation {
  const seed = hash(channelId);
  const roomId = `!mock-${seed.toString(36)}:onetab.local`;

  const members: RoomMember[] = PEOPLE.map((person) => ({
    userId: person.userId,
    displayName: person.displayName,
    powerLevel: person.powerLevel,
    membership: 'join',
  }));

  const idOf = (index: number) => `$mock-${seed.toString(36)}-${index}`;

  // Resolved from the full script, not the slice, so a reply's root id is the
  // same regardless of where the channel starts reading.
  const idByKey = new Map<string, string>();
  SCRIPT.forEach((entry, index) => {
    if (entry.key) idByKey.set(entry.key, idOf(index));
  });

  // Longer-lived channels show the whole script; a second channel starts later
  // so it does not read as a copy of the first.
  const skip = seed % 3 === 0 ? 0 : (seed % 5) + 2;
  const entries = SCRIPT.slice(skip);
  const presentIds = new Set(entries.map((_, index) => idOf(index + skip)));

  const messages: Message[] = entries.map((entry, index) => {
    const person = PEOPLE[entry.who % PEOPLE.length];
    const scriptIndex = index + skip;
    const timestamp = dayStart(entry.daysAgo) + entry.at * MINUTE;

    // A reply whose root fell outside the slice is promoted to the timeline:
    // an orphan would render a thread summary that opens onto nothing.
    const rootId = entry.thread ? idByKey.get(entry.thread) : undefined;

    const attachment =
      entry.attachment === 'image'
        ? IMAGE_ATTACHMENT
        : entry.attachment === 'file'
          ? FILE_ATTACHMENT
          : entry.attachment === 'voice'
            ? VOICE_ATTACHMENT
            : undefined;

    return {
      id: idOf(scriptIndex),
      roomId,
      senderId: person.userId,
      senderName: person.displayName,
      kind:
        entry.attachment === 'image'
          ? 'image'
          : entry.attachment === 'file'
            ? 'file'
            : entry.attachment === 'voice'
              ? 'voice'
              : 'text',
      body: entry.body,
      timestamp,
      attachment,
      reactions: (entry.reactions ?? []).map(([key, count, mine]) => ({
        key,
        count,
        reactedByMe: mine ?? false,
        // Reactor ids only matter for the "who reacted" tooltip; take them in
        // order so the count and the list never disagree.
        userIds: PEOPLE.slice(0, count).map((reactor) => reactor.userId),
      })),
      isEdited: entry.edited ?? false,
      isRedacted: false,
      threadRootId: rootId && presentIds.has(rootId) ? rootId : undefined,
      isEncrypted: true,
    };
  });

  const roots = messages.filter((message) => !message.threadRootId);

  return {
    roomId,
    members,
    messages,
    bookmarks: [
      {
        id: 'bm-canvas',
        label: `${channelName} canvas`,
        href: '#',
        emoji: '🗒️',
      },
      { id: 'bm-runbook', label: 'Release runbook', href: '#', emoji: '📘' },
      { id: 'bm-board', label: 'Sprint board', href: '#', emoji: '📋' },
    ],
    // Pin the two messages a newcomer would need: the import announcement and
    // the open question at the end.
    pinnedIds: [messages[0]?.id, messages.at(-1)?.id].filter(
      (id): id is string => !!id,
    ),
    savedIds: [roots.at(-3)?.id].filter((id): id is string => !!id),
    firstUnreadId: roots.at(-3)?.id ?? null,
    huddleParticipants: seed % 2 === 0 ? members.slice(1, 4) : [],
  };
}
