import { agentVersionLabel, type AgentVersion } from '@org/types';
import { Badge, Button, EmptyState, Input } from '@org/ui';
import { cn } from '@org/utils';
import { Clock, Eye, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatWhen } from './deployment/versions-panel.js';

type Filter = 'all' | 'published' | 'snapshots';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'snapshots', label: 'Snapshots' },
];

const VISIBLE = 8;
const tagOf = agentVersionLabel;

/** "Today", "Yesterday", or the date: the heading a version is grouped under. */
function dayLabel(iso?: string): string {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The agent's saved graph versions: filter, search, compare and restore, grouped by day. */
export function AgentVersionsList({
  versions,
  restoring,
  onCompare,
  onRestore,
}: {
  versions: AgentVersion[];
  restoring: boolean;
  onCompare: (v: AgentVersion) => void;
  onRestore: (v: AgentVersion) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const latest = useMemo(() => Math.max(...versions.map((v) => v.version)), [versions]);
  const counts = useMemo(
    () => ({
      all: versions.length,
      published: versions.filter((v) => v.status === 'PUBLISHED').length,
      snapshots: versions.filter((v) => v.status !== 'PUBLISHED').length,
    }),
    [versions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return versions
      .filter((v) => (filter === 'published' ? v.status === 'PUBLISHED' : filter === 'snapshots' ? v.status !== 'PUBLISHED' : true))
      .filter((v) => !q || `${tagOf(v)} ${v.changeSummary ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.version - a.version);
  }, [versions, filter, query]);

  const shown = showAll || query ? filtered : filtered.slice(0, VISIBLE);
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: AgentVersion[] }> = [];
    for (const v of shown) {
      const label = dayLabel(v.publishedAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(v);
      else out.push({ label, items: [v] });
    }
    return out;
  }, [shown]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Filter versions" className="inline-flex gap-1 rounded-lg border bg-muted/40 p-0.5">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              size="xs"
              variant={filter === f.id ? 'secondary' : 'ghost'}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="ml-1 text-muted-foreground">{counts[f.id]}</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search versions" aria-label="Search versions" className="pl-8 text-xs" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Clock />} title="No matching versions" description="Try a different filter or search." />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h4>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80">
                {group.items.map((v) => (
                  <li key={v.version} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{tagOf(v)}</span>
                        {v.version === latest ? <Badge variant="outline" className="px-1.5 py-0 text-2xs">Latest</Badge> : null}
                        <Badge variant={v.status === 'PUBLISHED' ? 'success' : 'outline'} className={cn('px-1.5 py-0 text-2xs', v.status !== 'PUBLISHED' && 'text-muted-foreground')}>
                          {v.status === 'PUBLISHED' ? 'Published' : 'Snapshot'}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground" title={v.changeSummary || undefined}>
                        {v.changeSummary || 'No description'}
                      </p>
                    </div>
                    <time className="shrink-0 text-2xs text-muted-foreground" dateTime={v.publishedAt} title={v.publishedAt ? new Date(v.publishedAt).toLocaleString() : undefined}>
                      {formatWhen(v.publishedAt)}
                    </time>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => onCompare(v)} className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <Eye className="size-3.5" /> Compare
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onRestore(v)} disabled={restoring} className="gap-1.5 text-xs">
                        <RotateCcw className="size-3.5" /> Restore
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!query && filtered.length > VISIBLE ? (
            <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAll((x) => !x)}>
              {showAll ? 'Show fewer' : `Show ${filtered.length - VISIBLE} older versions`}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
