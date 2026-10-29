import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Hint,
  ScrollArea,
  SegmentedControl,
  Switch,
  useSidebarCustomizerStore,
  ResponsiveTabs,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bell,
  Bot,
  Circle,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  GripVertical,
  Hash,
  Layers,
  MessagesSquare,
  Navigation,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  UserCheck,
  Workflow,
  Zap,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  DEFAULT_NAV_GROUPS,
  DEFAULT_NAV_ITEMS,
  type NavGroupId,
  type NavItemConfig,
} from './navigation.config.js';
import {
  DEFAULT_SIDEBAR_SECTIONS,
  useSidebarStore,
  type SidebarActivityPreferences,
  type SidebarLayoutMode,
  type SidebarSectionConfig,
  type SidebarSectionId,
} from './sidebar-store.js';

const SECTION_ICONS: Record<SidebarSectionId, typeof Star> = {
  starred: Star,
  channels: Hash,
  dms: MessagesSquare,
  projects: FolderKanban,
  docs: FileText,
  coworkers: UserCheck,
  agents: Bot,
  apps: Zap,
  workflows: Workflow,
};

interface SortableNavItemRowProps {
  item: NavItemConfig;
  isVisible: boolean;
  onToggleVisible: (id: string, visible: boolean) => void;
}

function SortableNavItemRow({
  item,
  isVisible,
  onToggleVisible,
}: SortableNavItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = item.icon;
  const isCore = item.isCore;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/custom-row px-3 py-2 text-xs relative flex items-center justify-between rounded-xl border border-border bg-surface transition-all duration-150',
        isDragging &&
          'z-50 border-primary bg-surface-raised opacity-80 shadow-elevated ring-1 ring-primary/40',
        !isVisible && 'bg-surface-muted opacity-55',
      )}
    >
      <div className="gap-2.5 min-w-0 flex flex-1 items-center">
        {/* Drag handle */}
        <button
          type="button"
          aria-label={`Drag to reorder ${item.label}`}
          className="size-6 rounded flex cursor-grab items-center justify-center text-muted-foreground/60 hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="size-6 flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-raised">
          <Icon className="size-3.5 text-foreground" />
        </div>

        <div className="min-w-0 flex flex-1 flex-col">
          <div className="gap-1.5 flex items-center">
            <span className="font-semibold truncate text-foreground">
              {item.label}
            </span>
            {isCore && (
              <Badge
                variant="neutral"
                className="h-4 px-1 font-medium text-[9px] uppercase"
              >
                Core
              </Badge>
            )}
          </div>
          {item.description && (
            <span className="truncate text-[11px] text-muted-foreground">
              {item.description}
            </span>
          )}
        </div>
      </div>

      <div className="gap-3 ml-2 flex shrink-0 items-center">
        <Hint label={isVisible ? 'Hide from sidebar' : 'Show in sidebar'}>
          <div className="gap-1.5 flex items-center">
            <button
              type="button"
              onClick={() => onToggleVisible(item.id, !isVisible)}
              className={cn(
                'size-7 flex items-center justify-center rounded-md transition-colors',
                isVisible
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:bg-accent',
              )}
              aria-label={
                isVisible ? `Hide ${item.label}` : `Show ${item.label}`
              }
            >
              {isVisible ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </button>
            <Switch
              checked={isVisible}
              onCheckedChange={(checked) => onToggleVisible(item.id, checked)}
              aria-label={`Toggle visibility of ${item.label}`}
            />
          </div>
        </Hint>
      </div>
    </div>
  );
}

interface SortableSectionRowProps {
  section: SidebarSectionConfig;
  isVisible: boolean;
  onToggleVisible: (id: SidebarSectionId, visible: boolean) => void;
}

