import type { AIEntityType, CoworkerStatus } from '@org/types';
import { NavLink } from 'react-router-dom';
import { AIEntityAvatar } from './ai-entity-avatar.js';
import { AIEntityStatus } from './ai-entity-status.js';
import { cn } from '@org/utils';
import type { FC } from 'react';

export interface AIEntityRowProps {
  entity: {
    id: string;
    name: string;
    role?: string;
    type?: AIEntityType;
    avatarUrl?: string | null;
    status?: CoworkerStatus;
    isActive?: boolean;
    description?: string | null;
  };
  workspaceSlug: string;
  isSelected?: boolean;
  className?: string;
}

export const AIEntityRow: FC<AIEntityRowProps> = ({
  entity,
  workspaceSlug,
  isSelected = false,
  className,
}) => {
  const type = entity.type ?? 'agent';
  const targetUrl =
    type === 'coworker'
      ? `/w/${workspaceSlug}/coworkers/${entity.id}`
      : `/w/${workspaceSlug}/agents/${entity.id}/chat`;

  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
        isSelected ? 'bg-accent/15 text-accent font-medium' : 'hover:bg-muted/60 text-foreground',
        className,
      )}
    >
      <NavLink to={targetUrl} className="min-w-0 flex flex-1 items-center gap-2.5">
        <AIEntityAvatar
          name={entity.name}
          type={type}
          avatarUrl={entity.avatarUrl}
          status={entity.status}
          size="sm"
        />
        <div className="min-w-0 flex flex-col">
          <span className="truncate font-medium leading-none">{entity.name}</span>
          <span className="truncate text-xs text-muted-foreground mt-0.5">
            {entity.role || (type === 'coworker' ? 'AI Coworker' : 'AI Agent')}
          </span>
        </div>
      </NavLink>

      <AIEntityStatus type={type} status={entity.status} isActive={entity.isActive} />
    </div>
  );
};
