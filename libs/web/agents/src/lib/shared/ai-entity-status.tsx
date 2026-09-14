import type { AIEntityType, CoworkerStatus } from '@org/types';
import { Badge } from '@org/ui';
import { cn } from '@org/utils';
import type { FC } from 'react';

export interface AIEntityStatusProps {
  type: AIEntityType;
  status?: CoworkerStatus;
  isActive?: boolean;
  className?: string;
}

export const AIEntityStatus: FC<AIEntityStatusProps> = ({
  type,
  status = 'AVAILABLE',
  isActive = true,
  className,
}) => {
  if (!isActive) {
    return (
      <Badge variant="neutral" className={cn('text-muted-foreground', className)}>
        Inactive
      </Badge>
    );
  }

  if (type === 'agent') {
    return (
      <Badge variant="primary" className={cn('text-[10px] tracking-wider uppercase font-semibold', className)}>
        AI Agent
      </Badge>
    );
  }

  const statusVariant =
    status === 'WORKING'
      ? 'warning'
      : status === 'ERROR'
        ? 'destructive'
        : 'success';

  return (
    <Badge variant={statusVariant} className={cn('capitalize text-xs font-medium', className)}>
      {status === 'WORKING' ? 'Working…' : status.toLowerCase()}
    </Badge>
  );
};
