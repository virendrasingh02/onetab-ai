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
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  DEFAULT_NAV_GROUPS,
  DEFAULT_NAV_ITEMS,
  type NavGroupId,
  type NavItemConfig,
} from './navigation.config.js';
import { useSidebarStore } from './sidebar-store.js';

interface SortableRowProps {
  item: NavItemConfig;
  isVisible: boolean;
  onToggleVisible: (id: string, visible: boolean) => void;
}

function SortableNavItemRow({
  item,
  isVisible,
  onToggleVisible,
}: SortableRowProps) {
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
        'group/custom-row relative flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs transition-all duration-150',
        isDragging && 'z-50 shadow-elevated opacity-80 border-primary ring-1 ring-primary/40 bg-surface-raised',
        !isVisible && 'opacity-55 bg-surface-muted',
      )}
    >
      <div className="gap-2.5 flex items-center min-w-0 flex-1">
        {/* Drag handle */}
        <button
          type="button"
          aria-label={`Drag to reorder ${item.label}`}
          className="size-6 flex cursor-grab active:cursor-grabbing items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="size-6 rounded-lg bg-surface-raised border border-border/70 flex items-center justify-center shrink-0">
          <Icon className="size-3.5 text-foreground" />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground truncate">
              {item.label}
            </span>
            {isCore && (
              <Badge variant="neutral" className="h-4 px-1 text-[9px] font-medium uppercase">
                Core
              </Badge>
            )}
          </div>
          {item.description && (
            <span className="text-[11px] text-muted-foreground truncate">
              {item.description}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-2">
        <Hint label={isVisible ? 'Hide from sidebar' : 'Show in sidebar'}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleVisible(item.id, !isVisible)}
              className={cn(
                'size-7 flex items-center justify-center rounded-md transition-colors',
                isVisible
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:bg-accent',
              )}
              aria-label={isVisible ? `Hide ${item.label}` : `Show ${item.label}`}
            >
              {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
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

export function SidebarCustomizerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<NavGroupId | 'all'>('all');
  const dndContextId = useId();

  const itemsPrefs = useSidebarStore((s) => s.items);
  const setItemVisibility = useSidebarStore((s) => s.setItemVisibility);
  const reorderItems = useSidebarStore((s) => s.reorderItems);
  const resetToDefaultOrder = useSidebarStore((s) => s.resetToDefaultOrder);
  const resetAllVisibility = useSidebarStore((s) => s.resetAllVisibility);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Compute ordered items
  const sortedItems = useMemo(() => {
    const list = [...DEFAULT_NAV_ITEMS];
    list.sort((a, b) => {
      const orderA = itemsPrefs[a.id]?.order ?? DEFAULT_NAV_ITEMS.findIndex((i) => i.id === a.id);
      const orderB = itemsPrefs[b.id]?.order ?? DEFAULT_NAV_ITEMS.findIndex((i) => i.id === b.id);
      return orderA - orderB;
    });
    return list;
  }, [itemsPrefs]);

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const matchesGroup = selectedGroup === 'all' || item.group === selectedGroup;
      if (!matchesGroup) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [sortedItems, selectedGroup, searchQuery]);

  const itemIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
    const newIndex = sortedItems.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newArray = arrayMove(sortedItems, oldIndex, newIndex);
      reorderItems(newArray.map((i) => i.id));
    }
  };

  const visibleCount = useMemo(() => {
    return DEFAULT_NAV_ITEMS.filter((item) => itemsPrefs[item.id]?.visible !== false).length;
  }, [itemsPrefs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden" hideCloseButton={false}>
        <DialogHeader className="p-5 pb-3 border-b border-border bg-surface-muted">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Customize Sidebar Navigation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Show, hide, or drag navigation items to customize your workspace layout ({visibleCount} of {DEFAULT_NAV_ITEMS.length} visible).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search & Filter Toolbar */}
        <div className="p-3 border-b border-border bg-surface flex flex-col gap-2">
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search navigation items or keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-lg border border-border bg-surface-raised text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Group pill filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                selectedGroup === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-surface-raised text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              All Items ({sortedItems.length})
            </button>
            {DEFAULT_NAV_GROUPS.map((g) => {
              const count = sortedItems.filter((i) => i.group === g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroup(g.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors',
                    selectedGroup === g.id
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-surface-raised text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  {g.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Sortable List */}
        <ScrollArea className="max-h-[380px] p-3" contentClassName="space-y-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No navigation items matching “{searchQuery}”
            </div>
          ) : (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {filteredItems.map((item) => {
                    const isVisible = itemsPrefs[item.id]?.visible !== false;
                    return (
                      <SortableNavItemRow
                        key={item.id}
                        item={item}
                        isVisible={isVisible}
                        onToggleVisible={setItemVisibility}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="p-3 bg-surface-muted border-t border-border flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaultOrder}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Reset Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAllVisibility}
              className="text-xs gap-1.5"
            >
              <Eye className="size-3.5" />
              Show All
            </Button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Done Customizing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
