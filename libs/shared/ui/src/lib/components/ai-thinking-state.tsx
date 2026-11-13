import { cn } from '@org/utils';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

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
        'p-3 text-xs rounded-card border border-brand/20 bg-brand/5 shadow-xs transition-all duration-(--duration-fast)',
        isStreaming && 'animate-pulse',
        className,
      )}
    >
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="gap-2 font-medium flex w-full cursor-pointer items-center justify-between text-left text-brand-text outline-none"
      >
        <div className="gap-2 flex items-center">
          <div className="size-5 flex items-center justify-center rounded-full bg-brand/20 text-brand-text">
            <Brain className="size-3.5" />
          </div>
          <span>{title}</span>
          {isStreaming ? (
            <span className="gap-1 flex items-center font-mono text-2xs text-brand-text">
              <span className="size-1.5 animate-ping rounded-full bg-brand" />
              {seconds}s
            </span>
          ) : (
            seconds > 0 && (
              <span className="font-mono text-2xs text-muted-foreground">
                (thought for {seconds}s)
              </span>
            )
          )}
        </div>

        <div className="gap-1 flex items-center text-meta text-muted-foreground hover:text-foreground">
          <span>{isExpanded ? 'Hide reasoning' : 'Show reasoning'}</span>
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </div>
      </button>

      {/* Expanded thoughts */}
      {isExpanded && (
        <div className="mt-2.5 pt-2 leading-relaxed max-h-60 scrollbar-subtle overflow-y-auto border-t border-brand/15 font-mono text-meta whitespace-pre-wrap text-foreground/80">
          {thinkingText}
          {isStreaming && (
            <span className="w-1.5 h-3.5 ml-0.5 animate-pulse inline-block bg-brand" />
          )}
        </div>
      )}
    </div>
  );
}
