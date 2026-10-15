import type { ReactNode } from 'react';
import { Badge } from '@org/ui';
import { cn } from '@org/utils';

export type EntityBadgeKind = 'agent' | 'coworker' | 'app' | 'doc' | 'task' | 'kanban';

const KIND_LABEL: Record<EntityBadgeKind, string> = {
  agent: 'AI Agent',
  coworker: 'AI Coworker',
  app: 'App',
  doc: 'Doc',
  task: 'Task',
  kanban: 'Kanban',
};

const KIND_CLASS: Record<EntityBadgeKind, string> = {
  agent: '',
  coworker: 'border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300',
  app: 'border-accent-violet/20 bg-accent-violet-soft text-accent-violet',
  doc: 'border-info/30 bg-info/15 text-info-text',
  task: 'border-success/30 bg-success/15 text-success',
  kanban: 'border-warning/30 bg-warning/15 text-warning-text',
};

/**
 * The one type indicator used next to every non-human sender, mention option,
 * welcome header and card in chat, so the same entity always reads the same.
 */
export function EntityKindBadge({
  kind,
  size = 'md',
  icon,
  label,
  className,
}: {
  kind: EntityBadgeKind;
  /** `sm` is for dense rows (mention menu). */
  size?: 'md' | 'sm';
  icon?: ReactNode;
  /** Overrides the default text (e.g. an app's category). */
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant={kind === 'agent' ? 'primary' : 'neutral'}
      className={cn(
        'gap-1 py-0 font-bold tracking-wider text-2xs uppercase',
        size === 'sm' ? 'h-4' : 'h-[18px]',
        KIND_CLASS[kind],
        className,
      )}
    >
      {icon}
      <span>{label ?? KIND_LABEL[kind]}</span>
    </Badge>
  );
}
