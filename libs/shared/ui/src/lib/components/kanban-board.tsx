import { cn } from '@org/utils';
import { announceToScreenReader } from '../utils/a11y.js';
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
      const sourceCol = columns.find((c) => c.id === dragSourceColId);
      const destCol = columns.find((c) => c.id === destColId);
      const card = sourceCol?.cards.find((c) => c.id === draggedCardId);
      onCardMove?.(draggedCardId, dragSourceColId, destColId, 0);
      if (card && destCol) {
        announceToScreenReader(`Moved ${card.title} to ${destCol.title}`);
      }
    }
    setDraggedCardId(null);
    setDragSourceColId(null);
  };

  const handleCardKeyDown = (card: KanbanCardItem, colIndex: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (!e.altKey && !e.metaKey) {
        e.preventDefault();
        onCardClick?.(card);
      }
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = columns[colIndex + 1];
      if (nextCol && onCardMove) {
        onCardMove(card.id, columns[colIndex].id, nextCol.id, 0);
        announceToScreenReader(`Moved ${card.title} to ${nextCol.title}`);
      }
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = columns[colIndex - 1];
      if (prevCol && onCardMove) {
        onCardMove(card.id, columns[colIndex].id, prevCol.id, 0);
        announceToScreenReader(`Moved ${card.title} to ${prevCol.title}`);
      }
    }
  };

  return (
    <div
      role="region"
      aria-label="Kanban board"
      className={cn('flex gap-4 overflow-x-auto pb-4 scrollbar-subtle', className)}
    >
      {columns.map((column, colIdx) => (
        <section
          key={column.id}
          aria-label={`${column.title} column, ${column.cards.length} tasks`}
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
                  aria-hidden="true"
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
                  aria-label={`Add task to ${column.title}`}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          {/* Cards List */}
          {column.cards.length > 0 ? (
            <div
              role="list"
              aria-label={`${column.title} tasks`}
              className="flex flex-col gap-2.5 overflow-y-auto pt-3 flex-1 scrollbar-subtle"
            >
              {column.cards.map((card) => {
                const isDragging = draggedCardId === card.id;

                return (
                  <div key={card.id} role="listitem" className="list-none">
                    <div
                      draggable
                      tabIndex={0}
                      role="button"
                      aria-label={`${card.title}${card.priority ? `, priority: ${card.priority}` : ''}. Press Enter to view, Alt plus Left or Right arrow to move.`}
                      onKeyDown={handleCardKeyDown(card, colIdx)}
                      onDragStart={handleDragStart(card.id, column.id)}
                      onClick={() => onCardClick?.(card)}
                      className={cn(
                        'group relative flex flex-col gap-2 rounded-btn border border-border bg-surface p-3 text-xs shadow-xs cursor-grab active:cursor-grabbing outline-none',
                        'transition-all duration-(--duration-fast) hover:border-border-strong hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary',
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 overflow-y-auto pt-3 flex-1 scrollbar-subtle">
              <div className="flex h-24 items-center justify-center rounded-btn border border-dashed border-border text-[11px] text-subtle select-none">
                Drop items here
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
