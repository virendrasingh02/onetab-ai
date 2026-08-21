import { cn } from '@org/utils';
import {
  Calendar,
  CheckCircle2,
  Plus,
  Tag,
} from 'lucide-react';
import {
  useState,
} from 'react';
import { Badge } from './badge.js';
import { Button } from './button.js';


export interface KanbanCardItem {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  assignee?: {
    name: string;
    avatarUrl?: string;
    initials?: string;
  };
  dueDate?: string;
  subtasksCompleted?: number;
  subtasksTotal?: number;
  metadata?: Record<string, any>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  accentColor?: string;
  cards: KanbanCardItem[];
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  onCardMove?: (cardId: string, sourceColId: string, destColId: string, destIndex: number) => void;
  onAddCard?: (columnId: string) => void;
  onCardClick?: (card: KanbanCardItem) => void;
  className?: string;
}

export function KanbanBoard({
  columns,
  onCardMove,
  onAddCard,
  onCardClick,
  className,
}: KanbanBoardProps) {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSourceColId, setDragSourceColId] = useState<string | null>(null);

  const priorityColors = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-info/10 text-info border-info/20',
    high: 'bg-warning/15 text-warning-text border-warning/30',
    urgent: 'bg-destructive/15 text-destructive-text border-destructive/30',
  };

  const handleDragStart = (cardId: string, colId: string) => (e: React.DragEvent) => {
    setDraggedCardId(cardId);
    setDragSourceColId(colId);
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (destColId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCardId || !dragSourceColId) return;
    if (dragSourceColId !== destColId) {
      onCardMove?.(draggedCardId, dragSourceColId, destColId, 0);
    }
    setDraggedCardId(null);
    setDragSourceColId(null);
  };

  return (
    <div className={cn('flex gap-4 overflow-x-auto pb-4 scrollbar-subtle', className)}>
      {columns.map((column) => (
        <div
          key={column.id}
          onDragOver={handleDragOver}
          onDrop={handleDrop(column.id)}
          className="flex flex-col w-72 shrink-0 rounded-card bg-surface-raised/60 border border-border p-3 max-h-[80vh]"
        >
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              {column.accentColor && (
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: column.accentColor }}
                />
              )}
              <h3 className="text-xs font-semibold text-foreground tracking-tight">
                {column.title}
              </h3>
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-mono">
                {column.cards.length}
              </Badge>
            </div>

            <div className="flex items-center gap-0.5">
              {onAddCard && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onAddCard(column.id)}
                  aria-label="Add task"
                >
                  <Plus className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Cards List */}
          <div className="flex flex-col gap-2.5 overflow-y-auto pt-3 flex-1 scrollbar-subtle">
            {column.cards.map((card) => {
              const isDragging = draggedCardId === card.id;

              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={handleDragStart(card.id, column.id)}
                  onClick={() => onCardClick?.(card)}
                  className={cn(
                    'group relative flex flex-col gap-2 rounded-btn border border-border bg-surface p-3 text-xs shadow-xs cursor-grab active:cursor-grabbing',
                    'transition-all duration-(--duration-fast) hover:border-border-strong hover:shadow-sm',
                    isDragging && 'opacity-40 border-dashed border-primary',
                  )}
                >
                  {/* Card Title & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground leading-snug line-clamp-2">
                      {card.title}
                    </span>
                    {card.priority && (
                      <span
                        className={cn(
                          'shrink-0 rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          priorityColors[card.priority],
                        )}
                      >
                        {card.priority}
                      </span>
                    )}
                  </div>

                  {/* Description snippet */}
                  {card.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {card.description}
                    </p>
                  )}

                  {/* Tags */}
                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-xs bg-accent/70 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
                        >
                          <Tag className="size-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer: Due date, Subtasks, Assignee */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-subtle">
                    <div className="flex items-center gap-2">
                      {card.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {card.dueDate}
                        </span>
                      )}
                      {card.subtasksTotal !== undefined && card.subtasksTotal > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          {card.subtasksCompleted ?? 0}/{card.subtasksTotal}
                        </span>
                      )}
                    </div>

                    {card.assignee && (
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        {card.assignee.avatarUrl ? (
                          <img
                            src={card.assignee.avatarUrl}
                            alt={card.assignee.name}
                            className="size-5 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                            {card.assignee.initials ?? card.assignee.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {column.cards.length === 0 && (
              <div className="flex h-24 items-center justify-center rounded-btn border border-dashed border-border text-[11px] text-subtle select-none">
                Drop items here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
