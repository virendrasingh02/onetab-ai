import { Button, ScrollArea, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRIORITY_META, todayISO } from '../kanban/card-meta.js';
import type { BoardState, KanbanCard } from '../kanban/types.js';

interface ProjectTimelineViewProps {
  board: BoardState;
  onSelectCard: (card: KanbanCard, listId: string) => void;
  searchQuery?: string;
}

export function ProjectTimelineView({
  board,
  onSelectCard,
  searchQuery = '',
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
    const items: Array<{ card: KanbanCard; listId: string; listTitle: string }> = [];
    board.lists.forEach((list) => {
      list.cards.forEach((card) => {
        if (
          !searchQuery ||
          card.title.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          items.push({ card, listId: list.id, listTitle: list.title });
        }
      });
    });
    return items;
  }, [board.lists, searchQuery]);

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
    <div className="flex flex-col gap-4 p-4 w-full text-foreground">
      {/* Timeline Nav Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
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
            {days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {days[days.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-green" />
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-amber" />
            <span>Upcoming</span>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <ScrollArea className="w-full rounded-xl border border-border/60 bg-card/40 shadow-xs">
        <div className="min-w-[900px]">
          {/* Calendar Header Row */}
          <div className="grid grid-cols-15 border-b border-border/50 bg-muted/30 text-xs font-medium py-2">
            <div className="col-span-3 px-4 py-1 text-muted-foreground font-semibold">Tasks</div>
            {days.map((day) => {
              const dayIso = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, '0')}-${`${day.getDate()}`.padStart(2, '0')}`;
              const isToday = dayIso === todayStr;

              return (
                <div
                  key={dayIso}
                  className={cn(
                    'col-span-1 text-center py-1 flex flex-col items-center justify-center border-l border-border/30',
                    isToday && 'bg-primary/10 font-bold text-primary rounded-t-md'
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
          <div className="divide-y divide-border/30 text-xs">
            {allCardsWithList.map(({ card, listId, listTitle }) => {
              const assignedMember = board.members.find((m) => card.memberIds.includes(m.id));
              const cardDueIso = card.dueDate;

              return (
                <div
                  key={card.id}
                  className="grid grid-cols-15 items-center hover:bg-muted/30 transition-colors py-2 group"
                >
                  {/* Task Info Column */}
                  <div className="col-span-3 px-4 flex items-center justify-between gap-2 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onSelectCard(card, listId)}
                      className={cn(
                        'truncate text-left font-medium text-foreground hover:text-primary transition-colors',
                        card.dueComplete && 'line-through text-muted-foreground'
                      )}
                    >
                      {card.title}
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/40">
                        {listTitle}
                      </span>
                      {assignedMember && (
                        <UserAvatar name={assignedMember.name} src={assignedMember.avatarUrl} size="xs" />
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
                          'col-span-1 h-9 border-l border-border/30 flex items-center justify-center relative px-1',
                          isToday && 'bg-primary/5'
                        )}
                      >
                        {isDueDay && (
                          <button
                            type="button"
                            onClick={() => onSelectCard(card, listId)}
                            className={cn(
                              'w-full py-1.5 px-2 rounded-md shadow-xs text-[11px] font-medium truncate text-left transition-transform hover:scale-105 flex items-center justify-between gap-1',
                              card.dueComplete
                                ? 'bg-accent-green-soft text-accent-green border border-accent-green/30'
                                : listTitle.toLowerCase().includes('doing') || listTitle.toLowerCase().includes('progress')
                                ? 'bg-accent-blue-soft text-accent-blue border border-accent-blue/30'
                                : 'bg-accent-amber-soft text-accent-amber border border-accent-amber/30'
                            )}
                            title={`${card.title} - Due ${dayIso}`}
                          >
                            <span className="truncate">{card.title}</span>
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_META[card.priority]?.dot)} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {allCardsWithList.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No scheduled tasks found for this period.
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
