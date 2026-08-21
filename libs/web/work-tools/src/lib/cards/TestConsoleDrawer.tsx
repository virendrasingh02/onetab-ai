import { Badge, Button } from '@org/ui';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Terminal, Trash2, XCircle } from 'lucide-react';
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

export function TestConsoleDrawer({ logs, onClearLogs }: TestConsoleDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-t border-border/80 bg-surface-raised transition-all">
      {/* Console Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-accent/40 select-none border-b border-border/40"
      >
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">Interactive Test Console</span>
          <Badge variant="outline" className="text-[10px] py-0 font-mono">
            {logs.length} Events
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onClearLogs();
              }}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="size-3 mr-1" />
              Clear
            </Button>
          )}
          <button type="button" className="text-muted-foreground hover:text-foreground p-1">
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Console Body */}
      {isExpanded && (
        <div className="p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-4 italic text-xs">
              No actions executed yet. Click buttons or submit forms in the interactive preview canvas above to test triggers.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2 rounded-lg border border-border/60 bg-surface flex items-start justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-start gap-2">
                  {log.success ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="size-3.5 text-rose-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{log.actionId}</span>
                      <span className="text-[10px] text-muted-foreground uppercase bg-surface-raised px-1 py-0.2 rounded border border-border/60">
                        {log.actionType}
                      </span>
                    </div>
                    {log.message && <p className="text-muted-foreground text-[10px]">{log.message}</p>}
                    <pre className="mt-1 p-1.5 rounded bg-surface-inset text-foreground/80 text-[10px] max-h-24 overflow-x-auto">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
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
