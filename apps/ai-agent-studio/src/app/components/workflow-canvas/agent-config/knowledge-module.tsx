import { knowledgeApi } from '@org/api-client';
import { AppSelect, Badge, Button, confirm, Input, SegmentedControl, Slider, Switch } from '@org/ui';
import { cn } from '@org/utils';
import type { KnowledgeRetrievalResult, KnowledgeSearchMode } from '@org/types';
import { ArrowDown, BookOpen, ExternalLink, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATALOG_NODES } from '../node-library.js';
import { IssueList, LoadError, OutputBlock, SectionEmpty, SettingField, SettingSection, StatGrid, fieldDomId, useSections } from './config-primitives.js';
import type { ModuleEditorProps } from './module-drawer.js';
import { useKnowledgeBases, useWorkspaceId } from './use-agent-config-data.js';

type ModeChoice = 'AUTO' | KnowledgeSearchMode;
const MODE_OPTIONS: Array<{ value: ModeChoice; label: string; hint: string }> = [
  { value: 'AUTO', label: 'Auto', hint: 'Semantic, falling back to keyword' },
  { value: 'SEMANTIC', label: 'Semantic', hint: 'Meaning-based vector search' },
  { value: 'KEYWORD', label: 'Keyword', hint: 'Exact word matches' },
  { value: 'HYBRID', label: 'Hybrid', hint: 'Both, merged by best score' },
];

/** What the agent run sends the model per passage, and in total (mirrors the runtime's limits). */
const EXCERPT_CHARS = 1_500;
const CONTEXT_CHARS = 8_000;

const KB_CARD = CATALOG_NODES.find((n) => n.type === 'KB_SEARCH');

