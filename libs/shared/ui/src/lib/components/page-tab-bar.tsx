import type { ReactNode } from 'react';
import { ResponsiveTabsList } from './responsive-tabs.js';

export interface PageTabBarProps {
  /** The `TabsTrigger`s. */
  children: ReactNode;
  /** Controls right after the tabs (e.g. a channel's “+” add menu). */
  afterTabs?: ReactNode;
  /** Controls at the far end of the bar (e.g. the active tab's primary action). */
  end?: ReactNode;
}

/**
 * The tab strip under a page header — every conversation (channel, DM, group
 * DM, agent, coworker, app) and the Inbox / Threads / Saved pages — so they
 * share one look: compact underline tabs sitting flush on the bar's bottom
 * rule. The header above it carries no border of its own; this bar closes the
 * block. Render inside a `<Tabs>`.
 */
export function PageTabBar({ children, afterTabs, end }: PageTabBarProps) {
  return (
    <div
      data-page-tab-bar=""
      className="px-3 sm:px-6 h-9 gap-2 flex shrink-0 items-end justify-between border-b border-border bg-background"
    >
      <div className="min-w-0 gap-1 flex h-full items-end">
        <ResponsiveTabsList
          variant="underline"
          size="sm"
          gap={4}
          className="min-w-0 gap-1 pb-0 -mb-px w-auto border-b-0"
        >
          {children}
        </ResponsiveTabsList>
        {afterTabs ? (
          <div className="mb-1 flex shrink-0 items-center">{afterTabs}</div>
        ) : null}
      </div>
      {end ? (
        <div className="gap-2 flex shrink-0 items-center self-center">
          {end}
        </div>
      ) : null}
    </div>
  );
}
