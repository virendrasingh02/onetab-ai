import type { AIEntityType, CoworkerStatus } from '@org/types';
import { AiEntityAvatar } from '@org/ui';
import { cn } from '@org/utils';
import type { FC } from 'react';

export interface AIEntityAvatarProps {
  name: string;
  type?: AIEntityType;
  /** A photo URL or a built-in identity (`icon:<icon>[:<color>]`). */
  avatarUrl?: string | null;
  status?: CoworkerStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatusDot?: boolean;
  className?: string;
}

const DOT = { xs: 'size-1.5', sm: 'size-2', md: 'size-2.5', lg: 'size-3', xl: 'size-3.5' } as const;

/** The shared `@org/ui` identity (photo or icon on its colour) plus a presence dot. */
export const AIEntityAvatar: FC<AIEntityAvatarProps> = ({
  name,
  type = 'agent',
  avatarUrl,
  status = 'AVAILABLE',
  size = 'md',
  showStatusDot = true,
  className,
}) => {
  const statusColor =
    status === 'WORKING'
      ? 'bg-accent-amber animate-pulse'
      : status === 'ERROR'
        ? 'bg-destructive'
        : status === 'IDLE'
          ? 'bg-muted-foreground'
          : 'bg-success';

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      title={`${name} (${type === 'coworker' ? 'AI Coworker' : 'AI Agent'})`}
    >
      <AiEntityAvatar name={name} kind={type === 'coworker' ? 'coworker' : 'agent'} avatarUrl={avatarUrl} size={size} />
      {showStatusDot ? (
        <span className={cn('absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background', DOT[size], statusColor)} />
      ) : null}
    </span>
  );
};
