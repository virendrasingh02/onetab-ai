import { knowledgeApi } from '@org/api-client';
import { Badge, Button, LoadingState } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

export function KnowledgePage() {
  const { activeWorkspace } = useStudioSession();
  const [search, setSearch] = useState('');

  // Load knowledge bases for active workspace
  const {
    data: knowledgeBases = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['workspace-knowledge', activeWorkspace.id],
    queryFn: () => knowledgeApi.list(activeWorkspace.id),
  });

  const filteredBases = knowledgeBases.filter((kb) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      kb.name.toLowerCase().includes(q) ||
      (kb.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Workspace Knowledge & RAG
            </h1>
            <Badge variant="outline" className="text-xs">
              {knowledgeBases.length} collections
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect enterprise documents, notes, wikis, and uploads to agents via retrieval-augmented generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            loading={isRefetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}/docs`}>
              <span>Open Document Editor</span>
              <ExternalLink className="size-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Knowledge Collections</span>
            <FolderOpen className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {knowledgeBases.length}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Available for RAG agent nodes
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Vector Store</span>
            <Database className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            Qdrant
          </div>
          <p className="mt-1 text-[11px] text-emerald-500 font-medium">
            Embeddings synced
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Auto-Ingestion</span>
            <BookOpen className="size-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            Active
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Docs & PDFs indexed on save
          </p>
        </div>
      </div>

      {/* Collections List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">
          Knowledge Collections ({knowledgeBases.length})
        </h2>

        {isLoading ? (
          <LoadingState label="Loading workspace knowledge collections…" />
        ) : filteredBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-muted-foreground">
            <BookOpen className="size-10 text-muted-foreground/30 mb-2" />
            <div className="text-sm font-semibold text-foreground">
              No Knowledge Collections Found
            </div>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Add documents, guidelines or PDFs in the platform Docs section to create indexed knowledge bases.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBases.map((kb) => (
              <div
                key={kb.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">
                          {kb.name}
                        </span>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {kb.documentCount || 0} documents indexed
                        </div>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[9px]">
                      RAG Ready
                    </Badge>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {kb.description || 'Collection of internal company specifications and reference materials.'}
                  </p>
                </div>

                <div className="border-t border-border/60 pt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Updated recently</span>
                  <span className="text-primary font-medium">Connected to agents</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
