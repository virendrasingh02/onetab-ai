import { Tooltip, TooltipContent, TooltipTrigger } from '@org/ui';
import { cn } from '@org/utils';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface WorkflowIssue {
  level: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

interface WorkflowHealthBadgeProps {
  issues: WorkflowIssue[];
  onClick: () => void;
  className?: string;
}

export function WorkflowHealthBadge({ issues, onClick, className }: WorkflowHealthBadgeProps) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  const status =
    errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'healthy';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-2xs transition-all duration-150 cursor-pointer select-none',
            status === 'error' &&
              'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 ring-1 ring-destructive/30',
            status === 'warning' &&
              'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 ring-1 ring-warning/30',
            status === 'healthy' &&
              'border-success/30 bg-success/10 text-success hover:bg-success/15',
            className,
          )}
        >
          {status === 'error' && (
            <>
              <AlertTriangle className="size-3.5 stroke-[2.5]" />
              <span>{errors.length} {errors.length === 1 ? 'Error' : 'Errors'}</span>
            </>
          )}

          {status === 'warning' && (
            <>
              <AlertCircle className="size-3.5 stroke-[2.5]" />
              <span>{warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}</span>
            </>
          )}

          {status === 'healthy' && (
            <>
              <CheckCircle2 className="size-3.5 stroke-[2.5]" />
              <span>Healthy</span>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-64">
        {status === 'healthy' ? (
          <p>Workflow structure and model connections are fully valid.</p>
        ) : (
          <p>
            Click to open validation details ({errors.length} blocking error{errors.length === 1 ? '' : 's'}, {warnings.length} warning{warnings.length === 1 ? '' : 's'}).
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
