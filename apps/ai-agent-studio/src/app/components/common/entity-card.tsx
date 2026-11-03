import { UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import type { ReactNode } from 'react';

/**
 * The one card Studio lists agents and workflows with, so the Agents and
 * Workflows tabs read the same: identity, status + subtitle, a two-line
 * description, chips, then one footer row of facts and actions.
 *
 * The whole card opens `onOpen`; anything interactive inside (menu, footer
 * actions) sits above that layer, so it never opens the card by accident.
 */
export function EntityCard({
  name,
  avatar,
  status,
  subtitle,
  menu,
  description,
  chips,
  facts,
  owner,
  actions,
  onOpen,
  openLabel,
  dimmed,
}: {
  name: string;
  avatar: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
  /** The ⋯ menu, top right. */
  menu?: ReactNode;
  description?: string | null;
  /** Category, tags… Left out when there are none. */
  chips?: ReactNode;
  /** Footer left: model, counts. */
  facts?: ReactNode;
  owner?: {
    id?: string | null;
    name: string;
    avatarUrl?: string | null;
  } | null;
  /** Footer right: the primary action. */
  actions?: ReactNode;
  /** Opens the entity; omit to make the card inert (e.g. in Trash). */
  onOpen?: () => void;
  openLabel?: string;
  /** Faded look for entities that aren't live (Trash). */
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        'group p-4 relative flex flex-col rounded-xl border border-border bg-surface transition-all',
        dimmed ? 'opacity-80' : 'hover:border-border-strong hover:shadow-md',
      )}
    >
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel ?? `Open ${name}`}
          className="inset-0 absolute rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      )}

      <div className="gap-3 flex items-start">
        <span className="shrink-0">{avatar}</span>
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-semibold truncate text-foreground"
            title={name}
          >
            {name}
          </h3>
          {status || subtitle ? (
            <div className="mt-1 min-w-0 gap-1.5 text-xs flex items-center text-muted-foreground">
              {status ? (
                <span className="inline-flex shrink-0">{status}</span>
              ) : null}
              {subtitle ? <span className="truncate">{subtitle}</span> : null}
            </div>
          ) : null}
        </div>
        {menu ? (
          <div className="-mr-1 -mt-1 relative z-10 shrink-0">{menu}</div>
        ) : null}
      </div>

      {/* Fixed two-line block so footers line up across a row. */}
      <p
        className={cn(
          'mt-3 min-h-10 text-xs leading-5 line-clamp-2',
          description
            ? 'text-muted-foreground'
            : 'text-muted-foreground/60 italic',
        )}
      >
        {description || 'No description yet'}
      </p>

      <div className="mb-4 mt-3 min-h-5 gap-1.5 flex flex-wrap items-center">
        {chips}
      </div>

      <div className="gap-2 pt-3 mt-auto flex items-center border-t border-border/60">
        <div className="min-w-0 gap-2 text-xs flex flex-1 items-center overflow-hidden">
          {facts}
        </div>
        <div className="gap-1 relative z-10 flex shrink-0 items-center">
          {owner?.name && (
            <span title={`Owner: ${owner.name}`} className="mr-1 inline-flex">
              <UserAvatar
                name={owner.name}
                src={owner.avatarUrl ?? undefined}
                seed={owner.id ?? undefined}
                indicator={false}
                size="xs"
              />
            </span>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

/** A category chip and up to two `#tags`, the rest folded into "+N". */
export function EntityChips({
  category,
  tags = [],
}: {
  category?: string | null;
  tags?: string[];
}) {
  const extra = tags.length - 2;
  return (
    <>
      {category && (
        <span className="px-2 py-0.5 font-medium rounded-md border border-border/60 bg-surface-raised text-2xs text-foreground">
          {category}
        </span>
      )}
      {tags.slice(0, 2).map((t) => (
        <span
          key={t}
          className="px-1.5 py-0.5 rounded-md bg-muted/40 text-2xs text-muted-foreground"
        >
          #{t}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="text-2xs text-muted-foreground"
          title={tags
            .slice(2)
            .map((t) => `#${t}`)
            .join(' ')}
        >
          +{extra}
        </span>
      )}
    </>
  );
}

/** An icon + count fact for the footer ("2 tools", "5 nodes"); dimmed at zero. */
export function EntityCount({
  icon,
  count,
  label,
}: {
  icon: ReactNode;
  count: number;
  label: string;
}) {
  return (
    <span
      className={cn(
        'gap-1 [&_svg]:size-3 inline-flex shrink-0 items-center text-muted-foreground',
        !count && 'opacity-60',
      )}
    >
      {icon}
      <span className="font-semibold text-foreground tabular-nums">
        {count}
      </span>
      {label}
    </span>
  );
}
