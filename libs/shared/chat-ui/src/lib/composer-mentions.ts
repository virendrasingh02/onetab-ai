import { toBotIdentity, type RoomMember } from '@org/types';
import type { MentionCandidate } from './lexical-composer.js';

/**
 * Mentions that address a group rather than a person. They lead the `@` menu
 * because they are the ones people reach for by name rather than by face. The
 * counts come from the live rosters, so the subtitle says who actually gets
 * pinged.
 */
export function buildGroupMentions(counts: {
  online?: number;
  channel?: number;
  workspace?: number;
}): MentionCandidate[] {
  const people = (n: number | undefined, scope: string) =>
    n && n > 0 ? `${n} ${n === 1 ? 'person' : 'people'} ${scope}` : undefined;
  return [
    {
      id: 'here',
      name: 'here',
      kind: 'group',
      subtitle:
        counts.online !== undefined
          ? `${counts.online} online in this channel`
          : 'Notify active members in this channel',
    },
    {
      id: 'channel',
      name: 'channel',
      kind: 'group',
      subtitle:
        people(counts.channel, 'in this channel') ??
        'Notify every member of this channel',
    },
    {
      id: 'everyone',
      name: 'everyone',
      kind: 'group',
      subtitle:
        people(counts.workspace, 'in this workspace') ??
        'Notify everyone in this workspace',
    },
  ];
}

/**
 * Splits a room roster into mention candidates. Agents, coworkers and apps sit
 * in the roster as bridged Matrix users, so they come out under their own kind
 * — keyed by their row id, the one the agent/app mention lists use — instead of
 * passing for people and inflating the people counts.
 */
export function roomMembersToMentionCandidates(
  members: readonly RoomMember[],
  currentUserId?: string | null,
): { people: MentionCandidate[]; bots: MentionCandidate[] } {
  const people: MentionCandidate[] = [];
  const bots: MentionCandidate[] = [];
  for (const member of members) {
    const bot = toBotIdentity(member.userId);
    if (bot) {
      bots.push({
        id: bot.id,
        name: member.displayName,
        avatarUrl: member.avatarUrl,
        kind: bot.kind,
      });
    } else {
      people.push({
        id: member.userId,
        name: member.displayName,
        avatarUrl: member.avatarUrl,
        kind: 'user',
        isSelf: !!currentUserId && member.userId === currentUserId,
      });
    }
  }
  people.sort((a, b) => Number(b.isSelf ?? false) - Number(a.isSelf ?? false));
  return { people, bots };
}
