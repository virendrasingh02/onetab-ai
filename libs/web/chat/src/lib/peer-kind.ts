/**
 * DM peers are teammates, AI agents or connected apps, told apart by an id
 * prefix (`agent-` / `app-`) that the DM page synthesises for the non-human
 * ones. This is the single place that mapping lives — it was hand-inlined in
 * the picker, the header and the new-message roster.
 */
export type PeerKind = 'person' | 'agent' | 'app';

export function peerKindOf(id: string): PeerKind {
  if (id.startsWith('agent-')) return 'agent';
  if (id.startsWith('app-')) return 'app';
  return 'person';
}
