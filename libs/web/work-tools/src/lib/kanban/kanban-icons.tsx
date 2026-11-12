import { TaskStatus } from '@org/types';
import { Hint } from '@org/ui';
import { cn } from '@org/utils';
import type { CSSProperties } from 'react';
import { PRIORITY_COLORS } from './card-meta.js';
import {
  knownState,
  STATUS_CATEGORY_COLORS,
  stateTint,
  useKnownWorkflowStates,
} from './task-states.js';
import type { Priority } from './types.js';

/* ----------------------------------------------------------- status icons --- */

export interface StatusIconProps {
  status:
    | TaskStatus
    | 'BACKLOG'
    | 'TODO'
    | 'IN_PROGRESS'
    | 'IN_REVIEW'
    | 'DONE'
    | 'CANCELLED'
    | string;
  className?: string;
  /** Whether to show a tooltip on hover. Defaults to true. */
  showTooltip?: boolean;
  /** Optional custom tooltip text. Defaults to the formatted status name. */
  tooltipLabel?: string;
  /** Tooltip placement side. Defaults to 'top'. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Overrides the workflow state's colour. */
  color?: string;
}

export function getStatusLabel(
  status?:
    | TaskStatus
    | 'BACKLOG'
    | 'TODO'
    | 'IN_PROGRESS'
    | 'IN_REVIEW'
    | 'DONE'
    | 'CANCELLED'
    | string
    | null,
): string {
  const named = knownState(status ?? undefined)?.name;
  if (named) return named;
  switch (status) {
    case 'BACKLOG':
    case TaskStatus.BACKLOG:
      return 'Backlog';
    case 'TODO':
    case TaskStatus.TODO:
      return 'Planned';
    case 'IN_PROGRESS':
    case TaskStatus.IN_PROGRESS:
      return 'In Progress';
    case 'IN_REVIEW':
    case TaskStatus.IN_REVIEW:
      return 'In Review';
    case 'DONE':
    case TaskStatus.DONE:
      return 'Completed';
    case 'CANCELLED':
    case TaskStatus.CANCELLED:
      return 'Cancelled';
    default:
      if (!status) return 'Status';
      return String(status)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function renderStatusSvg(
  status:
    | TaskStatus
    | 'BACKLOG'
    | 'TODO'
    | 'IN_PROGRESS'
    | 'IN_REVIEW'
    | 'DONE'
    | 'CANCELLED'
    | string,
  className?: string,
  label?: string,
  tint?: string,
) {
  // Every built-in paints from the one status palette unless a colour is given.
  const color =
    tint ??
    STATUS_CATEGORY_COLORS[status as keyof typeof STATUS_CATEGORY_COLORS];
  const style: CSSProperties | undefined = color ? { color } : undefined;
  switch (status) {
    case 'BACKLOG':
    case TaskStatus.BACKLOG:
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-label={label ?? 'Backlog'}
          role="img"
          style={style}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
          />
        </svg>
      );

    case 'TODO':
    case TaskStatus.TODO:
      // Planned: gray hexagon
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-label={label ?? 'Planned'}
          role="img"
          style={style}
        >
          <polygon
            points="8,2 13.5,5.2 13.5,10.8 8,14 2.5,10.8 2.5,5.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'IN_PROGRESS':
    case TaskStatus.IN_PROGRESS:
      // In Progress: yellow half circle / spinner
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-label={label ?? 'In Progress'}
          role="img"
          style={style}
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 8L8 2A6 6 0 0 1 14 8Z" fill="currentColor" />
        </svg>
      );

    case 'IN_REVIEW':
    case TaskStatus.IN_REVIEW:
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-label={label ?? 'In Review'}
          role="img"
          style={style}
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </svg>
      );

    case 'DONE':
    case TaskStatus.DONE:
      // Completed: solid blue circle with white checkmark
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-label={label ?? 'Completed'}
          role="img"
          style={style}
        >
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="M5 8.2L7 10.2L11 6"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'CANCELLED':
    case TaskStatus.CANCELLED:
      // Canceled: gray circle with X
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-label={label ?? 'Cancelled'}
          role="img"
          style={style}
        >
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    default:
      return (
        <span
          title={label}
          aria-label={label ?? 'Status'}
          role="img"
          style={tint ? { borderColor: tint } : undefined}
          className={cn(
            'size-3.5 inline-block shrink-0 rounded-full border border-muted-foreground',
            className,
          )}
        />
      );
  }
}

