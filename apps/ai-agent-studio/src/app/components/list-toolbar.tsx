import { Toolbar } from '@org/ui';
import type { ReactNode } from 'react';

/**
 * The filter row under a `SectionHeader`: search and filters on the left,
 * view controls (selects, layout toggle) on the right.
 */
export function ListToolbar({
  children,
  end,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  end?: ReactNode;
  'aria-label': string;
}) {
  return (
    <Toolbar aria-label={ariaLabel} className="justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex flex-wrap items-center gap-2">{children}</div>
      {end ? <div className="flex flex-wrap items-center gap-2">{end}</div> : null}
    </Toolbar>
  );
}
