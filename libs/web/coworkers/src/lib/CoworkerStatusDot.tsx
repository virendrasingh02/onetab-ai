import type { CoworkerStatus } from '@org/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@org/ui';
import { cn } from '@org/utils';
import type { FC } from 'react';

export interface CoworkerStatusDotProps {
  status: CoworkerStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  CoworkerStatus,
  {
    label: string;
    dotClass: string;
    textClass: string;
    description: string;
  }
> = {
  AVAILABLE: {
    label: 'Available',
    dotClass: 'bg-success ring-success/20 shadow-[0_0_8px_color-mix(in_oklab,var(--color-success)_40%,transparent)]',
    textClass: 'text-success-text',
    description: 'Ready to take requests in channels, projects, or direct messages.',
  },
  WORKING: {
    label: 'Working',
    dotClass: 'bg-warning animate-pulse ring-warning/30 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    textClass: 'text-warning-text',
    description: 'Processing a query, generating code, or synthesizing documents.',
  },
  RUNNING_TASK: {
    label: 'Executing Task',
    dotClass: 'bg-accent-indigo animate-pulse ring-accent-indigo/30 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
    textClass: 'text-accent-indigo',
    description: 'Delegating actions to sub-agents or executing workflow tools.',
  },
  IDLE: {
    label: 'Idle',
    dotClass: 'bg-subtle ring-subtle/20',
    textClass: 'text-muted-foreground',
    description: 'Standing by for mentions or direct assignments.',
  },
  ERROR: {
    label: 'Error',
    dotClass: 'bg-destructive ring-destructive/20 shadow-[0_0_8px_rgba(244,63,94,0.4)]',
    textClass: 'text-destructive-text',
    description: 'Encountered an issue during last execution.',
  },
};

const SIZE_CLASSES = {
  xs: 'h-1.5 w-1.5 ring-1',
  sm: 'h-2 w-2 ring-2',
  md: 'h-2.5 w-2.5 ring-2',
  lg: 'h-3 w-3 ring-2',
};

export const CoworkerStatusDot: FC<CoworkerStatusDotProps> = ({
  status,
  size = 'sm',
  showLabel = false,
  className,
}) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.AVAILABLE;

  const dot = (
    <span
      className={cn(
        'inline-block shrink-0 rounded-full transition-colors',
        SIZE_CLASSES[size],
        config.dotClass,
        className,
      )}
      aria-label={config.label}
    />
  );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-default">{dot}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-muted-foreground text-2xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      {dot}
      <span className={config.textClass}>{config.label}</span>
    </span>
  );
};