export function StatusIcon({
  status,
  className,
  showTooltip = true,
  tooltipLabel,
  side = 'top',
  color,
}: StatusIconProps) {
  // A custom status draws its category's icon in its own colour; a renamed
  // built-in keeps its icon. Both come from the workspace's workflow.
  const states = useKnownWorkflowStates();
  const state = states.find((item) => item.id === status);
  const label = tooltipLabel ?? state?.name ?? getStatusLabel(status);
  const icon = renderStatusSvg(
    state?.category ?? status,
    className,
    label,
    color ?? stateTint(state),
  );

  if (!showTooltip) {
    return icon;
  }

  return (
    <Hint label={label} side={side}>
      <span className="inline-flex shrink-0 items-center justify-center">
        {icon}
      </span>
    </Hint>
  );
}

/* --------------------------------------------------------- priority icons --- */

export interface PriorityIconProps {
  priority: Priority | 'NO_PRIORITY' | 'NONE';
  className?: string;
}

export function PriorityIcon({ priority, className }: PriorityIconProps) {
  // Theme-fixed: the same red/orange/yellow/grey in every view and workspace.
  const style: CSSProperties | undefined =
    priority in PRIORITY_COLORS
      ? { color: PRIORITY_COLORS[priority as Priority] }
      : undefined;
  switch (priority) {
    case 'NO_PRIORITY':
    case 'NONE':
      return (
        <span
          className={cn(
            'tracking-tight w-3.5 inline-block shrink-0 text-center font-mono text-[11px] leading-none text-muted-foreground select-none',
            className,
          )}
        >
          ---
        </span>
      );

    case 'URGENT':
      // Dark rounded square with white exclamation mark
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-hidden="true"
          style={style}
        >
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="2.5"
            fill="currentColor"
          />
          <path
            d="M8 5V8.5M8 11V11.5"
            stroke="#ffffff"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'HIGH':
      // 3 ascending bars
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-hidden="true"
          style={style}
        >
          <rect
            x="2"
            y="10"
            width="2.5"
            height="4"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="6.75"
            y="6.5"
            width="2.5"
            height="7.5"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="11.5"
            y="3"
            width="2.5"
            height="11"
            rx="0.5"
            fill="currentColor"
          />
        </svg>
      );

    case 'MEDIUM':
      // 2 ascending bars (3rd dim)
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-hidden="true"
          style={style}
        >
          <rect
            x="2"
            y="10"
            width="2.5"
            height="4"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="6.75"
            y="6.5"
            width="2.5"
            height="7.5"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="11.5"
            y="3"
            width="2.5"
            height="11"
            rx="0.5"
            fill="currentColor"
            opacity="0.2"
          />
        </svg>
      );

    case 'LOW':
      // 1 bar (2nd & 3rd dim)
      return (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={cn('size-3.5 shrink-0', className)}
          aria-hidden="true"
          style={style}
        >
          <rect
            x="2"
            y="10"
            width="2.5"
            height="4"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="6.75"
            y="6.5"
            width="2.5"
            height="7.5"
            rx="0.5"
            fill="currentColor"
            opacity="0.2"
          />
          <rect
            x="11.5"
            y="3"
            width="2.5"
            height="11"
            rx="0.5"
            fill="currentColor"
            opacity="0.2"
          />
        </svg>
      );

    default:
      return null;
  }
}

/* ------------------------------------------------------------- badge icons --- */

export function CubeProjectIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0 text-accent-amber', className)}
      aria-hidden="true"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function UnassignedLeadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn('size-3.5 shrink-0 text-muted-foreground/70', className)}
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeDasharray="2 2"
      />
      <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M4.5 12.5C5.2 10.8 6.5 10 8 10C9.5 10 10.8 10.8 11.5 12.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
