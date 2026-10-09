import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { Activity, AlertTriangle, ArrowDown, ChevronRight, MessageSquare, Send } from 'lucide-react';
import { firstIssue, type AgentModuleId, type ModuleSummary } from './agent-module-model.js';
import { MODULE_ICONS, STATE_META } from './config-primitives.js';

/**
 * The agent's five modules in the inspector: each row says what is set and
 * whether it needs attention; clicking opens that module's drawer. Below it,
 * the order the agent actually uses them in on a run.
 */
export function AgentModulesOverview({
  summaries,
  onOpen,
  onRunTest,
}: {
  summaries: ModuleSummary[];
  onOpen: (id: AgentModuleId, target?: { section?: string; field?: string }) => void;
  onRunTest: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agent configuration</h4>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {summaries.map((s) => {
            const Icon = MODULE_ICONS[s.id];
            const meta = STATE_META[s.state];
            const issue = firstIssue(s);
            const problems = s.issues.filter((i) => i.level !== 'info').length;
            return (
              <li key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(s.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 motion-reduce:transition-none"
                  aria-label={`${s.label}: ${s.title}${s.detail ? `, ${s.detail}` : ''}. ${meta.label}. Open settings`}
                >
                  <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                    <span className={cn('absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-surface', meta.dot)} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-foreground">{s.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {s.title}
                      {s.detail ? ` · ${s.detail}` : ''}
                    </span>
                  </span>
                  {problems > 0 && <span className="w-5" aria-hidden />}
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
                {issue && problems > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpen(s.id, { section: issue.section, field: issue.field })}
                    className={cn('absolute right-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40', meta.text)}
                    title={issue.message}
                    aria-label={`Go to the problem: ${issue.message}`}
                  >
                    <AlertTriangle className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ExecutionPreview summaries={summaries} onOpen={onOpen} onRunTest={onRunTest} />
    </div>
  );
}

/** Input → Prompt → LLM ⇄ Knowledge / Tools / Sub-agents → Output, coloured by each module's state. */
function ExecutionPreview({ summaries, onOpen, onRunTest }: { summaries: ModuleSummary[]; onOpen: (id: AgentModuleId) => void; onRunTest: () => void }) {
  const by = new Map(summaries.map((s) => [s.id, s]));
  const step = (id: AgentModuleId, note: string) => {
    const s = by.get(id)!;
    const Icon = MODULE_ICONS[id];
    const meta = STATE_META[s.state];
    const skipped = s.state === 'empty' && id !== 'prompt' && id !== 'llm';
    return (
      <button
        type="button"
        onClick={() => onOpen(id)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          skipped ? 'border-dashed border-border text-muted-foreground' : 'border-border bg-surface',
        )}
      >
        <Icon className={cn('size-3.5 shrink-0', skipped ? 'text-muted-foreground/60' : 'text-primary')} />
        <span className="font-medium">{s.label}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{skipped ? 'skipped' : note}</span>
        <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} aria-label={meta.label} />
      </button>
    );
  };
  const arrow = <ArrowDown className="mx-auto size-3 text-muted-foreground/70" aria-hidden />;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How a run flows</h4>
        <Button type="button" variant="ghost" size="xs" onClick={onRunTest}>
          <Activity className="size-3.5" />
          Test run
        </Button>
      </div>
      <ol className="space-y-1" aria-label="Execution order">
        <li className="flex items-center gap-2 rounded-lg bg-surface-inset px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <MessageSquare className="size-3.5" /> Input — the message or the previous step’s result
        </li>
        <li>{arrow}</li>
        <li>{step('knowledge', 'searched for the request first')}</li>
        <li>{arrow}</li>
        <li>{step('prompt', 'becomes the system prompt')}</li>
        <li>{arrow}</li>
        <li>{step('llm', 'reasons and decides')}</li>
        <li className="grid grid-cols-2 gap-1 pl-4">
          {step('tools', 'called as needed')}
          {step('subAgents', 'delegated to')}
        </li>
        <li>{arrow}</li>
        <li className="flex items-center gap-2 rounded-lg bg-surface-inset px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Send className="size-3.5" /> Output — the agent’s answer goes to the next step
        </li>
      </ol>
    </div>
  );
}