function SortableSectionRow({
  section,
  isVisible,
  onToggleVisible,
}: SortableSectionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = SECTION_ICONS[section.id] || Layers;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/custom-section px-3 py-2.5 text-xs relative flex items-center justify-between rounded-xl border border-border bg-surface transition-all duration-150',
        isDragging &&
          'z-50 border-primary bg-surface-raised opacity-80 shadow-elevated ring-1 ring-primary/40',
        !isVisible && 'bg-surface-muted opacity-55',
      )}
    >
      <div className="gap-2.5 min-w-0 flex flex-1 items-center">
        {/* Drag handle */}
        <button
          type="button"
          aria-label={`Drag to reorder section ${section.label}`}
          className="size-6 rounded flex cursor-grab items-center justify-center text-muted-foreground/60 hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="size-7 flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-raised">
          <Icon className="size-4 text-foreground" />
        </div>

        <div className="min-w-0 flex flex-1 flex-col">
          <span className="font-semibold truncate text-foreground">
            {section.label}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {section.description}
          </span>
        </div>
      </div>

      <div className="gap-3 ml-2 flex shrink-0 items-center">
        <Hint
          label={
            isVisible ? 'Hide section from sidebar' : 'Show section in sidebar'
          }
        >
          <div className="gap-1.5 flex items-center">
            <button
              type="button"
              onClick={() => onToggleVisible(section.id, !isVisible)}
              className={cn(
                'size-7 flex items-center justify-center rounded-md transition-colors',
                isVisible
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:bg-accent',
              )}
              aria-label={
                isVisible ? `Hide ${section.label}` : `Show ${section.label}`
              }
            >
              {isVisible ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </button>
            <Switch
              checked={isVisible}
              onCheckedChange={(checked) =>
                onToggleVisible(section.id, checked)
              }
              aria-label={`Toggle visibility of ${section.label}`}
            />
          </div>
        </Hint>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Indicators */

const INDICATOR_STYLES: ReadonlyArray<{
  value: SidebarActivityPreferences['style'];
  label: string;
  hint: string;
}> = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'Badge when a count is known, dot otherwise',
  },
  { value: 'dot', label: 'Dot', hint: 'Always a small unread dot' },
  { value: 'badge', label: 'Badge', hint: 'Always a numeric count' },
];

const INDICATOR_TOGGLES: ReadonlyArray<{
  key: keyof SidebarActivityPreferences;
  label: string;
  description: string;
  icon: typeof Bell;
}> = [
  {
    key: 'showCounts',
    label: 'Show unread counts',
    description: 'Numbers on badges. When off, badges become dots.',
    icon: Circle,
  },
  {
    key: 'showInMainSidebar',
    label: 'Main sidebar',
    description: 'Inbox, Threads, projects, docs, agents and other nav.',
    icon: Layers,
  },
  {
    key: 'showInWorkspaceSidebar',
    label: 'Workspace switcher',
    description: 'Activity in workspaces you are not currently viewing.',
    icon: FolderKanban,
  },
  {
    key: 'showForChannelsAndDms',
    label: 'Channels & direct messages',
    description: 'Unread and mention markers on conversation rows.',
    icon: MessagesSquare,
  },
  {
    key: 'showForNotifications',
    label: 'Notifications',
    description: 'The unread marker on the Inbox row.',
    icon: Bell,
  },
];

