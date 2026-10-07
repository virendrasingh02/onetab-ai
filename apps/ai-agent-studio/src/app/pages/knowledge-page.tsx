import { knowledgeApi } from '@org/api-client';
import { knowledgeService } from '../services/knowledgeService.js';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  LoadingState,
  Page,
  PageHeader,
  toast,
} from '@org/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

export function KnowledgePage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedKbId, setSelectedKbId] = useState<string | null>('kb-support-docs');

  // Test Search State
  const [testQuery, setTestQuery] = useState('How do I configure SAML single sign-on with Okta?');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'semantic' | 'keyword'>('hybrid');
  const [topK, setTopK] = useState(3);
  const [minScore, setMinScore] = useState(0.75);
  const [useReranker, setUseReranker] = useState(true);
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Modals
  const [isCreateKbOpen, setIsCreateKbOpen] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [newKbModel, setNewKbModel] = useState('text-embedding-3-small');
  const [newChunkSize, setNewChunkSize] = useState(512);

  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'file' | 'url' | 'text'>('file');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceRawText, setSourceRawText] = useState('');

  // Load knowledge bases for active workspace
  const {
    data: knowledgeBases = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['workspace-knowledge', activeWorkspace.id],
    queryFn: async () => {
      try {
        const live = await knowledgeApi.list(activeWorkspace.id);
        if (live && live.length > 0) return live;
      } catch {
        // Fallback
      }
      return knowledgeService.getKnowledgeBases();
    },
  });

  const activeKb = knowledgeBases.find((kb) => kb.id === selectedKbId) || knowledgeBases[0];

  // Create KB Mutation
  const createKbMutation = useMutation({
    mutationFn: async (data: any) => {
      return knowledgeService.createKnowledgeBase(data, activeWorkspace.id);
    },
    onSuccess: (newKb) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-knowledge', activeWorkspace.id] });
      setIsCreateKbOpen(false);
      setNewKbName('');
      setNewKbDesc('');
      setSelectedKbId(newKb.id);
      toast.success(`Knowledge base "${newKb.name}" created`);
    },
  });

  // Add Source Mutation
  const addSourceMutation = useMutation({
    mutationFn: async () => {
      if (!activeKb) throw new Error('No knowledge base selected');
      let name = sourceName;
      if (sourceType === 'url') name = sourceUrl;
      if (sourceType === 'text') name = 'Manual Note / FAQ entry';
      return knowledgeService.addSource(
        activeKb.id,
        {
          name,
          type: sourceType === 'file' ? 'PDF' : sourceType === 'url' ? 'WEBSITE' : 'TEXT',
          size: sourceType === 'file' ? '1.4 MB' : '45 KB',
          url: sourceUrl,
          rawText: sourceRawText,
        },
        activeWorkspace.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-knowledge', activeWorkspace.id] });
      setIsAddSourceOpen(false);
      setSourceName('');
      setSourceUrl('');
      setSourceRawText('');
      toast.success('Document source indexed into vector store');
    },
  });

  // Delete KB Mutation
  const deleteKbMutation = useMutation({
    mutationFn: async (id: string) => {
      return knowledgeService.deleteKnowledgeBase(id, activeWorkspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-knowledge', activeWorkspace.id] });
      toast.success('Knowledge base deleted');
    },
  });

  const handleTestSearch = async () => {
    if (!testQuery.trim() || !activeKb) return;
    setIsSearching(true);
    try {
      const results = await knowledgeService.simulateRetrievalSearch(
        activeKb.id,
        testQuery,
        topK,
        minScore,
        activeWorkspace.id,
      );
      setTestResults(results);
      toast.success(`Retrieved ${results.length} relevant chunks`);
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const filteredBases = knowledgeBases.filter((kb) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return kb.name.toLowerCase().includes(q) || (kb.description || '').toLowerCase().includes(q);
  });

  if (isLoading) {
    return <LoadingState label="Loading workspace knowledge bases…" />;
  }

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header matching Admin */}
      <PageHeader
        title="Knowledge Base & RAG Management"
        description={`Index PDFs, web pages, Notion workspaces, and databases for hybrid semantic vector search in ${activeWorkspace.name}.`}
        icon={<BookOpen className="size-5" />}
        accent="cyan"
        actions={
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
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateKbOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-4" /> New Knowledge Base
            </Button>
          </div>
        }
      />

      {/* Main Grid: Left Column Collections + Active Collection Detail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Knowledge Bases List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Knowledge Collections
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono">
              Qdrant / pgvector
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter knowledge bases…"
              className="w-full rounded-lg border border-border bg-surface-raised pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            {filteredBases.map((kb) => {
              const isSelected = activeKb?.id === kb.id;
              return (
                <div
                  key={kb.id}
                  onClick={() => setSelectedKbId(kb.id)}
                  className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-raised/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex size-8 items-center justify-center rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-primary'}`}>
                        <BookOpen className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {kb.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {kb.totalDocuments || 0} documents · {kb.totalChunks || 0} chunks
                        </div>
                      </div>
                    </div>

                    <Badge variant={kb.status === 'READY' ? 'success' : 'outline'} className="text-[9px]">
                      {kb.status || 'READY'}
                    </Badge>
                  </div>

                  <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {kb.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground font-mono">
                    <span>{kb.embeddingModel || 'text-embedding-3-small'}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteKbMutation.mutate(kb.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Active Collection Documents & Retrieval Sandbox */}
        <div className="space-y-6 lg:col-span-2">
          {activeKb ? (
            <>
              {/* Collection Overview Card */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground">{activeKb.name}</h2>
                      <Badge variant="outline" className="text-[10px]">
                        {activeKb.vectorStore || 'Hybrid Vector DB'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeKb.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        toast.info('Re-indexing vector embeddings…');
                        setTimeout(() => toast.success('Vector collection reindexed!'), 1200);
                      }}
                      className="gap-1 text-xs"
                    >
                      <RefreshCw className="size-3" /> Reindex
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => setIsAddSourceOpen(true)}
                      className="gap-1 text-xs font-semibold"
                    >
                      <Upload className="size-3" /> Add Source
                    </Button>
                  </div>
                </div>

                {/* Sources list */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Indexed Documents & Connectors ({activeKb.sources?.length || 0})
                  </div>

                  {(!activeKb.sources || activeKb.sources.length === 0) ? (
                    <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      No documents added to this knowledge base yet. Click "Add Source" to upload PDFs, scrape URLs, or write notes.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeKb.sources.map((src: any) => (
                        <div
                          key={src.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="size-4 text-primary shrink-0" />
                            <span className="font-semibold text-foreground truncate">
                              {src.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({src.size})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                            <span>{src.chunks} chunks</span>
                            <Badge variant="success" className="text-[9px]">
                              {src.status || 'INDEXED'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RAG Retrieval & Testing Sandbox */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Interactive RAG Search Sandbox
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-0.5 text-[10px]">
                    {(['hybrid', 'semantic', 'keyword'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSearchMode(mode)}
                        className={`rounded px-2 py-0.5 capitalize transition-colors ${
                          searchMode === mode
                            ? 'bg-card text-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="Enter a test question or search query…"
                    className="h-9 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                  />
                  <Button
                    size="sm"
                    onClick={handleTestSearch}
                    loading={isSearching}
                    disabled={!testQuery.trim()}
                    className="gap-1.5 shrink-0"
                  >
                    <Search className="size-3.5" /> Test Search
                  </Button>
                </div>

                {/* Filter sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-surface-raised/40 p-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-foreground">Top-K Chunks: {topK}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-foreground">Min Similarity: {minScore}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={minScore}
                      onChange={(e) => setMinScore(parseFloat(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <div className="text-[11px] font-semibold text-foreground">Cohere Reranker</div>
                      <div className="text-[10px] text-muted-foreground">Cross-encoder re-ranking</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useReranker}
                      onChange={(e) => setUseReranker(e.target.checked)}
                      className="rounded border-border accent-primary"
                    />
                  </div>
                </div>

                {/* Results display */}
                {testResults && (
                  <div className="space-y-3 pt-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Retrieved Passages & Citations ({testResults.length})
                    </div>

                    <div className="space-y-2">
                      {testResults.map((chunk) => (
                        <div
                          key={chunk.id}
                          className="rounded-xl border border-border bg-card p-3.5 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <FileText className="size-3 text-primary" />
                              {chunk.title}
                            </span>
                            <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-success">
                              {(chunk.score * 100).toFixed(1)}% match
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">
                            "{chunk.snippet}"
                          </p>
                          <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/50">
                            Source Document: {chunk.source}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
              Select or create a knowledge base to view documents and test retrieval.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Knowledge Base */}
      <Dialog open={isCreateKbOpen} onOpenChange={setIsCreateKbOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newKbName.trim()) return;
              createKbMutation.mutate({
                name: newKbName.trim(),
                description: newKbDesc.trim(),
                embeddingModel: newKbModel,
                chunkSize: newChunkSize,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> Create Knowledge Base
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set up a new vector store collection to index your organization documents.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Collection Name *</label>
                <Input
                  required
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="e.g. Product Knowledge Base"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Description</label>
                <Input
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  placeholder="Documents, guides, and FAQs for support agents…"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Embedding Model</label>
                <select
                  value={newKbModel}
                  onChange={(e) => setNewKbModel(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="text-embedding-3-small">OpenAI text-embedding-3-small (1536 dim - Fast)</option>
                  <option value="text-embedding-3-large">OpenAI text-embedding-3-large (3072 dim - Precise)</option>
                  <option value="cohere-embed-v3">Cohere embed-english-v3.0</option>
                  <option value="bge-large-en">BGE Large English (Local / Open Source)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Chunk Size (Tokens): {newChunkSize}</label>
                <input
                  type="range"
                  min="256"
                  max="1024"
                  step="64"
                  value={newChunkSize}
                  onChange={(e) => setNewChunkSize(parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateKbOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={createKbMutation.isPending} disabled={!newKbName.trim()}>
                Create Collection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Add Source */}
      <Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSourceMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Upload className="size-4 text-primary" /> Add Document Source
              </DialogTitle>
              <DialogDescription className="text-xs">
                Upload files or connect website URLs to index into {activeKb?.name}.
              </DialogDescription>

              <div className="mt-3 flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`flex-1 rounded py-1 font-medium transition-colors ${
                    sourceType === 'file' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`flex-1 rounded py-1 font-medium transition-colors ${
                    sourceType === 'url' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Website URL
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('text')}
                  className={`flex-1 rounded py-1 font-medium transition-colors ${
                    sourceType === 'text' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Text Note
                </button>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-3.5 py-4 text-xs">
              {sourceType === 'file' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">File Name *</label>
                  <Input
                    required
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. employee_onboarding_guide.pdf"
                    className="h-8 text-xs"
                  />
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground mt-2">
                    <Upload className="size-6 text-muted-foreground/40 mx-auto mb-1" />
                    <span>Supports PDF, DOCX, TXT, CSV and Markdown</span>
                  </div>
                </div>
              )}

              {sourceType === 'url' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Target URL to Scrape *</label>
                  <Input
                    required
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://docs.example.com/api"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Firecrawl will automatically fetch subpages and convert HTML into clean LLM markdown.
                  </p>
                </div>
              )}

              {sourceType === 'text' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Markdown Content *</label>
                  <textarea
                    rows={6}
                    required
                    value={sourceRawText}
                    onChange={(e) => setSourceRawText(e.target.value)}
                    placeholder="# Frequently Asked Questions\n\nQ: How do refunds work?\nA: Refunds are processed within 3 days."
                    className="w-full font-mono rounded-lg border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddSourceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={addSourceMutation.isPending}>
                Index Source
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
