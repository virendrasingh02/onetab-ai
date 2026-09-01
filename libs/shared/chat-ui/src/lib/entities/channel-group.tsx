import { Badge } from '@org/ui';
import { Hash, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { EntityList } from './entity-list.js';
import type { ChannelEntityGroup, EntityActionHandlers } from './types.js';

export interface ChannelGroupProps {
  group: ChannelEntityGroup;
  handlers?: EntityActionHandlers;
  headerAction?: ReactNode;
}

export function ChannelGroup({
  group,
  handlers,
  headerAction,
}: ChannelGroupProps) {
  const Icon = group.isPrivate ? Lock : Hash;

  return (
    <section className="space-y-2.5">
      <div className="gap-1.5 px-1 flex items-center justify-between">
        <h3 className="gap-1.5 flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          <span>{group.channelName}</span>
          <Badge variant="neutral" className="px-1.5 py-0 h-4 text-[10px]">
            {group.entities.length}
          </Badge>
        </h3>
        {headerAction}
      </div>

      <EntityList
        items={group.entities}
        handlers={handlers}
        showChannelBadge={false}
      />
    </section>
  );
}
