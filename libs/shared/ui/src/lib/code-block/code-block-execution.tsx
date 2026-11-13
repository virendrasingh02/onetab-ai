import { Button } from '../components/button.js';
import { cn } from '@org/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Terminal,
} from 'lucide-react';
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
    <div
      className={cn(
        'text-xs border-t border-border/80 bg-surface-raised/40 font-mono select-none',
        className,
      )}
    >
      {/* Header bar */}
      <div className="px-3.5 py-1.5 flex items-center justify-between border-b border-border/50 text-meta">
        <div className="gap-2 flex items-center">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">Runtime Output</span>

          {/* Status badge */}
          {isRunning ? (
            <span className="gap-1 animate-pulse flex items-center text-primary">
              <Loader2 className="size-3 animate-spin" />
              <span>Executing...</span>
            </span>
          ) : status === 'success' ? (
            <span className="gap-1 flex items-center text-success-text">
              <CheckCircle2 className="size-3" />
              <span>Done</span>
            </span>
          ) : status === 'error' ? (
            <span className="gap-1 flex items-center text-destructive-text">
              <AlertCircle className="size-3" />
              <span>Failed</span>
            </span>
          ) : (
            <span className="text-muted-foreground/70">
              {isConnected ? 'Ready' : 'Runtime disconnected'}
            </span>
          )}
        </div>

        <div className="gap-2 flex items-center">
          {isConnected ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => onExecute(code)}
              disabled={isRunning}
              className="h-6 px-2 gap-1 text-meta"
            >
              <Play className="size-3 fill-current" />
              <span>{isRunning ? 'Running...' : 'Run'}</span>
            </Button>
          ) : (
            <span className="text-2xs text-muted-foreground/60 italic">
              Execution service required
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? 'Collapse console' : 'Expand console'}
          >
            {isOpen ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        </div>
      </div>

      {/* Output Console Section */}
      {isOpen ? (
        <div className="p-3 max-h-40 leading-relaxed scrollbar-subtle overflow-y-auto bg-surface-inset font-mono text-meta text-foreground/90">
          {output ? (
            <pre className="m-0 whitespace-pre-wrap">{output}</pre>
          ) : !isConnected ? (
            <div className="gap-2 py-1 flex items-center text-muted-foreground/80">
              <AlertCircle className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span>
                Backend execution runtime is not connected. Connect an isolated
                execution container to execute {language} code safely.
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground/50 italic">
              No output yet. Click Run to execute.
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
