import { PageBar, PageTabBar, Tabs, TabsTrigger } from '@org/ui';
import { cn } from '@org/utils';
import type { ReactNode } from 'react';

export interface StudioPageTab {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/**
 * The frame every Studio sidebar page uses: the sticky `PageBar` (icon, title,
 * actions — the same bar as `SectionHeader`), an optional tab row inside it
 * styled like the section tabs, then padded content opening with the page's
 * one-line description.
 */
export function StudioPage({
  icon,
  title,
  description,
  actions,
  tabs,
  className,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** The page's own views, shown as the header's tab row. */
  tabs?: { items: ReadonlyArray<StudioPageTab>; value: string; onValueChange: (value: string) => void };
  /** Extra classes for the content area (e.g. its vertical spacing). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar icon={icon} title={title} actions={actions} hasTabs={Boolean(tabs)}>
        {tabs ? (
          <Tabs value={tabs.value} onValueChange={tabs.onValueChange}>
            <PageTabBar>
              {tabs.items.map((t) => (
                <TabsTrigger key={t.value} value={t.value} icon={t.icon} count={t.count}>
                  {t.label}
                </TabsTrigger>
              ))}
            </PageTabBar>
          </Tabs>
        ) : null}
      </PageBar>
      <div className={cn('flex-1 space-y-6 p-4 sm:p-6', className)}>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
