import { Badge, Button, Input, Kbd } from '@org/ui';
import { cn } from '@org/utils';
import {
  Cpu,
  Database,
  GitBranch,
  History,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shuffle,
  Sparkles,
  StickyNote,
  UserCheck,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import {
  appCardItem,
  connectorItemTitle,
  useConnectorAppGroups,
  type ConnectorAppGroup,
} from './connector-nodes.js';
import { CATALOG_NODES, stepUnsupportedReason, type CatalogNodeItem, type NodeCategory } from './node-library.js';

/** The picker's categories, in the order someone building an agent reaches for them. */
const CATEGORIES: Array<{ id: NodeCategory; label: string; hint: string; icon: LucideIcon; accent: string }> = [
  { id: 'all', label: 'All steps', hint: 'Everything you can add to this agent', icon: LayoutGrid, accent: 'var(--color-accent-indigo)' },
  { id: 'triggers', label: 'Triggers', hint: 'What starts the agent', icon: Zap, accent: 'var(--color-accent-green)' },
  { id: 'ai', label: 'AI & agents', hint: 'Agents and model calls that think, write and decide', icon: Sparkles, accent: 'var(--color-accent-violet)' },
  { id: 'connectors', label: 'Apps', hint: 'Read and act in Gmail, Slack, GitHub and your other apps', icon: Plug, accent: 'var(--color-accent-blue)' },
  { id: 'knowledge', label: 'Knowledge', hint: 'Search your docs and knowledge bases', icon: Database, accent: 'var(--color-accent-cyan)' },
  { id: 'logic', label: 'Logic & flow', hint: 'Branch, loop, wait and run steps in parallel', icon: GitBranch, accent: 'var(--color-accent-amber)' },
  { id: 'transform', label: 'Data', hint: 'Shape and store data between steps', icon: Shuffle, accent: 'var(--color-accent-teal)' },
  { id: 'tools', label: 'Tools & code', hint: 'HTTP, code, web scraping and database tools', icon: Wrench, accent: 'var(--color-accent-orange)' },
  { id: 'human', label: 'People', hint: 'Pause for a person to approve or answer', icon: UserCheck, accent: 'var(--color-accent-rose)' },
  { id: 'output', label: 'Outputs', hint: 'Reply, return a result or end the run', icon: Send, accent: 'var(--color-accent-indigo)' },
  { id: 'widgets', label: 'UI widgets', hint: 'Interactive UI the agent shows to people', icon: LayoutDashboard, accent: 'var(--color-accent-pink)' },
  { id: 'annotations', label: 'Notes', hint: 'Notes and groups for the canvas — they never run', icon: StickyNote, accent: 'var(--color-accent-amber)' },
];

const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<NodeCategory, (typeof CATEGORIES)[number]>;

/** Steps that make no sense in the middle of a flow. */
const NOT_INSERTABLE = new Set<NodeCategory>(['triggers', 'annotations']);

const isConnectorNode = (node: CatalogNodeItem) => node.type.startsWith('APP_CONNECTOR');
const isTriggerNode = (node: CatalogNodeItem) => node.category === 'triggers' || node.type.includes('TRIGGER');
const itemKey = (item: CatalogNodeItem) => item.key ?? item.type;

const RECENT_KEY = 'studio.stepPicker.recent';
const RECENT_MAX = 4;

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

function rememberRecent(key: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, 12)));
  } catch {
    // Recents are a convenience; private windows may block storage.
  }
}

/**
 * One line in the picker: a step to place, or an app. An app is one card with
 * all of its actions — which ones an agent may use, and which one a step runs,
 * are managed in the card's settings — not one entry per capability.
 */
type CatalogRow = {
  key: string;
  item: CatalogNodeItem;
  section: string;
  category: NodeCategory;
  /** Set when the run engine can't execute this step yet. */
  unsupported?: string;
} & ({ kind: 'node' } | { kind: 'app'; group: ConnectorAppGroup; matches: number });

