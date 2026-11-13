import { Badge, Button, CodeBlock } from '@org/ui';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  actionId: string;
  actionType: string;
  payload: Record<string, unknown>;
  success: boolean;
  message?: string;
}

export interface TestConsoleDrawerProps {
  logs: ActionLogEntry[];
  onClearLogs: () => void;
}

export function TestConsoleDrawer({
  logs,
  onClearLogs,
}: TestConsoleDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-t border-border/80 bg-surface-raised transition-all">
      {/* Console Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2 flex cursor-pointer items-center justify-between border-b border-border/40 select-none hover:bg-accent/40"
      >
        <div className="gap-2 flex items-center">
          <Terminal className="size-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">
            Interactive Test Console
          </span>
          <Badge variant="outline" className="py-0 font-mono text-2xs">
            {logs.length} Events
          </Badge>
        </div>

        <div className="gap-2 flex items-center">
          {logs.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onClearLogs();
              }}
              className="h-6 text-meta text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="size-3 mr-1" />
              Clear
            </Button>
          )}
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Console Body */}
      {isExpanded && (
        <div className="p-3 max-h-48 space-y-2 overflow-y-auto font-mono text-meta">
          {logs.length === 0 ? (
            <div className="py-4 text-xs text-center text-muted-foreground italic">
              No actions executed yet. Click buttons or submit forms in the
              interactive preview canvas above to test triggers.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2 gap-2 shadow-2xs flex items-start justify-between rounded-lg border border-border/60 bg-surface"
              >
                <div className="gap-2 flex items-start">
                  {log.success ? (
                    <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="size-3.5 mt-0.5 shrink-0 text-destructive-text" />
                  )}
                  <div>
                    <div className="gap-2 flex items-center">
                      <span className="font-bold text-foreground">
                        {log.actionId}
                      </span>
                      <span className="px-1 py-0.2 rounded border border-border/60 bg-surface-raised text-2xs text-muted-foreground uppercase">
                        {log.actionType}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-2xs text-muted-foreground">
                        {log.message}
                      </p>
                    )}
                    {log.payload && (
                      <div className="mt-1">
                        <CodeBlock
                          code={
                            typeof log.payload === 'string'
                              ? log.payload
                              : JSON.stringify(log.payload, null, 2)
                          }
                          language="json"
                          variant="compact"
                          maxHeight="120px"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="gap-1 flex shrink-0 items-center text-2xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
