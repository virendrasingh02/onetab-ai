import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@org/ui';
import { Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { EntityItem } from './entity-item.js';
import type { ChatAppEntity, EntityActionHandlers } from './types.js';

export interface EntityListProps {
  items: ChatAppEntity[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  handlers?: EntityActionHandlers;
  showChannelBadge?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  className?: string;
}

export function EntityList({
  items,
  isLoading = false,
  error = null,
  onRetry,
  handlers,
  showChannelBadge = false,
  emptyTitle = 'No items found',
  emptyDescription = 'There are no app entities to display.',
  emptyIcon = <Layers />,
  emptyAction,
  className,
}: EntityListProps) {
  if (isLoading) {
    return <LoadingState label="Loading data…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load data"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={className ?? 'space-y-2'}>
      {items.map((entity) => (
        <li key={`${entity.kind}-${entity.id}`}>
          <EntityItem
            entity={entity}
            handlers={handlers}
            showChannelBadge={showChannelBadge}
          />
        </li>
      ))}
    </ul>
  );
}
