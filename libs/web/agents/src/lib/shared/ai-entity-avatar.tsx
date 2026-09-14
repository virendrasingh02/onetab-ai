import type { AIEntityType, CoworkerStatus } from '@org/types';
import { cn } from '@org/utils';
import { Bot, Sparkles } from 'lucide-react';
import type { FC } from 'react';

export interface AIEntityAvatarProps {
  name: string;
  type?: AIEntityType;
  avatarUrl?: string | null;
  status?: CoworkerStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatusDot?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { container: 'h-6 w-6 text-[10px] rounded-md', icon: 'h-3.5 w-3.5', dot: 'size-1.5' },
  sm: { container: 'h-8 w-8 text-xs rounded-lg', icon: 'h-4 w-4', dot: 'size-2' },
  md: { container: 'h-10 w-10 text-sm rounded-xl', icon: 'h-5 w-5', dot: 'size-2.5' },
  lg: { container: 'h-12 w-12 text-base rounded-xl', icon: 'h-6 w-6', dot: 'size-3' },
  xl: { container: 'h-16 w-16 text-xl rounded-2xl', icon: 'h-8 w-8', dot: 'size-3.5' },
};

export const AIEntityAvatar: FC<AIEntityAvatarProps> = ({
  name,
  type = 'agent',
  avatarUrl,
  status = 'AVAILABLE',
  size = 'md',
  showStatusDot = true,
  className,
}) => {
  const sizeConfig = SIZE_MAP[size];

  const statusColor =
    status === 'WORKING'
      ? 'bg-accent-amber animate-pulse'
      : status === 'ERROR'
        ? 'bg-destructive'
        : status === 'IDLE'
          ? 'bg-muted-foreground'
          : 'bg-emerald-500';

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center font-semibold select-none',
        sizeConfig.container,
        type === 'coworker'
          ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 text-primary border border-primary/20'
          : 'bg-surface-raised text-foreground border border-border',
        className,
      )}
      title={`${name} (${type === 'coworker' ? 'AI Coworker' : 'AI Agent'})`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover rounded-[inherit]"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      ) : type === 'coworker' ? (
        <Sparkles className={cn(sizeConfig.icon, 'text-primary')} />
      ) : (
        <Bot className={cn(sizeConfig.icon, 'text-primary')} />
      )}

      {showStatusDot ? (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background',
            sizeConfig.dot,
            statusColor,
          )}
        />
      ) : null}
    </div>
  );
};
