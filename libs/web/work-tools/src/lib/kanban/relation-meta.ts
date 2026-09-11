import type { RelationTaskRef, RelationType, WorkItemRelation } from '@org/types';

/**
 * A relation row, resolved from this card's point of view — which end it is,
 * and the task on the other end. `WorkItemRelation` is symmetric (source →
 * target); a card only cares which one it is.
 */
export interface RelationView {
  id: string;
  type: RelationType;
  otherTask: RelationTaskRef;
  direction: 'outgoing' | 'incoming';
}

/** Resolves the raw rows from `useWorkItemRelations` against this card. */
export function relationsFor(
  relations: WorkItemRelation[] | undefined,
  cardId: string,
): RelationView[] {
  const views: RelationView[] = [];
  for (const relation of relations ?? []) {
    const isSource = relation.sourceId === cardId;
    const other = isSource ? relation.target : relation.source;
    if (!other) continue;
    views.push({
      id: relation.id,
      type: relation.type,
      otherTask: other,
      direction: isSource ? 'outgoing' : 'incoming',
    });
  }
  return views;
}

/**
 * How this relation reads from the card's side, e.g. a `BLOCKED_BY` row where
 * the card is the source reads "Blocked by"; the same row from the other
 * task's side would read "Blocks".
 */
export function relationVerb(type: RelationType, direction: RelationView['direction']): string {
  const outgoing = direction === 'outgoing';
  switch (type) {
    case 'BLOCKS':
      return outgoing ? 'Blocks' : 'Blocked by';
    case 'BLOCKED_BY':
      return outgoing ? 'Blocked by' : 'Blocks';
    case 'RELATED_TO':
      return 'Related to';
    case 'DUPLICATE_OF':
      return outgoing ? 'Duplicate of' : 'Duplicated by';
    case 'DUPLICATED_BY':
      return outgoing ? 'Duplicated by' : 'Duplicate of';
    case 'PARENT_OF':
      return outgoing ? 'Parent of' : 'Sub-item of';
    case 'SUB_ITEM_OF':
      return outgoing ? 'Sub-item of' : 'Parent of';
    default:
      return type;
  }
}

/** The subset that actually holds this card up — what the red banner warns about. */
export function isBlockingView(view: RelationView): boolean {
  return relationVerb(view.type, view.direction) === 'Blocked by';
}

/** Relation types offered when linking two tasks — parent/sub-item go through `parentId` instead. */
export const LINKABLE_RELATION_TYPES: Array<{ type: RelationType; label: string }> = [
  { type: 'BLOCKS', label: 'Blocks' },
  { type: 'BLOCKED_BY', label: 'Blocked by' },
  { type: 'RELATED_TO', label: 'Related to' },
  { type: 'DUPLICATE_OF', label: 'Duplicate of' },
  { type: 'DUPLICATED_BY', label: 'Duplicated by' },
];

/** `timeSpent` is minutes; renders the same "Xh Ym" shape the old placeholder used. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