export function KnowledgeModule({ view, issues, readOnly, setConfig, actions, jumpTo, testSignal }: ModuleEditorProps) {
  const bases = useKnowledgeBases();
  const sources = view.knowledge.sources;
  const { hidden } = useSections();
  const [adding, setAdding] = useState('');

  const baseName = (id: string | undefined) => bases.data?.find((b) => b.id === id)?.name;
  const attachBase = (knowledgeBaseId: string) => {
    if (!KB_CARD || !knowledgeBaseId) return;
    const name = baseName(knowledgeBaseId) ?? 'Knowledge';
    actions.attach({ ...KB_CARD, label: name, subtitle: 'Knowledge base', defaultConfig: { ...(KB_CARD.defaultConfig ?? {}), knowledgeBaseId, topK: 5 } }, 'embedding');
    setAdding('');
  };
  const removeSource = async (nodeId: string, label: string) => {
    const ok = await confirm({ title: `Remove “${label}”?`, description: 'The knowledge card is removed from the canvas. Undo with Ctrl+Z.', confirmLabel: 'Remove', destructive: true });
    if (ok) actions.deleteNode(nodeId);
  };
  const setAll = (patch: Record<string, unknown>) => sources.forEach((s) => setConfig(s.nodeId, patch));

  const unusedBases = (bases.data ?? []).filter((b) => !sources.some((s) => s.binding?.knowledgeBaseId === b.id));

  return (
    <>
      <SettingSection id="overview" title="Overview" description="Before each turn the agent searches these sources for the request and reads the best passages.">
        <StatGrid
          items={[
            { label: 'Sources', value: sources.length },
            { label: 'Active', value: sources.filter((s) => s.enabled && s.binding).length },
            { label: 'Bases in workspace', value: bases.isLoading ? '…' : (bases.data?.length ?? '—') },
          ]}
        />
        <IssueList issues={issues} onJump={jumpTo} empty={sources.length ? 'All sources are ready.' : undefined} />
      </SettingSection>

      <SettingSection id="sources" title="Sources" issues={issues.filter((i) => i.section === 'sources')}>
        {bases.error && <LoadError what="knowledge bases" error={bases.error} onRetry={() => void bases.refetch()} />}
        {sources.length === 0 ? (
          <SectionEmpty icon={BookOpen} title="No knowledge yet">
            Add a knowledge base so the agent answers from your documents.
          </SectionEmpty>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => {
              const base = bases.data?.find((b) => b.id === s.binding?.knowledgeBaseId);
              return (
                <li key={s.nodeId} id={fieldDomId(`node-${s.nodeId}`)} className={cn('space-y-2 rounded-lg border p-2.5 scroll-mt-16', s.enabled ? 'border-border bg-surface-raised/40' : 'border-dashed border-border opacity-75')}>
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{s.label}</span>
                    <Switch checked={s.enabled} disabled={readOnly} onCheckedChange={(enabled) => setConfig(s.nodeId, { enabled: enabled ? undefined : false })} aria-label={`Use ${s.label}`} />
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Open ${s.label} card`} onClick={() => actions.selectNode(s.nodeId)}>
                      <ExternalLink className="size-3.5" />
                    </Button>
                    {!readOnly && (
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${s.label}`} onClick={() => void removeSource(s.nodeId, s.label)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <AppSelect
                    size="sm"
                    searchable
                    loading={bases.isLoading}
                    value={s.binding?.knowledgeBaseId ?? ''}
                    placeholder="Pick a knowledge base"
                    aria-label={`Knowledge base for ${s.label}`}
                    disabled={readOnly}
                    options={(bases.data ?? []).map((b) => ({ value: b.id, label: b.name, description: `${b._count?.documents ?? 0} documents · ${b.embeddingModel}` }))}
                    emptyText="No knowledge bases yet"
                    onValueChange={(knowledgeBaseId) => setConfig(s.nodeId, { knowledgeBaseId })}
                  />
                  {s.binding && !base && !bases.isLoading && bases.data && (
                    <p className="text-[11px] text-destructive">That knowledge base no longer exists or you can’t access it.</p>
                  )}
                  {base && (
                    <p className="text-[11px] text-muted-foreground">
                      {base._count?.documents ?? 0} documents · embeddings: {base.embeddingModel}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!readOnly && (
          <div className="flex gap-1.5">
            <AppSelect
              size="sm"
              searchable
              loading={bases.isLoading}
              value={adding}
              placeholder={
                unusedBases.length ? 'Add a knowledge base…' : (bases.data?.length ?? 0) === 0 ? 'No knowledge bases in this workspace yet' : 'Every knowledge base is added'
              }
              aria-label="Add a knowledge base"
              disabled={!unusedBases.length}
              options={unusedBases.map((b) => ({ value: b.id, label: b.name, description: `${b._count?.documents ?? 0} documents` }))}
              onValueChange={setAdding}
              className="flex-1"
            />
            <Button type="button" size="sm" disabled={!adding} onClick={() => attachBase(adding)}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        )}
        <a href="/knowledge" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
          Manage knowledge bases and documents <ExternalLink className="size-3" />
        </a>
      </SettingSection>

      <SettingSection id="retrieval" title="Retrieval" description="How each source is searched. Changes apply to the agent’s next run.">
        {sources.length === 0 && <p className="text-[11px] text-muted-foreground">Add a source first.</p>}
        {sources.length > 1 && !readOnly && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            Set every source to:
            {MODE_OPTIONS.map((m) => (
              <Button key={m.value} type="button" variant="ghost" size="xs" onClick={() => setAll({ mode: m.value === 'AUTO' ? undefined : m.value })}>
                {m.label}
              </Button>
            ))}
          </div>
        )}
        {sources.map((s) => {
          const mode: ModeChoice = s.binding?.mode ?? 'AUTO';
          const topK = s.binding?.topK ?? 5;
          const minScore = s.binding?.minScore ?? 0;
          return (
            <div key={s.nodeId} className="space-y-2.5 rounded-lg border border-border p-2.5">
              <p className="truncate text-xs font-medium text-foreground">{baseName(s.binding?.knowledgeBaseId) ?? s.label}</p>
              <SettingField label="Search mode" hint={MODE_OPTIONS.find((m) => m.value === mode)?.hint}>
                <SegmentedControl aria-label={`Search mode for ${s.label}`} size="sm" options={MODE_OPTIONS} value={mode} onChange={(m) => !readOnly && setConfig(s.nodeId, { mode: m === 'AUTO' ? undefined : m })} />
              </SettingField>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-foreground">Passages (top K)</span>
                  <span className="tabular-nums text-muted-foreground">{topK}</span>
                </div>
                <Slider min={1} max={20} step={1} value={[topK]} disabled={readOnly} aria-label={`Top K for ${s.label}`} onValueChange={([v]) => setConfig(s.nodeId, { topK: v })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-foreground">Minimum score</span>
                  <span className="tabular-nums text-muted-foreground">{minScore ? minScore.toFixed(2) : 'Off'}</span>
                </div>
                <Slider min={0} max={0.95} step={0.05} value={[minScore]} disabled={readOnly} aria-label={`Minimum score for ${s.label}`} onValueChange={([v]) => setConfig(s.nodeId, { minScore: v > 0 ? Math.round(v * 100) / 100 : undefined })} />
              </div>
            </div>
          );
        })}
      </SettingSection>

      {!hidden.has('testing') && <RetrievalDebugger view={view} testSignal={testSignal} />}
    </>
  );
}

interface SourceRun {
  nodeId: string;
  name: string;
  mode: ModeChoice;
  results: KnowledgeRetrievalResult[];
  error?: string;
  ms: number;
}

function RetrievalDebugger({ view, testSignal }: Pick<ModuleEditorProps, 'view' | 'testSignal'>) {
  const workspaceId = useWorkspaceId();
  const bases = useKnowledgeBases();
  const [query, setQuery] = useState('');
  const [runs, setRuns] = useState<SourceRun[] | null>(null);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (testSignal > 0) inputRef.current?.focus();
  }, [testSignal]);
  const active = view.knowledge.sources.filter((s) => s.enabled && s.binding);

  const run = async () => {
    if (!query.trim()) return;
    setRunning(true);
    const out = await Promise.all(
      active.map(async (s): Promise<SourceRun> => {
        const started = performance.now();
        const b = s.binding!;
        try {
          const results = await knowledgeApi.testRetrieval(workspaceId, b.knowledgeBaseId, {
            query: query.slice(0, 2_000),
            topK: b.topK,
            ...(b.mode ? { mode: b.mode } : {}),
            ...(b.minScore ? { scoreThreshold: b.minScore } : {}),
          });
          return { nodeId: s.nodeId, name: bases.data?.find((x) => x.id === b.knowledgeBaseId)?.name ?? s.label, mode: b.mode ?? 'AUTO', results, ms: Math.round(performance.now() - started) };
        } catch (e) {
          return { nodeId: s.nodeId, name: s.label, mode: b.mode ?? 'AUTO', results: [], error: e instanceof Error ? e.message : String(e), ms: Math.round(performance.now() - started) };
        }
      }),
    );
    setRuns(out);
    setRunning(false);
  };

  // The final context, built the way the agent runtime builds it.
  let budget = CONTEXT_CHARS;
  const passages = (runs ?? []).flatMap((r) => r.results.map((h) => `[${h.documentName}] ${h.content.slice(0, EXCERPT_CHARS)}`));
  const kept = passages.filter((p) => (budget -= p.length) >= 0);

  return (
    <SettingSection id="testing" title="Retrieval debugger" description="Runs a real search on each active source — exactly what the agent would read for this request.">
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input ref={inputRef} inputSize="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask what a user would ask" aria-label="Test query" className="text-xs" />
        <Button type="submit" size="sm" disabled={running || !query.trim() || active.length === 0}>
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          Search
        </Button>
      </form>
      {active.length === 0 && <p className="text-[11px] text-muted-foreground">No active source to search.</p>}
      {runs && (
        <ol className="space-y-2" aria-label="Retrieval steps">
          <li className="rounded-lg border border-border px-2.5 py-2 text-[11px]">
            <span className="font-semibold text-foreground">1. Query</span>
            <span className="ml-1.5 text-muted-foreground">“{query.slice(0, 120)}”</span>
          </li>
          <li className="flex justify-center text-muted-foreground" aria-hidden><ArrowDown className="size-3.5" /></li>
          {runs.map((r) => (
            <li key={r.nodeId} className="space-y-1.5 rounded-lg border border-border px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-foreground">2. {r.name}</span>
                <Badge variant="neutral" className="h-4 px-1 text-[9px]">{r.mode.toLowerCase()}</Badge>
                <span className="ml-auto tabular-nums text-muted-foreground">{r.results.length} hits · {r.ms} ms</span>
              </div>
              {r.error && <OutputBlock tone="error">{r.error}</OutputBlock>}
              {!r.error && r.results.length === 0 && <p className="text-[11px] text-muted-foreground">Nothing matched (or nothing scored above the minimum).</p>}
              <ul className="space-y-1">
                {r.results.map((h) => (
                  <li key={h.chunkId} className="rounded-md bg-surface-inset px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{h.documentName}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border" aria-hidden>
                        <span className="block h-full bg-primary" style={{ width: `${Math.round(h.score * 100)}%` }} />
                      </span>
                      <span className="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground" aria-label={`Score ${h.score}`}>{h.score.toFixed(2)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">{h.content}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          <li className="flex justify-center text-muted-foreground" aria-hidden><ArrowDown className="size-3.5" /></li>
          <li>
            <OutputBlock label={`3. Context the agent receives · ${kept.length}/${passages.length} passages · ${kept.join('\n\n').length.toLocaleString()} chars`}>
              {kept.length ? kept.join('\n\n') : '(nothing — the agent answers without reference material)'}
            </OutputBlock>
          </li>
        </ol>
      )}
    </SettingSection>
  );
}
