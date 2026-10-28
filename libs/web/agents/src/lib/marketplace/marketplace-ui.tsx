import type { Accent } from '@org/design-system';
import type { MarketplaceListing } from '@org/types';
import {
  accentClasses,
  AI_ENTITY_COLORS,
  Badge,
  getAiEntityPresetIcon,
  parseAiEntityAvatar,
  Button,
  ResponsiveTabsList,
  Tabs,
  UserAvatar,
  type TabItem,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  Brain,
  Building2,
  Check,
  Clock,
  Code2,
  Globe,
  Layers,
  Lock,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useState, type ReactNode } from 'react';

/*
 * The marketplace's shared vocabulary. Every list, card and detail page draws
 * its icon tile, kind/verified/status chips, install button and filter strip
 * from here, so a status never looks one way on a card and another on a page.
 * Colour comes from the design tokens (`Badge` variants, `accentClasses`) —
 * never a raw palette class.
 */

/* ------------------------------------------------------------ entity icon ---- */

const PRESET_GLYPHS: Record<string, { icon: LucideIcon; accent: Accent }> = {
  bot: { icon: Bot, accent: 'violet' },
  brain: { icon: Brain, accent: 'pink' },
  code: { icon: Code2, accent: 'blue' },
  spark: { icon: Sparkles, accent: 'amber' },
  shield: { icon: Shield, accent: 'green' },
  search: { icon: Search, accent: 'cyan' },
  chat: { icon: MessageSquare, accent: 'indigo' },
  rocket: { icon: Rocket, accent: 'rose' },
  globe: { icon: Globe, accent: 'teal' },
  layers: { icon: Layers, accent: 'orange' },
};

const TILE =
  'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xs';

export interface EntityIconProps {
  /** `icon:<preset>`, an image URL, or nothing (falls back to the kind's glyph). */
  iconUrl?: string | null;
  kind?: string;
  className?: string;
}

/**
 * The tile every listing, installation and workspace item wears. A remote icon
 * that fails to load falls back to the kind's glyph rather than an empty tile.
 */
export function EntityIcon({ iconUrl, kind, className = 'size-10' }: EntityIconProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [iconUrl]);

  if (iconUrl?.startsWith('icon:')) {
    // Same icon catalogue as every agent/coworker avatar; a chosen colour wins over the preset accent.
    const parsed = parseAiEntityAvatar(iconUrl);
    const Glyph = getAiEntityPresetIcon(iconUrl);
    if (parsed.type === 'icon' && Glyph) {
      const accent = PRESET_GLYPHS[parsed.icon === 'sparkles' ? 'spark' : parsed.icon]?.accent;
      const tone = parsed.color ? AI_ENTITY_COLORS.find((c) => c.id === parsed.color)?.tone : undefined;
      return (
        <div className={cn(TILE, tone, className)}>
          <Glyph className={cn('size-5', !tone && (accent ? accentClasses[accent].text : 'text-primary-text'))} aria-hidden />
        </div>
      );
    }
  } else if (
    iconUrl &&
    !failed &&
    (iconUrl.startsWith('http') ||
      iconUrl.startsWith('/') ||
      iconUrl.startsWith('data:image'))
  ) {
    return (
      <div className={cn(TILE, 'p-1.5', className)}>
        <img
          src={iconUrl}
          alt=""
          className="size-full rounded-lg object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn(TILE, className)}>
      {kind === 'AGENT' ? (
        <Bot className="size-5 text-primary-text" aria-hidden />
      ) : (
        <Zap className="size-5 text-accent-amber" aria-hidden />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- badges ---- */

/** "AI Agent" or "App" — the one chip that says what a listing is. */
export function KindBadge({
  kind,
  long = false,
}: {
  kind?: string;
  /** Spelled-out wording for page headers ("Autonomous AI Agent"). */
  long?: boolean;
}) {
  const isAgent = kind === 'AGENT';
  return (
    <Badge variant={isAgent ? 'primary' : 'info'}>
      {isAgent && long ? <Bot aria-hidden /> : null}
      {isAgent ? (long ? 'Autonomous AI Agent' : 'AI Agent') : 'App'}
    </Badge>
  );
}

/** Official / verified-publisher marker. Renders nothing for other badges. */
export function VerifiedBadge({
  badge,
  label,
}: {
  badge?: string | null;
  /** Visible text. Omit for the compact icon-only mark used on cards. */
  label?: string;
}) {
  if (badge !== 'OFFICIAL' && badge !== 'VERIFIED') return null;
  const official = badge === 'OFFICIAL';
  const title = official ? 'Official verified integration' : 'Verified publisher';

  if (!label) {
    return (
      <span title={title} className="inline-flex shrink-0">
        <ShieldCheck
          className={cn(
            'size-3.5',
            official ? 'text-primary-text' : 'text-success-text',
          )}
          aria-label={title}
        />
      </span>
    );
  }
  return (
    <Badge variant={official ? 'primary' : 'success'}>
      <ShieldCheck aria-hidden />
      {label}
    </Badge>
  );
}

/**
 * Where a listing came from, when that matters: shared only inside its own
 * workspace, or built and published from AI Agent Studio. Renders nothing for
 * ordinary public listings.
 */
export function OriginBadge({
  listing,
}: {
  listing: Pick<MarketplaceListing, 'visibility' | 'source'>;
}) {
  if (listing.visibility === 'WORKSPACE') {
    return (
      <Badge variant="neutral" title="Only members of this workspace can see it">
        <Lock aria-hidden />
        Workspace only
      </Badge>
    );
  }
  if (listing.source === 'studio') {
    return (
      <Badge variant="neutral" title="Built and published in AI Agent Studio">
        <Sparkles aria-hidden />
        Built in Studio
      </Badge>
    );
  }
  return null;
}

/** Running / paused. Always the same two looks, wherever an item lists. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'neutral'}>
      {active ? 'Active' : 'Paused'}
    </Badge>
  );
}

/* ---------------------------------------------------------- action button ---- */

export interface ListingActionState {
  installed?: boolean;
  pending?: boolean;
  requiresAdmin?: boolean;
}

export function listingActionState(
  listing: Pick<MarketplaceListing, 'installed' | 'approvalStatus' | 'requiresAdmin'>,
): ListingActionState {
  return {
    installed: Boolean(listing.installed),
    pending: listing.approvalStatus === 'PENDING',
    requiresAdmin: Boolean(listing.requiresAdmin),
  };
}

export interface ListingActionButtonProps extends ListingActionState {
  onInstall?: () => void;
  onRequestAccess?: () => void;
  onConfigure?: () => void;
  size?: 'xs' | 'sm';
  /** Wording for the not-installed action ("Install", "Install App"…). */
  installLabel?: string;
  installedLabel?: string;
  requestLabel?: string;
  pendingLabel?: string;
}

/**
 * Install / Request / Pending / Installed — the single decision every listing
 * surface makes. Cards, compact rows and both detail pages render this, so the
 * states and their colours cannot drift apart.
 */
export function ListingActionButton({
  installed,
  pending,
  requiresAdmin,
  onInstall,
  onRequestAccess,
  onConfigure,
  size = 'xs',
  installLabel = 'Install',
  installedLabel = 'Installed',
  requestLabel = 'Request',
  pendingLabel = 'Pending admin',
}: ListingActionButtonProps): ReactNode {
  if (installed) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={onConfigure}
        className="border-success/30 text-success-text hover:border-success/40 hover:bg-success/10"
      >
        <Check aria-hidden />
        {installedLabel}
      </Button>
    );
  }
  if (pending) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className="border-warning/30 text-warning-text"
      >
        <Clock className="animate-pulse" aria-hidden />
        {pendingLabel}
      </Button>
    );
  }
  if (requiresAdmin) {
    return (
      <Button
        variant={size === 'sm' ? 'primary' : 'outline'}
        size={size}
        onClick={onRequestAccess ?? onInstall}
      >
        <Lock aria-hidden />
        {requestLabel}
      </Button>
    );
  }
  return (
    <Button variant="primary" size={size} onClick={onInstall}>
      {installLabel}
    </Button>
  );
}

