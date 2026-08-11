import type {
  ChannelMember,
  ChannelPin,
  ChannelSummary,
  PublicUser,
  Upload,
} from '@org/types';

/**
 * Fallback channel data for a workspace with no API behind it.
 *
 * `useChannels` has listed sample channels in the sidebar for a while, but the
 * detail, member, pin and file queries had no equivalent — so every sample
 * channel in the sidebar opened onto "Channel not found". These fill that gap,
 * which is what makes the channel design reviewable in a local checkout.
 *
 * The people here are the same cast as the sample conversation in
 * `@org/web-chat`, so the member list and the messages agree about who is in
 * the room.
 */

const NOW = new Date().toISOString();

function person(
  id: string,
  name: string,
  displayName: string,
  presence: PublicUser['presence'],
): PublicUser {
  return {
    id,
    name,
    displayName,
    avatarUrl: null,
    presence,
    lastSeenAt: NOW,
  };
}

export const SAMPLE_PEOPLE: PublicUser[] = [
  person('usr_priya', 'priya', 'Priya Raman', 'ONLINE'),
  person('usr_dev', 'dev', 'Dev User', 'ONLINE'),
  person('usr_marco', 'marco', 'Marco Silva', 'AWAY'),
  person('usr_aisha', 'aisha', 'Aisha Khan', 'ONLINE'),
  person('usr_tom', 'tom', 'Tom Becker', 'BUSY'),
];

const CHANNEL_SEEDS: {
  slug: string;
  topic: string;
  description: string;
}[] = [
  {
    slug: 'general',
    topic: 'Company-wide announcements and work-based matters',
    description: 'Work-based matters and general discussion',
  },
  {
    slug: 'random',
    topic: 'Non-work banter and water cooler chat',
    description: 'Water cooler talk',
  },
];

function toChannel(
  workspaceId: string,
  slug: string,
  topic: string,
  description: string,
): ChannelSummary {
  return {
    id: `chan_${slug}`,
    workspaceId,
    name: slug,
    slug,
    topic,
    description,
    visibility: 'PUBLIC',
    isArchived: false,
    archivedAt: null,
    createdById: SAMPLE_PEOPLE[0].id,
    createdAt: NOW,
    updatedAt: NOW,
    memberCount: SAMPLE_PEOPLE.length,
    membership: {
      role: 'MEMBER',
      isFavorite: false,
      isMuted: false,
      lastReadAt: NOW,
    },
  };
}

export function sampleChannels(workspaceId = 'ws_onetab'): ChannelSummary[] {
  return CHANNEL_SEEDS.map((seed) =>
    toChannel(workspaceId, seed.slug, seed.topic, seed.description),
  );
}

/**
 * The channel behind a slug.
 *
 * Any slug resolves, not just the seeded two: a channel created while the API
 * is unreachable still has to open, and a dead end there reads as a bug rather
 * than as missing data.
 */
export function sampleChannel(
  workspaceId: string,
  slug: string,
): ChannelSummary {
  const seed = CHANNEL_SEEDS.find((entry) => entry.slug === slug);

  return toChannel(
    workspaceId,
    slug,
    seed?.topic ?? `Everything about ${slug}`,
    seed?.description ?? `Sample channel for #${slug}.`,
  );
}

export function sampleMembers(channelId: string): ChannelMember[] {
  return SAMPLE_PEOPLE.map((user, index) => ({
    id: `${channelId}_m${index}`,
    channelId,
    // The channel's creator keeps the admin badge; everyone else is a member.
    role: index === 0 ? 'ADMIN' : 'MEMBER',
    isFavorite: false,
    isMuted: false,
    joinedAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
    user,
  }));
}

export function samplePins(channelId: string): ChannelPin[] {
  return [
    {
      id: `${channelId}_p1`,
      channelId,
      title: 'Release runbook',
      url: 'https://example.com/runbook',
      note: 'Steps for cutting a build, in order. Read before deploying.',
      pinnedById: SAMPLE_PEOPLE[0].id,
      pinnedAt: NOW,
    },
    {
      id: `${channelId}_p2`,
      channelId,
      title: 'Import dry-run notes',
      url: null,
      note: 'Timestamps stay as they were in the export. Decided 2 days ago.',
      pinnedById: SAMPLE_PEOPLE[1].id,
      pinnedAt: NOW,
    },
  ];
}

/**
 * A placeholder image served from the document itself.
 *
 * An inline SVG keeps the Media tab renderable with no upload server; the page
 * passes a `storageKey` through untouched when it is already a URL.
 */
const SAMPLE_IMAGE_KEY =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22400%22%3E%3Crect%20width%3D%22400%22%20height%3D%22400%22%20fill%3D%22%2318181B%22%2F%3E%3Ccircle%20cx%3D%22200%22%20cy%3D%22160%22%20r%3D%2258%22%20fill%3D%22%236E56CF%22%20opacity%3D%22.35%22%2F%3E%3Crect%20x%3D%2264%22%20y%3D%22258%22%20width%3D%22272%22%20height%3D%2214%22%20rx%3D%227%22%20fill%3D%22%2327272A%22%2F%3E%3Crect%20x%3D%22104%22%20y%3D%22292%22%20width%3D%22192%22%20height%3D%2210%22%20rx%3D%225%22%20fill%3D%22%2327272A%22%2F%3E%3C%2Fsvg%3E';

export function sampleFiles(workspaceId: string, channelId: string): Upload[] {
  const file = (
    index: number,
    filename: string,
    mimeType: string,
    size: number,
    storageKey: string,
    uploader: PublicUser,
  ): Upload => ({
    id: `${channelId}_f${index}`,
    workspaceId,
    channelId,
    filename,
    mimeType,
    size,
    storageKey,
    createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    uploader,
  });

  return [
    file(
      1,
      'design-review-notes.pdf',
      'application/pdf',
      118_402,
      'sample/design-review-notes.pdf',
      SAMPLE_PEOPLE[2],
    ),
    file(
      2,
      'import-benchmark.csv',
      'text/csv',
      24_118,
      'sample/import-benchmark.csv',
      SAMPLE_PEOPLE[4],
    ),
    file(
      3,
      'release-runbook.md',
      'text/markdown',
      8_204,
      'sample/release-runbook.md',
      SAMPLE_PEOPLE[0],
    ),
    file(
      4,
      'channel-header-density.png',
      'image/png',
      284_193,
      SAMPLE_IMAGE_KEY,
      SAMPLE_PEOPLE[0],
    ),
    file(
      5,
      'sidebar-grouping-test.png',
      'image/png',
      196_704,
      SAMPLE_IMAGE_KEY,
      SAMPLE_PEOPLE[3],
    ),
  ];
}
