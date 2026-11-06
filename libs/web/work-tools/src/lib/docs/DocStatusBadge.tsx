import { Badge } from '@org/ui';
import type { ComponentProps } from 'react';
import type { DocStatus } from './doc-types.js';

const STATUS_VARIANT: Record<
  DocStatus,
  ComponentProps<typeof Badge>['variant']
> = {
  Draft: 'outline',
  'In Review': 'warning',
  Finalized: 'primary',
  Archived: 'neutral',
};

/** A document's review status, as shown on gallery and project doc cards. */
export function DocStatusBadge({ status = 'Draft' }: { status?: DocStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className="text-[10px] px-1.5 py-0 h-4.5"
    >
      {status}
    </Badge>
  );
}

/**
 * Card controls appear on hover, but must also show for keyboard focus, while
 * their menu is open, and on touch screens, which never hover.
 */
export const CARD_ACTIONS_REVEAL =
  'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 pointer-coarse:opacity-100';
