import { cn } from '@org/utils';
import type { ComponentProps, MouseEventHandler, ReactNode } from 'react';

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
        'rounded-xl border border-border bg-surface shadow-xs',
        divided ? 'divide-y divide-border/60 overflow-hidden' : 'p-5 space-y-5',
        className,
      )}
      {...props}
    />
  );
}

/** The rounded icon tile that leads a settings row. */
export function SettingsIconTile({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'size-9 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-inset text-muted-foreground [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

const BADGE_TONES = {
  success: 'border-success/30 bg-success/10 text-success-text',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive-text',
  violet: 'border-accent-violet/30 bg-accent-violet-soft text-accent-violet',
  neutral: 'border-border bg-surface-inset text-muted-foreground',
} as const;

export interface SettingsBadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof BADGE_TONES;
  disabled?: boolean;
}

/** Small pill next to a row title (status, "Send sample", "Beta"…). Pass `onClick` to make it a button. */
export function SettingsBadge({
  tone = 'neutral',
  className,
  onClick,
  disabled,
  ...props
}: SettingsBadgeProps) {
  const classes = cn(
    'px-2 py-0.5 font-medium rounded-full border text-[10px] leading-4 transition-colors',
    BADGE_TONES[tone],
    onClick && 'cursor-pointer hover:brightness-95 disabled:opacity-60',
    className,
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick as unknown as MouseEventHandler<HTMLButtonElement>}
        disabled={disabled}
        className={classes}
        {...(props as ComponentProps<'button'>)}
      />
    );
  }
  return <span className={classes} {...props} />;
}

export interface SettingsRowProps extends Omit<ComponentProps<'div'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Leading icon, rendered in a `<SettingsIconTile>`. */
  icon?: ReactNode;
  /** Pill(s) shown beside the title. */
  badge?: ReactNode;
  /** Smaller, indented variant for a sub-setting nested under a parent row. */
  nested?: boolean;
}

/**
 * One labelled row inside a `divided` `<SettingsCard>`: icon + title +
 * optional badge/description on the left, the control passed as `children`
 * on the right.
 */
export function SettingsRow({
  title,
  description,
  icon,
  badge,
  nested,
  className,
  children,
  ...props
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'gap-4 flex items-center justify-between transition-colors hover:bg-accent/40',
        nested ? 'py-3 pr-4 pl-[4.25rem]' : 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      <div className="gap-3.5 min-w-0 flex items-center">
        {icon ? <SettingsIconTile>{icon}</SettingsIconTile> : null}
        <div className="min-w-0">
          <div className="gap-2 flex items-center">
            <h4
              className={cn(
                'text-foreground',
                nested ? 'text-xs font-medium' : 'text-sm font-semibold',
              )}
            >
              {title}
            </h4>
            {badge}
          </div>
          {description ? (
            <p
              className={cn(
                'mt-0.5 text-muted-foreground',
                nested ? 'text-[11px]' : 'text-xs',
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
