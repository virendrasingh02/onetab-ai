import { Card, Page, PageHeader, type PageHeaderProps } from '@org/ui';
import { cn } from '@org/utils';
import type { ReactNode } from 'react';

export interface AgentTabPageProps
  extends Pick<PageHeaderProps, 'title' | 'description' | 'icon' | 'actions' | 'toolbar'> {
  children?: ReactNode;
  className?: string;
}

/**
 * The frame every agent section beside the canvas renders in (Connectors,
 * Memory, Secrets, Executions, Evaluation, Versions, Deploy, Marketplace,
 * Settings): its own scroll area, a full-width column with the Studio's page
 * gutters, and the standard page header. Sections used to pick their own
 * max-width and heading style, so the layout jumped as you switched between them.
 */
export function AgentTabPage({ title, description, icon, actions, toolbar, className, children }: AgentTabPageProps) {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <Page width="full" className={cn('gap-6 pb-12', className)}>
        <PageHeader
          title={title}
          description={description}
          icon={icon}
          accent="mint"
          actions={actions}
          toolbar={toolbar}
          className="mb-0"
        />
        {children}
      </Page>
    </div>
  );
}

export interface AgentTabSectionProps {
  /** Anchor id, for in-page navigation. */
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Lucide icon element, shown before the title. */
  icon?: ReactNode;
  /** Buttons and controls, right-aligned beside the title. */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** A titled card within an agent section — one look for every settings block. */
export function AgentTabSection({ id, title, description, icon, actions, className, children }: AgentTabSectionProps) {
  return (
    <Card id={id} className={cn('gap-4 p-5', id && 'scroll-mt-16', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon ? (
              <span aria-hidden className="flex shrink-0 text-primary [&_svg]:size-4">
                {icon}
              </span>
            ) : null}
            {title}
          </h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}
