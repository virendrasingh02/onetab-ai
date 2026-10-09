import { Badge } from '@org/ui';
import { OutputBlock, StatGrid } from './config-primitives.js';
import type { ModelTestResult } from './model-test.js';
import { formatCost } from './use-agent-config-data.js';

/** One model test: the reply (or the reason it failed) with tokens, latency and cost. */
export function ResultCard({ result }: { result: ModelTestResult }) {
  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] font-semibold text-foreground">{result.model}</span>
        {result.ok ? <Badge variant="success" className="h-4 px-1 text-[9px]">OK</Badge> : <Badge variant="destructive" className="h-4 px-1 text-[9px]">Failed</Badge>}
      </div>
      {result.ok ? <OutputBlock>{result.output || '(empty reply)'}</OutputBlock> : <OutputBlock tone="error">{result.error}</OutputBlock>}
      <StatGrid
        items={[
          { label: 'Input', value: result.inputTokens.toLocaleString() },
          { label: 'Output', value: result.outputTokens.toLocaleString() },
          ...(result.reasoningTokens ? [{ label: 'Reasoning', value: result.reasoningTokens.toLocaleString() }] : []),
          { label: 'Latency', value: `${(result.latencyMs / 1000).toFixed(2)} s` },
          { label: 'Est. cost', value: formatCost(result.cost) },
          ...(result.finishReason ? [{ label: 'Finish', value: result.finishReason }] : []),
        ]}
      />
    </div>
  );
}
