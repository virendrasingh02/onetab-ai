import { Button } from '../components/button.js';
import { cn } from '@org/utils';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Play, Terminal } from 'lucide-react';
import { useState } from 'react';
import type { ExecutionStatus } from './types.js';

export interface CodeBlockExecutionProps {
  code: string;
  language?: string;
  status?: ExecutionStatus;
  output?: string;
  onExecute?: (code: string) => Promise<void> | void;
  className?: string;
}

export function CodeBlockExecution({
  code,
  language = 'plaintext',
  status = 'unavailable',
  output,
  onExecute,
  className,
}: CodeBlockExecutionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const isConnected = !!onExecute;
  const isRunning = status === 'running';

  return (
    <div className={cn('border-t border-border/80 bg-surface-raised/40 font-mono text-xs select-none', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border/50 text-[11px]">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">Runtime Output</span>

          {/* Status badge */}
          {isRunning ? (
            <span className="flex items-center gap-1 text-primary animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              <span>Executing...</span>
            </span>
          ) : status === 'success' ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              <span>Done</span>
            </span>
          ) : status === 'error' ? (
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <AlertCircle className="size-3" />
              <span>Failed</span>
            </span>
          ) : (
            <span className="text-muted-foreground/70">
              {isConnected ? 'Ready' : 'Runtime disconnected'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => onExecute(code)}
              disabled={isRunning}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Play className="size-3 fill-current" />
              <span>{isRunning ? 'Running...' : 'Run'}</span>
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 italic">
              Execution service required
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? 'Collapse console' : 'Expand console'}
          >
            {isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {/* Output Console Section */}
      {isOpen ? (
        <div className="p-3 bg-surface-inset text-foreground/90 font-mono text-[11px] max-h-40 overflow-y-auto leading-relaxed scrollbar-subtle">
          {output ? (
            <pre className="m-0 whitespace-pre-wrap">{output}</pre>
          ) : !isConnected ? (
            <div className="flex items-center gap-2 text-muted-foreground/80 py-1">
              <AlertCircle className="size-3.5 text-muted-foreground/60 shrink-0" />
              <span>
                Backend execution runtime is not connected. Connect an isolated execution container to execute {language} code safely.
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground/50 italic">No output yet. Click Run to execute.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
