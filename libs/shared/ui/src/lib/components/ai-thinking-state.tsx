import { cn } from '@org/utils';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';


export interface AIThinkingStateProps {
  thinkingText?: string;
  isStreaming?: boolean;
  durationSeconds?: number;
  defaultExpanded?: boolean;
  className?: string;
  title?: string;
}

export function AIThinkingState({
  thinkingText = 'Analyzing request context and planning execution...',
  isStreaming = false,
  durationSeconds: initialDuration,
  defaultExpanded = false,
  className,
  title = 'Thinking Process',
}: AIThinkingStateProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [seconds, setSeconds] = useState(initialDuration ?? 0);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div
      className={cn(
        'rounded-card border border-primary/20 bg-primary/5 p-3 text-xs shadow-xs transition-all duration-(--duration-fast)',
        isStreaming && 'animate-pulse',
        className,
      )}
    >
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-2 text-left font-medium text-primary-text outline-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Brain className="size-3.5" />
          </div>
          <span>{title}</span>
          {isStreaming ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-ping" />
              {seconds}s
            </span>
          ) : (
            seconds > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                (thought for {seconds}s)
              </span>
            )
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <span>{isExpanded ? 'Hide reasoning' : 'Show reasoning'}</span>
          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </div>
      </button>

      {/* Expanded thoughts */}
      {isExpanded && (
        <div className="mt-2.5 pt-2 border-t border-primary/15 text-[11px] font-mono text-foreground/80 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap scrollbar-subtle">
          {thinkingText}
          {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse" />}
        </div>
      )}
    </div>
  );
}