function IndicatorsPanel() {
  const prefs = useSidebarStore((s) => s.activityIndicators);
  const setActivityIndicator = useSidebarStore((s) => s.setActivityIndicator);

  const disabled = !prefs.enabled;

  return (
    <div className="space-y-4">
      {/* Master switch */}
      <div className="px-3 py-2.5 text-xs flex items-center justify-between rounded-xl border border-border bg-surface">
        <div className="gap-2.5 min-w-0 flex flex-1 items-center">
          <div className="size-7 flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-raised">
            <Bell className="size-4 text-foreground" />
          </div>
          <div className="min-w-0 flex flex-1 flex-col">
            <span className="font-semibold text-foreground">
              Show activity indicators
            </span>
            <span className="text-[11px] text-muted-foreground">
              Dots and badges for unread and new activity across every sidebar.
            </span>
          </div>
        </div>
        <Switch
          checked={prefs.enabled}
          onCheckedChange={(checked) =>
            setActivityIndicator('enabled', checked)
          }
          aria-label="Show activity indicators"
        />
      </div>

      {/* Style */}
      <div
        className={cn(
          'px-3 py-2.5 space-y-2 rounded-xl border border-border bg-surface transition-opacity',
          disabled && 'pointer-events-none opacity-55',
        )}
      >
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-foreground">
            Indicator style
          </span>
          <span className="text-[11px] text-muted-foreground">
            {INDICATOR_STYLES.find((s) => s.value === prefs.style)?.hint}
          </span>
        </div>
        <div className="gap-1 p-1 flex items-center rounded-lg border border-border bg-surface-raised">
          {INDICATOR_STYLES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActivityIndicator('style', option.value)}
              aria-pressed={prefs.style === option.value}
              className={cn(
                'px-2 py-1 font-medium flex-1 rounded-md text-[11px] transition-all',
                prefs.style === option.value
                  ? 'shadow-2xs font-semibold bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-surface toggles */}
      <div
        className={cn(
          'divide-y divide-border/50 overflow-hidden rounded-xl border border-border bg-surface transition-opacity',
          disabled && 'pointer-events-none opacity-55',
        )}
      >
        {INDICATOR_TOGGLES.map((row) => {
          const RowIcon = row.icon;
          const value = prefs[row.key] as boolean;
          return (
            <div
              key={row.key}
              className="gap-3 px-3 py-2.5 text-xs flex items-center justify-between transition-colors hover:bg-accent/40"
            >
              <div className="gap-2.5 min-w-0 flex flex-1 items-center">
                <RowIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex flex-1 flex-col">
                  <span className="font-medium text-foreground">
                    {row.label}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {row.description}
                  </span>
                </div>
              </div>
              <Switch
                checked={value}
                onCheckedChange={(checked) =>
                  setActivityIndicator(row.key, checked)
                }
                aria-label={row.label}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface SidebarCustomizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SidebarCustomizerDialog({
  open,
  onOpenChange,
}: SidebarCustomizerDialogProps) {
  const [activeTab, setActiveTab] = useState<
    'sections' | 'items' | 'indicators'
  >('sections');
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<NavGroupId | 'all'>('all');
  const dndContextId = useId();

  /*
   * Screens outside this feature (the settings "App sidebar" row) pop the
   * dialog open through `useSidebarCustomizerStore`, optionally naming a tab.
   * Apply and clear that request once per open.
   */
  const requestedTab = useSidebarCustomizerStore((s) => s.requestedTab);
  useEffect(() => {
    if (open && requestedTab) {
      setActiveTab(requestedTab);
      setSearch('');
      useSidebarCustomizerStore.setState({ requestedTab: undefined });
    }
  }, [open, requestedTab]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Store bindings
  const itemsPrefs = useSidebarStore((s) => s.items);
  const sectionsPrefs = useSidebarStore((s) => s.sections);
  const setItemVisibility = useSidebarStore((s) => s.setItemVisibility);
  const reorderItems = useSidebarStore((s) => s.reorderItems);
  const setSectionVisibility = useSidebarStore((s) => s.setSectionVisibility);
  const reorderSections = useSidebarStore((s) => s.reorderSections);
  const resetToDefaultOrder = useSidebarStore((s) => s.resetToDefaultOrder);
  const resetSections = useSidebarStore((s) => s.resetSections);
  const resetActivityIndicators = useSidebarStore(
    (s) => s.resetActivityIndicators,
  );
  const resetAllPreferences = useSidebarStore((s) => s.resetAllPreferences);
  const layoutMode = useSidebarStore((s) => s.layoutMode);
  const setLayoutMode = useSidebarStore((s) => s.setLayoutMode);

  // --- Ordered Sections ---
  const sortedSections = useMemo(() => {
    return [...DEFAULT_SIDEBAR_SECTIONS].sort((a, b) => {
      const orderA = sectionsPrefs[a.id]?.order ?? a.order;
      const orderB = sectionsPrefs[b.id]?.order ?? b.order;
      return orderA - orderB;
    });
  }, [sectionsPrefs]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sortedSections;
    const term = search.toLowerCase();
    return sortedSections.filter(
      (sec) =>
        sec.label.toLowerCase().includes(term) ||
        sec.description.toLowerCase().includes(term),
    );
  }, [sortedSections, search]);

  // --- Ordered Items ---
  const sortedItems = useMemo(() => {
    return [...DEFAULT_NAV_ITEMS].sort((a, b) => {
      const orderA = itemsPrefs[a.id]?.order ?? a.order;
      const orderB = itemsPrefs[b.id]?.order ?? b.order;
      return orderA - orderB;
    });
  }, [itemsPrefs]);

  const filteredItems = useMemo(() => {
    let list = sortedItems;
    if (activeGroup !== 'all') {
      list = list.filter((item) => item.group === activeGroup);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.keywords?.some((k) => k.toLowerCase().includes(term)),
      );
    }
    return list;
  }, [sortedItems, activeGroup, search]);

  const handleDragEndItems = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
    const newIndex = sortedItems.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(sortedItems, oldIndex, newIndex);
      reorderItems(reordered.map((i) => i.id));
    }
  };

  const handleDragEndSections = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSections.findIndex((sec) => sec.id === active.id);
    const newIndex = sortedSections.findIndex((sec) => sec.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(sortedSections, oldIndex, newIndex);
      reorderSections(reordered.map((s) => s.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 shadow-2xl flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/80">
          <div className="gap-2 flex items-center text-primary">
            <SlidersHorizontal className="size-5" />
            <DialogTitle className="text-base font-semibold text-foreground">
              Customize Sidebar
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Reorder sections and navigation links, toggle their visibility, and
            control the unread dots and badges across every sidebar.
          </DialogDescription>

          {/* Segmented Tab Switcher */}
          <div className="mt-3 min-w-0">
            <ResponsiveTabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as 'sections' | 'items' | 'indicators');
                setSearch('');
              }}
              variant="segmented"
              size="sm"
              fullWidth
              items={[
                {
                  value: 'sections',
                  label: 'Sections',
                  icon: <Layers className="size-3.5" />,
                },
                {
                  value: 'items',
                  label: 'Navigation',
                  icon: <Navigation className="size-3.5" />,
                },
                {
                  value: 'indicators',
                  label: 'Activity Indicators',
                  icon: <Bell className="size-3.5" />,
                },
              ]}
            />
          </div>

          {/* Search bar — not used by the Indicators tab */}
          {activeTab !== 'indicators' && (
            <div className="mt-2 relative">
              <Search className="left-3 size-3.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'sections'
                    ? 'Search sections (e.g. Channels, DMs, Projects, Docs, AI Agents)...'
                    : 'Search navigation (e.g. Tasks, Docs, AI Chat)...'
                }
                className="pl-8.5 pr-3 py-1.5 text-xs w-full rounded-lg border border-border bg-surface-muted text-foreground transition-all outline-none placeholder:text-muted-foreground focus:border-primary/80 focus:ring-1 focus:ring-primary/40"
              />
            </div>
          )}

          {/* Filter Pills for Items Tab */}
          {activeTab === 'items' && !search && (
            <div className="gap-1.5 pt-2 flex scrollbar-none items-center overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveGroup('all')}
                className={cn(
                  'px-2.5 py-0.5 font-medium rounded-full text-[11px] transition-colors',
                  activeGroup === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-raised text-muted-foreground hover:text-foreground',
                )}
              >
                All
              </button>
              {DEFAULT_NAV_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroup(group.id)}
                  className={cn(
                    'px-2.5 py-0.5 font-medium rounded-full text-[11px] whitespace-nowrap transition-colors',
                    activeGroup === group.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-raised text-muted-foreground hover:text-foreground',
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Content list */}
        <ScrollArea className="p-4 max-h-[380px] min-h-[260px] flex-1">
          {activeTab === 'indicators' ? (
            <IndicatorsPanel />
          ) : activeTab === 'sections' ? (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndSections}
            >
              <SortableContext
                items={filteredSections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {!search ? (
                    <div className="gap-3 mb-3 p-3 flex flex-wrap items-center justify-between rounded-xl border border-border bg-surface-muted/50">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          Sidebar view
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Activity replaces Starred, Channels and DMs with one
                          newest-first list.
                        </p>
                      </div>
                      <SegmentedControl
                        aria-label="Sidebar view"
                        value={layoutMode}
                        onChange={(value) =>
                          setLayoutMode(value as SidebarLayoutMode)
                        }
                        options={[
                          { value: 'sections', label: 'Sections' },
                          { value: 'activity', label: 'Activity' },
                        ]}
                      />
                    </div>
                  ) : null}
                  {filteredSections.map((section) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      isVisible={sectionsPrefs[section.id]?.visible ?? true}
                      onToggleVisible={setSectionVisibility}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndItems}
            >
              <SortableContext
                items={filteredItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <SortableNavItemRow
                      key={item.id}
                      item={item}
                      isVisible={itemsPrefs[item.id]?.visible ?? item.visible}
                      onToggleVisible={setItemVisibility}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="px-6 py-3 sm:justify-between flex items-center justify-between border-t border-border bg-surface-muted">
          <div className="gap-2 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === 'sections') {
                  resetSections();
                } else if (activeTab === 'indicators') {
                  resetActivityIndicators();
                } else {
                  resetToDefaultOrder();
                }
              }}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              <span>
                Reset{' '}
                {activeTab === 'sections'
                  ? 'Sections'
                  : activeTab === 'indicators'
                    ? 'Indicators'
                    : 'Items Order'}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllPreferences}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Reset All
            </Button>
          </div>

          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
