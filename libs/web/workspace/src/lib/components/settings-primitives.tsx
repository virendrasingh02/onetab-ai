import { cn } from '@org/utils';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Shared building blocks for the workspace settings screens.
 *
 * `workspace-settings-page.tsx` hand-rolled the same three shells dozens of
 * times each — the section title block, the inset panel, and the labelled
 * control row. They live here so the look is tuned in one place.
 */

/** The `<h1>` + lead paragraph every settings section opens with. */
export function SettingsSectionHeader({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="text-xs mt-1 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export interface SettingsCardProps extends ComponentProps<'div'> {
  /**
   * Render as a divided list container for `<SettingsRow>` children instead of
   * a padded panel.
   */
  divided?: boolean;
}

/** A bordered inset panel — the standard surface for a group of settings. */
export function SettingsCard({
  divided,
  className,
  ...props
}: SettingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface-inset shadow-xs',
        divided ? 'divide-y divide-border/40 overflow-hidden' : 'p-6 space-y-6',
        className,
      )}
      {...props}
    />
  );
}

export interface SettingsRowProps extends Omit<ComponentProps<'div'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
}

/**
 * One labelled row inside a `divided` `<SettingsCard>`: title + optional
 * description on the left, the control passed as `children` on the right.
 */
export function SettingsRow({
  title,
  description,
  className,
  children,
  ...props
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'p-4 gap-4 flex items-center justify-between transition-colors hover:bg-accent/40',
        className,
      )}
      {...props}
    >
      <div>
        <h4 className="text-xs font-medium text-foreground">{title}</h4>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
