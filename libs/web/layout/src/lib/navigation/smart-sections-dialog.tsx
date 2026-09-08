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
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  GripVertical,
  Hash,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createSectionId,
  defaultRuleFor,
  describeRule,
  SMART_RULES,
  type SidebarSectionDef,
  type SmartRule,
  type SmartRuleType,
} from './sidebar-sections.js';
import { useSidebarStore } from './sidebar-store.js';

export interface SmartSectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

function SortableSectionRow({
  def,
  onRename,
  onRemove,
}: {
  def: SidebarSectionDef;
  onRename: (label: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: def.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group/row flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2',
        isDragging && 'z-50 opacity-80 border-primary ring-1 ring-primary/40',
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${def.label}`}
        className="size-6 flex cursor-grab active:cursor-grabbing items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span className="shrink-0">
        {def.kind === 'smart' ? (
          <Sparkles className="size-3.5 text-accent-violet" />
        ) : (
          <Hash className="size-3.5 text-muted-foreground" />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <Input
          value={def.label}
          onChange={(e) => onRename(e.target.value)}
          aria-label={`Section name for ${def.label}`}
          className="h-7 border-transparent bg-transparent px-1 text-xs font-medium focus:border-border focus:bg-surface-muted"
        />
        <span className="px-1 text-[11px] text-muted-foreground">
          {def.kind === 'smart' && def.rule
            ? describeRule(def.rule)
            : `${def.channelIds?.length ?? 0} channel${
                (def.channelIds?.length ?? 0) === 1 ? '' : 's'
              } · add from a channel's menu`}
        </span>
      </div>

      <Badge
        variant="neutral"
        className="h-4 shrink-0 px-1 text-[9px] font-medium uppercase"
      >
        {def.kind}
      </Badge>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${def.label}`}
        onClick={onRemove}
        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function SmartSectionsDialog({
  open,
  onOpenChange,
  workspaceId,
}: SmartSectionsDialogProps) {
  const defs = useSidebarStore((s) => s.sectionDefs[workspaceId]);
  const addSectionDef = useSidebarStore((s) => s.addSectionDef);
  const updateSectionDef = useSidebarStore((s) => s.updateSectionDef);
  const removeSectionDef = useSidebarStore((s) => s.removeSectionDef);
  const reorderSectionDefs = useSidebarStore((s) => s.reorderSectionDefs);
  const resetChannelOrganization = useSidebarStore(
    (s) => s.resetChannelOrganization,
  );

  const ordered = useMemo(
    () => [...(defs ?? [])].sort((a, b) => a.order - b.order),
    [defs],
  );

  const [draftKind, setDraftKind] = useState<'manual' | 'smart'>('smart');
  const [draftRule, setDraftRule] = useState<SmartRuleType>('unread');
  const [draftKeyword, setDraftKeyword] = useState('');
  const [draftLabel, setDraftLabel] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((d) => d.id === active.id);
    const newIndex = ordered.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderSectionDefs(
      workspaceId,
      arrayMove(ordered, oldIndex, newIndex).map((d) => d.id),
    );
  };

  const suggestedLabel = () => {
    if (draftLabel.trim()) return draftLabel.trim();
    if (draftKind === 'manual') return 'New section';
    if (draftRule === 'keyword' && draftKeyword.trim()) {
      return draftKeyword.trim();
    }
    return SMART_RULES.find((r) => r.type === draftRule)?.label ?? 'Smart';
  };

  const handleAdd = () => {
    let rule: SmartRule | undefined;
    if (draftKind === 'smart') {
      rule = defaultRuleFor(draftRule);
      if (rule.type === 'keyword') rule = { type: 'keyword', value: draftKeyword.trim() };
    }
    const def: SidebarSectionDef = {
      id: createSectionId(),
      label: suggestedLabel(),
      kind: draftKind,
      order: ordered.length,
      collapsed: false,
      hideWhenEmpty: draftKind === 'smart',
      ...(draftKind === 'manual' ? { channelIds: [] } : {}),
      ...(rule ? { rule } : {}),
    };
    addSectionDef(workspaceId, def);
    setDraftLabel('');
    setDraftKeyword('');
  };

  const addDisabled =
    draftKind === 'smart' &&
    draftRule === 'keyword' &&
    !draftKeyword.trim() &&
    !draftLabel.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-surface p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/80 px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 text-primary">
            <Wand2 className="size-5" />
            <DialogTitle className="text-base font-semibold text-foreground">
              Channel sections
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Group channels into your own sections, or let a rule keep a section
            up to date. Smart sections refresh on their own as activity changes.
            This only affects your sidebar in this workspace.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[42vh] flex-1 p-4">
          {ordered.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              No custom sections yet. Add one below.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ordered.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {ordered.map((def) => (
                    <SortableSectionRow
                      key={def.id}
                      def={def}
                      onRename={(label) =>
                        updateSectionDef(workspaceId, def.id, { label })
                      }
                      onRemove={() => removeSectionDef(workspaceId, def.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>

        {/* Add-section form */}
        <div className="space-y-2.5 border-t border-border bg-surface-muted/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
              {(['smart', 'manual'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDraftKind(kind)}
                  aria-pressed={draftKind === kind}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                    draftKind === kind
                      ? 'bg-background text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>
            <Input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder={
                draftKind === 'manual' ? 'Section name' : 'Section name (optional)'
              }
              className="h-8 flex-1 text-xs"
            />
          </div>

          {draftKind === 'smart' && (
            <div className="flex items-center gap-2">
              <Select
                value={draftRule}
                onValueChange={(v) => setDraftRule(v as SmartRuleType)}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SMART_RULES.map((rule) => (
                    <SelectItem
                      key={rule.type}
                      value={rule.type}
                      className="text-xs"
                    >
                      {rule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draftRule === 'keyword' && (
                <Input
                  value={draftKeyword}
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  placeholder="keyword"
                  className="h-8 w-32 text-xs"
                />
              )}
            </div>
          )}

          {draftKind === 'smart' && (
            <p className="px-0.5 text-[11px] text-muted-foreground">
              {SMART_RULES.find((r) => r.type === draftRule)?.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetChannelOrganization(workspaceId)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Reset all
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={addDisabled}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Add section
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