function matchesQuery(q: string, ...fields: Array<string | undefined>) {
  return fields.some((f) => f?.toLowerCase().includes(q));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function appSummary(group: ConnectorAppGroup) {
  const parts: string[] = [];
  const actions = group.actions.length + group.reads.length;
  if (actions) parts.push(plural(actions, 'action'));
  if (group.triggers.length) parts.push(plural(group.triggers.length, 'trigger'));
  return parts.join(' · ');
}

interface NodeCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (item: CatalogNodeItem) => void;
  /** `insert` when the step goes between two others (edge split / handle drop): no triggers or notes. */
  mode?: 'add' | 'insert';
  /** Set when the step plugs into an agent slot: only what that slot accepts is offered. */
  slot?: { label: string; accepts: (type: string) => boolean };
}

export function NodeCatalogModal({ isOpen, onClose, onSelectNode, mode = 'add', slot }: NodeCatalogModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { groups, loading: appsLoading, error: appsError, retry: retryApps } = useConnectorAppGroups();
  const inserting = mode === 'insert' || !!slot;
  const fits = (item: CatalogNodeItem) => !slot || slot.accepts(item.type.toUpperCase());
  const q = search.trim().toLowerCase();


  /** Every row that matches the search, before the category filter (so the sidebar can count matches). */
  const allRows = useMemo<CatalogRow[]>(() => {
    const nodeRows: CatalogRow[] = CATALOG_NODES.filter(
      (node) =>
        (!inserting || (!NOT_INSERTABLE.has(node.category) && !isTriggerNode(node))) &&
        fits(node) &&
        (!q || matchesQuery(q, node.label, node.subtitle, node.description, node.type, CATEGORY[node.category]?.label)),
    ).map((item) => ({
      kind: 'node',
      key: itemKey(item),
      item,
      category: isConnectorNode(item) && !isTriggerNode(item) ? 'connectors' : item.category,
      section: CATEGORY[item.category]?.label ?? item.category,
      unsupported: stepUnsupportedReason(item.type),
    }));

    const appRows: CatalogRow[] = [];
    for (const group of groups) {
      const c = group.connector;
      const steps = [...group.actions, ...group.reads, ...(inserting ? [] : group.triggers)];
      if (steps.length === 0 || !fits(appCardItem(group))) continue;
      const appMatch = !q || matchesQuery(q, c.name, c.description, c.category, c.provider);
      const matches = q ? steps.filter((s) => matchesQuery(q, connectorItemTitle(s, c.name), s.description)).length : 0;
      if (!appMatch && matches === 0) continue;
      appRows.push({
        kind: 'app',
        key: `app:${c.provider}`,
        group,
        item: appCardItem(group),
        matches: appMatch ? 0 : matches,
        category: 'connectors',
        section: group.connected ? 'Your connected apps' : 'More apps — connect after adding',
      });
    }
    return [...nodeRows, ...appRows];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fits` only changes with `slot`
  }, [q, groups, inserting, slot]);

  const hiddenUnsupported = showUnsupported
    ? 0
    : allRows.filter((r) => r.unsupported && (selectedCategory === 'all' || r.category === selectedCategory)).length;
  const usableRows = useMemo(
    () => (showUnsupported ? allRows : allRows.filter((r) => !r.unsupported)),
    [allRows, showUnsupported],
  );

  const countFor = (id: NodeCategory) =>
    id === 'all' ? usableRows.length : usableRows.filter((r) => r.category === id).length;

  // A slot shows only the categories it has anything in.
  const slotCategories = useMemo(() => {
    if (!slot) return null;
    const ids = new Set<NodeCategory>(
      CATALOG_NODES.filter((n) => slot.accepts(n.type.toUpperCase())).map((n) =>
        isConnectorNode(n) && !isTriggerNode(n) ? 'connectors' : n.category,
      ),
    );
    if (slot.accepts('APP_CONNECTOR_ACTION')) ids.add('connectors');
    return ids;
  }, [slot]);
  const categories = useMemo(
    () =>
      CATEGORIES.filter(
        (c) => (!inserting || !NOT_INSERTABLE.has(c.id)) && (!slotCategories || c.id === 'all' || slotCategories.has(c.id)),
      ),
    [inserting, slotCategories],
  );

  const rows = useMemo<CatalogRow[]>(() => {
    if (selectedCategory !== 'all') {
      const inCategory = usableRows.filter((r) => r.category === selectedCategory);
      if (selectedCategory !== 'connectors') return inCategory;
      // Apps first (connected, then the rest), the any-app cards after them.
      return [
        ...inCategory.filter((r) => r.kind === 'app'),
        ...inCategory.filter((r) => r.kind === 'node').map((r) => ({ ...r, section: 'Any app — pick it after adding' })),
      ];
    }
    // Grouped by category; an app sits with the any-app cards under one Apps header.
    const ordered = categories.flatMap((c) =>
      usableRows
        .filter((r) => r.category === c.id)
        .sort((a, b) => Number(b.kind === 'app') - Number(a.kind === 'app'))
        .map((r) => ({ ...r, section: c.label })),
    );
    if (q || recent.length === 0) return ordered;
    const byKey = new Map(ordered.map((r) => [r.key, r]));
    const recentRows = recent
      .map((k) => byKey.get(k))
      .filter((r): r is CatalogRow => !!r)
      .slice(0, RECENT_MAX)
      .map((r) => ({ ...r, key: `recent:${r.key}`, section: 'Recently used' }));
    return [...recentRows, ...ordered];
  }, [usableRows, selectedCategory, categories, q, recent]);

  // Reset everything when the picker opens
  useEffect(() => {
    if (!isOpen) return undefined;
    setSearch('');
    setSelectedCategory('all');
    setFocusedIndex(0);
    setShowUnsupported(false);
    setRecent(readRecent());
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [search, selectedCategory, showUnsupported]);

  // Keep the active category visible (it can change via ←/→)
  useEffect(() => {
    containerRef.current
      ?.querySelectorAll<HTMLElement>(`[data-category-id="${selectedCategory}"]`)
      .forEach((el) => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }, [selectedCategory]);

  // Escape and click outside close the picker
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Keep the focused row scrolled into view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-catalog-idx="${focusedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  const place = (item: CatalogNodeItem, key = itemKey(item)) => {
    rememberRecent(key);
    onSelectNode(item);
    onClose();
  };
  const placeRow = (row: CatalogRow) => place(row.item, row.key.replace(/^recent:/, ''));

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = rows.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (count > 0 ? (prev + 1) % count : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (count > 0 ? (prev - 1 + count) % count : 0));
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !search) {
      // ←/→ switch category while the search box is empty, so the caret still moves when typing.
      e.preventDefault();
      const ids = categories.map((c) => c.id);
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setSelectedCategory((prev) => ids[(ids.indexOf(prev) + step + ids.length) % ids.length]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rows[focusedIndex]) placeRow(rows[focusedIndex]);
    }
  };

  const onDragStart = (event: React.DragEvent, row: CatalogRow) => {
    rememberRecent(row.key.replace(/^recent:/, ''));
    event.dataTransfer.setData('application/reactflow', JSON.stringify(row.item));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) return null;

  const active = CATEGORY[selectedCategory];
  const heading = slot ? `Add to ${slot.label}` : inserting ? 'Insert a step' : 'Add a step';
  const showHeaders = selectedCategory === 'all' || selectedCategory === 'connectors';
  const appsFit = !slot || slot.accepts('APP_CONNECTOR_ACTION');
  const showAppsStatus =
    appsFit && (selectedCategory === 'all' || selectedCategory === 'connectors') && (appsLoading || appsError || groups.length === 0);
  const matchesElsewhere = selectedCategory !== 'all' && rows.length === 0 ? countFor('all') : 0;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={heading}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="nowheel nodrag nopan absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[820px] max-w-[calc(100vw-32px)] max-h-[78vh] flex flex-col rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl text-foreground select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      {/* Header + search */}
      <div className="border-b border-border/80 px-4 pt-3.5 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
            <p className="text-xs text-muted-foreground">
              {slot
                ? `Only what fits the agent's ${slot.label} slot is shown.`
                : inserting
                  ? 'Pick what runs next in this flow.'
                  : 'Pick what the agent does next. Click to add it, or drag it onto the canvas.'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <Input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            selectedCategory === 'all' ? 'Search steps and apps — e.g. “email”, “if”, “http”' : `Search ${active.label.toLowerCase()}…`
          }
          aria-label="Search steps"
          aria-controls="step-picker-list"
          aria-activedescendant={rows[focusedIndex] ? `step-picker-row-${focusedIndex}` : undefined}
          inputSize="lg"
          leadingIcon={<Search className="size-4" />}
          trailingSlot={
            search ? (
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setSearch('')} aria-label="Clear search">
                <X className="size-3.5" />
              </Button>
            ) : undefined
          }
        />

        {/* Narrow screens: categories as a scrolling row */}
        <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              data-category-id={cat.id}
              type="button"
              variant={selectedCategory === cat.id ? 'primary' : 'subtle'}
              size="xs"
              aria-pressed={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="shrink-0 rounded-lg"
            >
              {cat.label}
              <span className="opacity-70 tabular-nums">{countFor(cat.id)}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 h-[54vh] flex-1">
        {/* Category sidebar */}
        <nav
          aria-label="Step categories"
          className="hidden sm:flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain border-r border-border/70 p-2 scrollbar-subtle"
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count = countFor(cat.id);
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                data-category-id={cat.id}
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  inputRef.current?.focus();
                }}
                style={{ '--cat': cat.accent } as React.CSSProperties}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                  isSelected
                    ? 'bg-(--cat)/12 text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-surface-raised/70 hover:text-foreground',
                  q && count === 0 && !isSelected && 'opacity-45',
                )}
              >
                <Icon className={cn('size-3.5 shrink-0', isSelected && 'text-(--cat)')} />
                <span className="flex-1 truncate">{cat.label}</span>
                {cat.id === 'connectors' && appsLoading ? (
                  <Loader2 className="size-3 animate-spin" aria-label="Loading apps" />
                ) : (
                  <span className="tabular-nums text-2xs opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Step list */}
        <div
          ref={listRef}
          id="step-picker-list"
          role="listbox"
          aria-label={active.label}
          className="nowheel nodrag nopan min-w-0 flex-1 overflow-y-auto overscroll-contain p-2 scrollbar-subtle"
        >
          {selectedCategory !== 'all' && !q && (
            <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">{active.hint}</p>
          )}

          {rows.length === 0 && !showAppsStatus ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="size-7 text-muted-foreground/30 mb-2" />
              <div className="text-sm font-medium text-foreground">
                {q ? `Nothing matches “${search.trim()}”` : 'Nothing here yet'}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {matchesElsewhere > 0
                  ? `${plural(matchesElsewhere, 'step')} in other categories match.`
                  : hiddenUnsupported > 0
                    ? 'Some steps that can’t run yet are hidden.'
                    : 'Try a different word, like “email”, “branch” or “approve”.'}
              </p>
              <div className="mt-3 flex gap-2">
                {matchesElsewhere > 0 && (
                  <Button type="button" size="xs" variant="outline" onClick={() => setSelectedCategory('all')}>
                    Search all steps
                  </Button>
                )}
                {q && (
                  <Button type="button" size="xs" variant="ghost" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {rows.map((row, idx) => {
                const isFocused = idx === focusedIndex;
                const showHeader = showHeaders && (idx === 0 || rows[idx - 1].section !== row.section);
                const accent = CATEGORY[row.category]?.accent ?? CATEGORY.all.accent;
                const app = row.kind === 'app' ? row.group.connector : null;
                const connectorId = row.kind === 'node' ? row.item.defaultConfig?.connectorId : undefined;
                const Icon = row.item.icon || Cpu;
                const title = app ? app.name : row.item.label;
                const description = row.unsupported
                  ? row.unsupported
                  : row.kind === 'app'
                    ? row.matches > 0
                      ? `${plural(row.matches, 'matching action')} · ${appSummary(row.group)}`
                      : row.group.connector.description || appSummary(row.group)
                    : row.item.description || row.item.subtitle;

                return (
                  <React.Fragment key={row.key}>
                    {showHeader && (
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground',
                          idx === 0 ? 'pt-1' : 'pt-3',
                        )}
                      >
                        {row.section === 'Recently used' && <History className="size-3" />}
                        {row.section}
                      </div>
                    )}
                    <div
                      id={`step-picker-row-${idx}`}
                      data-catalog-idx={idx}
                      role="option"
                      aria-selected={isFocused}
                      title={row.unsupported}
                      draggable
                      onDragStart={(e) => onDragStart(e, row)}
                      onClick={() => placeRow(row)}
                      onMouseMove={() => !isFocused && setFocusedIndex(idx)}
                      style={{ '--cat': accent } as React.CSSProperties}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer select-none text-left transition-colors',
                        isFocused ? 'bg-(--cat)/10' : 'hover:bg-surface-raised/60',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          app || connectorId
                            ? 'border border-border bg-surface-raised'
                            : 'bg-(--cat)/14 text-(--cat)',
                          row.unsupported && 'opacity-50',
                        )}
                      >
                        {app ? (
                          <AppConnectorIcon connectorId={app.slug} name={app.name} category={app.category} size={20} />
                        ) : connectorId ? (
                          <AppConnectorIcon connectorId={connectorId} size={20} />
                        ) : (
                          <Icon className="size-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('truncate text-sm font-medium leading-tight', row.unsupported && 'text-muted-foreground')}>
                            {title}
                          </span>
                          {row.unsupported ? (
                            <Badge variant="neutral">Can’t run yet</Badge>
                          ) : row.kind === 'app' ? (
                            row.group.connected ? (
                              <Badge variant="success">Connected</Badge>
                            ) : row.group.connector.status === 'needs_attention' ? (
                              <Badge variant="warning">Reconnect</Badge>
                            ) : null
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
                      </div>

                      {isFocused && row.kind === 'app' && !inserting && row.group.triggers.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          title={`Start the agent when something happens in ${row.group.connector.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            place(row.group.triggers[0], row.key);
                          }}
                          className="shrink-0 gap-1 text-muted-foreground"
                        >
                          <Zap className="size-3.5" />
                          Use as trigger
                        </Button>
                      )}
                      {isFocused && (
                        <span className="flex shrink-0 items-center gap-1 rounded-md bg-(--cat)/15 px-2 py-1 text-xs font-semibold text-(--cat)">
                          <Plus className="size-3.5" />
                          Add
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Apps load from the workspace's connectors; say what's going on with them. */}
          {showAppsStatus && (
            <div className="mx-2 mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
              {appsLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Loading your apps…
                </>
              ) : appsError ? (
                <>
                  <span className="flex-1">Couldn’t load your apps.</span>
                  <Button type="button" size="xs" variant="ghost" onClick={retryApps} className="gap-1">
                    <RefreshCw className="size-3" /> Retry
                  </Button>
                </>
              ) : (
                <span>No apps are set up for this workspace yet. Add them under Connectors.</span>
              )}
            </div>
          )}

          {(hiddenUnsupported > 0 || showUnsupported) && (
            <div className="px-2 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setShowUnsupported((v) => !v)}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {showUnsupported
                  ? 'Hide steps that can’t run yet'
                  : `Show ${plural(hiddenUnsupported, 'more step')} that can’t run yet`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer shortcut hints */}
      <div className="hidden sm:flex items-center justify-end gap-3 border-t border-border/70 px-4 py-2 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd size="xs">↑</Kbd>
          <Kbd size="xs">↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd size="xs">←</Kbd>
          <Kbd size="xs">→</Kbd> category
        </span>
        <span className="flex items-center gap-1">
          <Kbd size="xs">↵</Kbd> add
        </span>
        <span className="flex items-center gap-1">
          <Kbd size="xs">Esc</Kbd> close
        </span>
      </div>
    </div>
  );
}
