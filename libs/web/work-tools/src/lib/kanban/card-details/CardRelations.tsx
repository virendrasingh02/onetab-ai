import type { RelationType } from '@org/types';
import { AppSelect } from '@org/ui';
import { cn } from '@org/utils';
import { Link2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
  KanbanTaskLinkPicker,
  type KanbanTaskLinkOption,
} from '../KanbanTaskLinkPicker.js';
import { StatusIcon } from '../kanban-icons.js';
import {
  isBlockingView,
  LINKABLE_RELATION_TYPES,
  relationVerb,
  type RelationView,
} from '../relation-meta.js';
import { Section, SectionAction } from './primitives.js';

export interface CardRelationsProps {
  cardId: string;
  relations: RelationView[];
  linkableTasks: KanbanTaskLinkOption[];
  canLink: boolean;
  canOpen: (taskId: string) => boolean;
  onOpen: (taskId: string) => void;
  onAdd: (target: KanbanTaskLinkOption, type: RelationType) => void;
  onRemove: (relationId: string) => void;
}

export function CardRelations({
  cardId,
  relations,
  linkableTasks,
  canLink,
  canOpen,
  onOpen,
  onAdd,
  onRemove,
}: CardRelationsProps) {
  const [type, setType] = useState<RelationType>('BLOCKS');

  if (relations.length === 0 && !canLink) return null;

  return (
    <Section
      title="Linked tasks"
      icon={Link2}
      summary={relations.length > 0 ? `${relations.length}` : undefined}
      action={
        canLink ? (
          <KanbanTaskLinkPicker
            options={linkableTasks}
            excludeIds={[cardId]}
            onSelect={(target) => onAdd(target, type)}
            placeholder="Search tasks to link..."
            emptyMessage="No other tasks in this project"
            header={
              <div className="mb-1">
                <AppSelect
                  size="sm"
                  value={type}
                  onValueChange={(value) => setType(value as RelationType)}
                  options={LINKABLE_RELATION_TYPES.map((option) => ({
                    value: option.type,
                    label: option.label,
                  }))}
                  aria-label="Relation type"
                />
              </div>
            }
            trigger={<SectionAction icon={Plus}>Link task</SectionAction>}
          />
        ) : null
      }
    >
      {relations.length > 0 ? (
        <div>
          {relations.map((view) => {
            const blocking = isBlockingView(view);
            const openable = canOpen(view.otherTask.id);
            return (
              <div
                key={view.id}
                className="group min-h-8 gap-2 px-1 flex items-center rounded-md transition-colors hover:bg-accent/40"
              >
                <span
                  className={cn(
                    'w-20 text-xs shrink-0 truncate',
                    blocking
                      ? 'font-medium text-accent-amber'
                      : 'text-muted-foreground',
                  )}
                >
                  {relationVerb(view.type, view.direction)}
                </span>
                <button
                  type="button"
                  disabled={!openable}
                  onClick={() => onOpen(view.otherTask.id)}
                  className="min-w-0 gap-2 text-sm flex flex-1 items-center text-left disabled:cursor-default"
                >
                  <StatusIcon
                    status={view.otherTask.status}
                    className="size-3.5 shrink-0"
                    showTooltip={false}
                  />
                  {view.otherTask.identifier ? (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {view.otherTask.identifier}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'truncate',
                      openable && 'group-hover:underline',
                    )}
                  >
                    {view.otherTask.title}
                  </span>
                </button>
                {canLink ? (
                  <button
                    type="button"
                    onClick={() => onRemove(view.id)}
                    aria-label={`Remove link to ${view.otherTask.title}`}
                    className="rounded p-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Section>
  );
}
