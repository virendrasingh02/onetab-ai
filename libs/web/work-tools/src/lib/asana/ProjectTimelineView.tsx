import { Button, ScrollArea, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRIORITY_META, todayISO } from '../kanban/card-meta.js';
import type { BoardState, KanbanCard } from '../kanban/types.js';

interface ProjectTimelineViewProps {
  board: BoardState;
  onSelectCard: (card: KanbanCard, listId: string) => void;
}

export function ProjectTimelineView({
  board,
  onSelectCard,
}: ProjectTimelineViewProps) {
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());

  // Generate 14 days around baseDate
  const days = useMemo(() => {
    const result: Date[] = [];
    const start = new Date(baseDate);
    start.setDate(start.getDate() - 3); // 3 days past, 10 days future

    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [baseDate]);

  const todayStr = todayISO();

  // All cards flattened across lists with list info
  const allCardsWithList = useMemo(() => {
    const items: Array<{
      card: KanbanCard;
      listId: string;
      listTitle: string;
    }> = [];
    board.lists.forEach((list) => {
      list.cards.forEach((card) => {
        items.push({ card, listId: list.id, listTitle: list.title });
      });
    });
    return items;
  }, [board.lists]);

  const handlePrevRange = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() - 7);
    setBaseDate(newDate);
  };

  const handleNextRange = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + 7);
    setBaseDate(newDate);
  };

  const handleToday = () => {
    setBaseDate(new Date());
  };

  return (
    <div className="gap-4 p-4 flex w-full flex-col text-foreground">
      {/* Timeline Nav Header */}
      <div className="pb-3 flex items-center justify-between border-b border-border/40">
        <div className="gap-2 flex items-center">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/30">
            <Button variant="ghost" size="icon-sm" onClick={handlePrevRange}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleNextRange}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-xs font-semibold ml-2">
            {days[0].toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}{' '}
            –{' '}
            {days[days.length - 1].toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="gap-4 text-xs flex items-center text-muted-foreground">
          <div className="gap-1.5 flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-green" />
            <span>Complete</span>
          </div>
          <div className="gap-1.5 flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
            <span>In Progress</span>
          </div>
          <div className="gap-1.5 flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-amber" />
            <span>Upcoming</span>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <ScrollArea className="w-full rounded-xl border border-border/60 bg-card/40 shadow-xs">
        <div className="min-w-[900px]">
          {/* Calendar Header Row */}
          <div className="text-xs font-medium py-2 grid grid-cols-15 border-b border-border/50 bg-muted/30">
            <div className="px-4 py-1 font-semibold col-span-3 text-muted-foreground">
              Tasks
            </div>
            {days.map((day) => {
              const dayIso = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, '0')}-${`${day.getDate()}`.padStart(2, '0')}`;
              const isToday = dayIso === todayStr;

              return (
                <div
                  key={dayIso}
                  className={cn(
                    'py-1 col-span-1 flex flex-col items-center justify-center border-l border-border/30 text-center',
                    isToday &&
                      'font-bold rounded-t-md bg-primary/10 text-primary',
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                  <span className="text-xs">{day.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Task Rows */}
          <div className="text-xs divide-y divide-border/30">
            {allCardsWithList.map(({ card, listId, listTitle }) => {
              const assignedMember = board.members.find((m) =>
                card.memberIds.includes(m.id),
              );
              const cardDueIso = card.dueDate;

              return (
                <div
                  key={card.id}
                  className="py-2 group grid grid-cols-15 items-center transition-colors hover:bg-muted/30"
                >
                  {/* Task Info Column */}
                  <div className="px-4 gap-2 col-span-3 flex items-center justify-between overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onSelectCard(card, listId)}
                      className={cn(
                        'font-medium truncate text-left text-foreground transition-colors hover:text-primary',
                        card.dueComplete &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {card.title}
                    </button>

                    <div className="gap-1.5 flex flex-shrink-0 items-center">
                      <span className="px-1.5 py-0.5 rounded border border-border/40 bg-muted text-[10px] text-muted-foreground">
                        {listTitle}
                      </span>
                      {assignedMember && (
                        <UserAvatar
                          name={assignedMember.name}
                          src={assignedMember.avatarUrl}
                          seed={assignedMember.id}
                          presence={assignedMember.presence}
                          statusEmoji={assignedMember.statusEmoji}
                          statusText={assignedMember.statusText}
                          size="xs"
                        />
                      )}
                    </div>
                  </div>

                  {/* Grid Date Cells */}
                  {days.map((day) => {
                    const dayIso = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, '0')}-${`${day.getDate()}`.padStart(2, '0')}`;
                    const isDueDay = cardDueIso === dayIso;
                    const isToday = dayIso === todayStr;

                    return (
                      <div
                        key={dayIso}
                        className={cn(
                          'h-9 px-1 relative col-span-1 flex items-center justify-center border-l border-border/30',
                          isToday && 'bg-primary/5',
                        )}
                      >
                        {isDueDay && (
                          <button
                            type="button"
                            onClick={() => onSelectCard(card, listId)}
                            className={cn(
                              'py-1.5 px-2 font-medium gap-1 flex w-full items-center justify-between truncate rounded-md text-left text-[11px] shadow-xs transition-transform hover:scale-105',
                              card.dueComplete
                                ? 'border border-accent-green/30 bg-accent-green-soft text-accent-green'
                                : listTitle.toLowerCase().includes('doing') ||
                                    listTitle.toLowerCase().includes('progress')
                                  ? 'border border-accent-blue/30 bg-accent-blue-soft text-accent-blue'
                                  : 'border border-accent-amber/30 bg-accent-amber-soft text-accent-amber',
                            )}
                            title={`${card.title} - Due ${dayIso}`}
                          >
                            <span className="truncate">{card.title}</span>
                            <span
                              className={cn(
                                'w-2 h-2 flex-shrink-0 rounded-full',
                                PRIORITY_META[card.priority]?.dot,
                              )}
                            />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {allCardsWithList.length === 0 && (
              <div className="py-12 text-xs text-center text-muted-foreground">
                No scheduled tasks found for this period.
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