/* ------------------------------------------------------------------ grid ---- */

export const MARKETPLACE_GRID_CLASS =
  'gap-4 grid auto-rows-fr grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]';

/**
 * The one card grid every marketplace tab lays out on: columns fill the width
 * at a readable card size (one on phones, up to four on wide screens), and
 * every card in a row stretches to the tallest so footers line up.
 */
export function MarketplaceGrid({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(MARKETPLACE_GRID_CLASS, className)}
      {...props}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- owner ---- */

/**
 * Who answers for a listing: the workspace member who built or installed it,
 * else its publisher. Cards and compact rows use the same line.
 */
export function ListingOwnerLine({
  listing,
  className,
}: {
  listing: Pick<MarketplaceListing, 'owner' | 'publisher' | 'publisherName' | 'badge'>;
  className?: string;
}) {
  const owner = listing.owner;
  if (owner) {
    const verb = owner.relation === 'BUILT' ? 'Built by' : 'Added by';
    return (
      <span
        className={cn('min-w-0 gap-1.5 text-xs flex items-center text-muted-foreground', className)}
        title={`${verb} ${owner.name}`}
      >
        <UserAvatar name={owner.name} src={owner.avatarUrl ?? undefined} seed={owner.id} size="xs" indicator={false} />
        <span className="truncate">
          {verb} <span className="font-medium text-foreground">{owner.name}</span>
        </span>
      </span>
    );
  }
  const publisher = listing.publisher?.name || listing.publisherName || 'Onetab AI';
  return (
    <span
      className={cn('min-w-0 gap-1.5 text-xs flex items-center text-muted-foreground', className)}
      title={`Published by ${publisher}`}
    >
      <span className="size-5 flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised">
        <Building2 className="size-3" aria-hidden />
      </span>
      <span className="truncate">
        By <span className="font-medium text-foreground">{publisher}</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------- tab strip ---- */

export interface SectionTabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  items: (Omit<TabItem, 'value'> & { value: T })[];
  'aria-label': string;
  /** `pill` filters a list in place; `underline` switches a page's sections. */
  variant?: 'pill' | 'underline';
  className?: string;
}

/**
 * The marketplace's one in-view tab strip, on the shared `Tabs`. Filters
 * (installed state, item type, category) and detail-page sections both use it,
 * so they get the same overflow-to-"More" behaviour and keyboard support.
 */
export function SectionTabs<T extends string>({
  value,
  onValueChange,
  items,
  'aria-label': ariaLabel,
  variant = 'pill',
  className,
}: SectionTabsProps<T>) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as T)}>
      <ResponsiveTabsList
        variant={variant}
        size="sm"
        items={items}
        aria-label={ariaLabel}
        className={cn('min-w-0', className)}
      />
    </Tabs>
  );
}
