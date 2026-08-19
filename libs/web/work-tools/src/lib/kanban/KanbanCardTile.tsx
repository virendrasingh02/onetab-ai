import { TaskStatus } from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  CalendarPlus,
  CalendarX2,
  Copy,
  CornerUpRight,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { DragEvent } from 'react';
import { parseDay } from './card-meta.js';
import { useKanbanCustomStore } from './kanban-custom-store.js';
import {
  ActivityPulseBadge,
  CubeProjectIcon,
} from './kanban-icons.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
import type { BoardMember, KanbanCard, KanbanList } from './types.js';

export interface KanbanCardTileProps {
  card: KanbanCard;
  members: BoardMember[];
  lists: Array<Pick<KanbanList, 'id' | 'title'>>;
  listId: TaskStatus | string;
  /**
   * True once this card has been picked up. The tile collapses out of the
   * layout so the drop placeholder can take its place, exactly one card tall.
   */
  lifted: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onMoveToList: (toListId: TaskStatus) => void;
  onAssigneeChange?: (memberId: string | null) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

function formatCardDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = parseDay(dateStr);
  const day = date.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
      ? 'nd'
      : day === 3 || day === 23
      ? 'rd'
      : 'th';
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${day}${suffix}, ${year}`;
}

function formatMonthYear(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = parseDay(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function KanbanCardTile({
  card,
  members,
  lists,
  listId,
  lifted,
  onOpen,
  onCopy,
  onDelete,
  onMoveToList,
  onAssigneeChange,
  onDragStart,
  onDragEnd,
}: KanbanCardTileProps) {
  const customStore = useKanbanCustomStore();
  const cardCustomProps = customStore.getCardProperties(card.id);
  const storeLabels = customStore.labels;

  const formattedDate = formatCardDate(card.dueDate);
  const currentStatus = (listId as TaskStatus) || TaskStatus.TODO;
  const currentLeadId = cardCustomProps.leadId ?? card.memberIds[0];
  const currentLabels = cardCustomProps.labels ?? [];
  const currentStartDate = cardCustomProps.startDate;

  return (
    <li
      data-kanban-card={card.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group/card p-3 relative cursor-grab list-none rounded-xl border border-border/60 bg-card text-card-foreground',
        'shadow-xs transition-all duration-(--duration-fast)',
        'hover:border-border-strong hover:shadow-md hover:bg-surface-raised',
        'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
        lifted && 'hidden',
      )}
    >
      {/* Top Row: [Orange Cube] [Title]  ... [Pulse] [StatusIcon] [More] [Avatar] */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CubeProjectIcon className="size-4 shrink-0" />
          <button
            type="button"
            onClick={onOpen}
            className="text-xs font-semibold leading-snug text-left text-foreground truncate hover:text-primary transition-colors cursor-pointer outline-none"
          >
            {card.title}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Activity pulse badge */}
          <ActivityPulseBadge />

          {/* Status picker trigger */}
          <KanbanStatusPicker
            status={currentStatus}
            onStatusChange={onMoveToList}
            align="end"
          />

          {/* 3-dots more menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={`Actions for “${card.title}”`}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={onOpen}>
                <Pencil />
                Open card
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCopy}>
                <Copy />
                Copy card
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CornerUpRight />
                  Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-44">
                    {lists.map((list) => (
                      <DropdownMenuItem
                        key={list.id}
                        disabled={list.id === listId}
                        onSelect={() => onMoveToList(list.id as TaskStatus)}
                      >
                        {list.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                Delete card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignee lead picker */}
          <KanbanLeadPicker
            currentMemberId={currentLeadId}
            members={members}
            onSelectMember={(memberId) => {
              customStore.setCardProperties(card.id, { leadId: memberId || undefined });
              onAssigneeChange?.(memberId);
            }}
            align="end"
          />
        </div>
      </div>

      {/* Row 2: Dates (Start -> Target, or Single Target Date) */}
      {(currentStartDate || formattedDate) && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {currentStartDate ? (
            <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/80">
              <CalendarPlus className="size-3.5 text-muted-foreground shrink-0" />
              <span>{formatMonthYear(currentStartDate) || 'Start'}</span>
              <span className="text-muted-foreground text-[10px]">→</span>
              <CalendarX2 className="size-3.5 text-rose-500 shrink-0" />
              <span className="text-rose-500 font-medium">
                {formattedDate || 'Target'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
              <CalendarX2 className="size-3.5 text-rose-500 shrink-0" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      )}

      {/* Labels row if any */}
      {currentLabels.length > 0 && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {currentLabels.map((lbl) => {
            const meta = storeLabels.find((l) => l.name === lbl);
            return (
              <span
                key={lbl}
                className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] font-medium rounded-md border"
                style={{
                  backgroundColor: meta ? `${meta.color}15` : '#8b5cf615',
                  borderColor: meta ? `${meta.color}35` : '#8b5cf635',
                  color: meta?.color || '#8b5cf6',
                }}
              >
                <span
                  className="size-1 rounded-full"
                  style={{ backgroundColor: meta?.color || '#8b5cf6' }}
                />
                <span>{lbl}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Row 3: Ticket ID & Issues count */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/75 font-medium">
        <span>{card.commentCount} issues</span>
        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted/70 text-muted-foreground font-semibold">
          {cardCustomProps.ticketId}
        </span>
      </div>
    </li>
  );
}
