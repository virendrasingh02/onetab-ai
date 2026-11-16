import { useState } from 'react';
import type { ContextEngineResult } from '@org/types';
import { cn } from '@org/utils';
import { Copy, Check, Sparkles, Zap } from 'lucide-react';
import { GraphEntity } from './GraphEntity.js';

export interface ContextInspectorProps {
  result: ContextEngineResult | null;
  className?: string;
}

export function ContextInspector({ result, className }: ContextInspectorProps) {
  const [tab, setTab] = useState<'prompt' | 'sources' | 'graph'>('prompt');
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className={cn('p-6 text-center text-xs text-muted-foreground border rounded-lg', className)}>
        Run a query or execute an agent to inspect context generation.
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result.promptContext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('space-y-4 rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Context Engine Inspector
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
            {result.mode}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="size-3 text-amber-500" />
            {result.retrievalLatencyMs}ms
          </span>
          <span className="font-mono text-foreground font-medium">
            {result.tokensUsed} / {result.tokenBudget} tokens
          </span>
          {result.tokensSavedEstimate > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              (~{result.tokensSavedEstimate} tokens saved)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('prompt')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors',
            tab === 'prompt'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Prompt Context
        </button>
        <button
          type="button"
          onClick={() => setTab('sources')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors',
            tab === 'sources'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Sources ({result.sources.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('graph')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors',
            tab === 'graph'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Subgraph ({result.subgraph.nodes.length} nodes)
        </button>
      </div>

      {tab === 'prompt' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Compact context supplied to the LLM:
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-lg border border-border bg-muted/40 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
            {result.promptContext}
          </pre>
        </div>
      )}

      {tab === 'sources' && (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {result.sources.map((s) => (
            <div key={s.id} className="p-2.5 rounded-lg border border-border bg-card text-xs space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-foreground">{s.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  Score: {(s.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {s.snippet}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'graph' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {result.subgraph.nodes.map((n) => (
            <GraphEntity key={n.id} node={n} />
          ))}
        </div>
      )}
    </div>
  );
}
