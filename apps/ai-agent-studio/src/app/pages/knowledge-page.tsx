import { ApiError } from '@org/api-client';
import type { KnowledgeBase, KnowledgeDocument, KnowledgeRetrievalMode, KnowledgeRetrievalResult } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  SegmentedControl,
  Slider,
  Textarea,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Globe, Plus, RefreshCw, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAiModels } from '../components/workflow-canvas/agent-config/use-agent-config-data.js';
import { knowledgeService, type NewSource } from '../services/knowledgeService.js';
import { useStudioSession } from '../session-guard.js';

type SourceKind = NewSource['kind'];

const errorText = (err: unknown): string =>
  err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';

const STATUS_VARIANT: Record<KnowledgeDocument['status'], 'success' | 'warning' | 'destructive' | 'outline'> = {
  INDEXED: 'success',
  PROCESSING: 'warning',
  QUEUED: 'outline',
  FAILED: 'destructive',
};

export function KnowledgePage() {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('');
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);

  // Retrieval sandbox
  const [testQuery, setTestQuery] = useState('');
  const [searchMode, setSearchMode] = useState<KnowledgeRetrievalMode>('HYBRID');
  const [topK, setTopK] = useState(3);
  const [minScore, setMinScore] = useState(0);
  const [testResults, setTestResults] = useState<KnowledgeRetrievalResult[] | null>(null);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEmbeddingModel, setNewEmbeddingModel] = useState('');

  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<SourceKind>('file');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [noteName, setNoteName] = useState('');
  const [noteText, setNoteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listKey = ['workspace-knowledge', workspaceId] as const;

  const basesQuery = useQuery({
    queryKey: listKey,
    queryFn: () => knowledgeService.getKnowledgeBases(workspaceId),
  });
  const bases = basesQuery.data ?? [];
  const activeKb: KnowledgeBase | undefined = bases.find((kb) => kb.id === selectedKbId) ?? bases[0];

  const documentsQuery = useQuery({
    queryKey: [...listKey, activeKb?.id, 'documents'],
    queryFn: () => knowledgeService.getDocuments(workspaceId, activeKb!.id),
    enabled: !!activeKb,
  });
  const documents = documentsQuery.data ?? [];
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);

  const models = useAiModels();
  const embeddingOptions = useMemo(
    () =>
      (models.data ?? [])
        .filter((m) => m.type === 'embedding' && m.enabled !== false)
        .map((m) => ({ value: m.model, label: m.name || m.model })),
    [models.data],
  );

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: listKey });

  const createMutation = useMutation({
    mutationFn: () =>
      knowledgeService.createKnowledgeBase(workspaceId, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        embeddingModel: newEmbeddingModel || embeddingOptions[0]?.value,
      }),
    onSuccess: (kb) => {
      void refreshAll();
      setIsCreateOpen(false);
      setNewName('');
      setNewDescription('');
      setSelectedKbId(kb.id);
      toast.success(`Knowledge base “${kb.name}” created`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeService.deleteKnowledgeBase(workspaceId, id),
    onSuccess: (_data, id) => {
      if (selectedKbId === id) setSelectedKbId(null);
      void refreshAll();
      toast.success('Knowledge base deleted');
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: (source: NewSource) => knowledgeService.addSource(workspaceId, activeKb!.id, source),
    onSuccess: (doc) => {
      void refreshAll();
      setIsAddSourceOpen(false);
      setSourceFile(null);
      setSourceUrl('');
      setNoteName('');
      setNoteText('');
      toast.success(`Indexed “${doc.name}” into ${doc.chunkCount} chunks`);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => knowledgeService.deleteDocument(workspaceId, activeKb!.id, documentId),
    onSuccess: () => {
      void refreshAll();
      toast.success('Document removed');
    },
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      knowledgeService.search(workspaceId, activeKb!.id, testQuery.trim(), {
        topK,
        mode: searchMode,
        scoreThreshold: minScore || undefined,
      }),
    onSuccess: (results) => {
      setTestResults(results);
      if (results.length === 0) toast.info('Nothing in this knowledge base matched. Try a lower minimum score.');
    },
  });

  const submitSource = () => {
    if (sourceKind === 'file') {
      if (sourceFile) addSourceMutation.mutate({ kind: 'file', file: sourceFile });
    } else if (sourceKind === 'url') {
      addSourceMutation.mutate({ kind: 'url', url: sourceUrl });
    } else {
      addSourceMutation.mutate({ kind: 'text', name: noteName, text: noteText });
    }
  };

  const canSubmitSource =
    sourceKind === 'file' ? !!sourceFile : sourceKind === 'url' ? /^https?:\/\//i.test(sourceUrl.trim()) : noteText.trim().length > 0;

  const confirmDeleteKb = async (kb: KnowledgeBase) => {
    const ok = await confirm({
      title: `Delete “${kb.name}”?`,
      description: 'Its documents and indexed chunks are removed. Agents that use it will stop retrieving from it.',
      confirmLabel: 'Delete knowledge base',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(kb.id);
  };

  const visibleBases = bases.filter((kb) => {
    const q = filter.trim().toLowerCase();
    return !q || kb.name.toLowerCase().includes(q) || (kb.description ?? '').toLowerCase().includes(q);
  });

  if (basesQuery.isLoading) return <LoadingState label="Loading knowledge bases…" />;
  if (basesQuery.isError) {
    return (
      <ErrorState
        title="Couldn’t load knowledge bases"
        description={errorText(basesQuery.error)}
        onRetry={() => void basesQuery.refetch()}
      />
    );
  }

  return (
    <Page width="wide" padding="none" className="space-y-6">
      <PageHeader
        title="Knowledge Base & RAG Management"
        description={`Index documents for semantic and keyword search that your agents can cite in ${activeWorkspace.name}.`}
        icon={<BookOpen className="size-5" />}
        accent="cyan"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void basesQuery.refetch()}
              loading={basesQuery.isRefetching}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 text-xs font-semibold">
              <Plus className="size-4" /> New Knowledge Base
            </Button>
          </div>
        }
      />

      {bases.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No knowledge bases yet"
          description="Create one, add documents, and agents can search them to ground their answers."
          action={
            <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" /> Create a knowledge base
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Collections */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Knowledge Collections</h2>
            <Input
              type="search"
              leadingIcon={<Search className="size-3.5" />}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter knowledge bases…"
              aria-label="Filter knowledge bases"
              className="text-xs"
            />

            <div className="space-y-2" role="listbox" aria-label="Knowledge bases">
              {visibleBases.map((kb) => {
                const selected = activeKb?.id === kb.id;
                return (
                  <div
                    key={kb.id}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    onClick={() => setSelectedKbId(kb.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedKbId(kb.id);
                      }
                    }}
                    className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      selected
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-raised/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex size-8 items-center justify-center rounded-lg ${
                            selected ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-primary'
                          }`}
                        >
                          <BookOpen className="size-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">{kb.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {kb._count?.documents ?? 0} document{(kb._count?.documents ?? 0) === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        type="button"
                        aria-label={`Delete ${kb.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void confirmDeleteKb(kb);
                        }}
                        className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {kb.description ? (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{kb.description}</p>
                    ) : null}

                    <div className="mt-3 border-t border-border/50 pt-2 font-mono text-[10px] text-muted-foreground">
                      {kb.embeddingModel}
                    </div>
                  </div>
                );
              })}
              {visibleBases.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No knowledge base matches “{filter}”.</p>
              )}
            </div>
          </div>

          {/* Active collection */}
          <div className="space-y-6 lg:col-span-2">
            {activeKb && (
              <>
                <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">{activeKb.name}</h2>
                      {activeKb.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{activeKb.description}</p>
                      ) : null}
                    </div>
                    <Button size="xs" onClick={() => setIsAddSourceOpen(true)} className="gap-1 text-xs font-semibold">
                      <Upload className="size-3" /> Add Source
                    </Button>
                  </div>

                  <div className="space-y-2 border-t border-border pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Indexed documents ({documents.length}) · {totalChunks.toLocaleString()} chunks
                    </div>

                    {documentsQuery.isLoading ? (
                      <LoadingState label="Loading documents…" />
                    ) : documentsQuery.isError ? (
                      <ErrorState
                        title="Couldn’t load documents"
                        description={errorText(documentsQuery.error)}
                        onRetry={() => void documentsQuery.refetch()}
                      />
                    ) : documents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                        No documents yet. Click “Add Source” to upload a text file, read a web page, or write a note.
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {documents.map((doc) => (
                          <li
                            key={doc.id}
                            className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 text-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {doc.sourceType === 'URL' ? (
                                <Globe className="size-4 shrink-0 text-primary" />
                              ) : (
                                <FileText className="size-4 shrink-0 text-primary" />
                              )}
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-foreground">{doc.name}</div>
                                {doc.errorMessage ? (
                                  <div className="truncate text-[10px] text-destructive">{doc.errorMessage}</div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-muted-foreground">
                              <span>{doc.chunkCount} chunks</span>
                              <Badge variant={STATUS_VARIANT[doc.status] ?? 'outline'} className="text-[9px]">
                                {doc.status}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Remove ${doc.name}`}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Remove “${doc.name}”?`,
                                    description: 'The document and its indexed chunks are deleted. Agents using this knowledge base will no longer see it.',
                                    confirmLabel: 'Remove document',
                                    destructive: true,
                                  });
                                  if (ok) deleteDocumentMutation.mutate(doc.id);
                                }}
                                disabled={deleteDocumentMutation.isPending}
                                className="opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Retrieval sandbox */}
                <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Retrieval sandbox</h3>
                    </div>
                    <SegmentedControl
                      aria-label="Search mode"
                      size="sm"
                      value={searchMode}
                      onChange={setSearchMode}
                      options={[
                        { value: 'HYBRID', label: 'Hybrid' },
                        { value: 'SEMANTIC', label: 'Semantic' },
                        { value: 'KEYWORD', label: 'Keyword' },
                      ]}
                    />
                  </div>

                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (testQuery.trim()) searchMutation.mutate();
                    }}
                  >
                    <Input
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      placeholder="Ask a question your agents might get…"
                      aria-label="Test query"
                      className="h-9 text-xs"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={searchMutation.isPending}
                      disabled={!testQuery.trim() || documents.length === 0}
                      className="shrink-0 gap-1.5"
                    >
                      <Search className="size-3.5" /> Test Search
                    </Button>
                  </form>

                  <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-raised/40 p-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground">Top-K chunks: {topK}</span>
                      <Slider aria-label="Top K" min={1} max={10} value={[topK]} onValueChange={([v]) => setTopK(v)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground">
                        Minimum score: {minScore === 0 ? 'any' : minScore.toFixed(2)}
                      </span>
                      <Slider
                        aria-label="Minimum score"
                        min={0}
                        max={0.95}
                        step={0.05}
                        value={[minScore]}
                        onValueChange={([v]) => setMinScore(v)}
                      />
                    </div>
                  </div>

                  {searchMutation.isError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errorText(searchMutation.error)}
                    </p>
                  ) : null}

                  {testResults && (
                    <div className="space-y-3 pt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Retrieved passages ({testResults.length})
                      </div>
                      <ul className="space-y-2">
                        {testResults.map((chunk) => (
                          <li key={chunk.chunkId} className="space-y-2 rounded-xl border border-border bg-card p-3.5 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 font-bold text-foreground">
                                <FileText className="size-3 text-primary" />
                                {chunk.documentName}
                              </span>
                              <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-success">
                                {(chunk.score * 100).toFixed(1)}% match
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{chunk.content}</p>
                            {chunk.citation ? (
                              <div className="border-t border-border/50 pt-1 font-mono text-[10px] text-muted-foreground">
                                {chunk.citation}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create knowledge base */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <BookOpen className="size-4 text-primary" /> Create Knowledge Base
              </DialogTitle>
              <DialogDescription className="text-xs">A collection of documents your agents can search.</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="kb-name" className="text-[11px] font-semibold text-foreground">
                  Name *
                </Label>
                <Input
                  id="kb-name"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Product knowledge"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kb-desc" className="text-[11px] font-semibold text-foreground">
                  Description
                </Label>
                <Input
                  id="kb-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Guides and FAQs for support agents…"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">Embedding model</Label>
                <AppSelect
                  value={newEmbeddingModel || embeddingOptions[0]?.value}
                  loading={models.isLoading}
                  placeholder="Workspace default"
                  onValueChange={setNewEmbeddingModel}
                  options={embeddingOptions}
                />
                {embeddingOptions.length === 0 && !models.isLoading ? (
                  <p className="text-[11px] text-muted-foreground">
                    No embedding model is listed for this workspace; the platform default is used.
                  </p>
                ) : null}
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={createMutation.isPending} disabled={!newName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add source */}
      <Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmitSource) submitSource();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <Upload className="size-4 text-primary" /> Add Document Source
              </DialogTitle>
              <DialogDescription className="text-xs">Index content into {activeKb?.name}.</DialogDescription>
              <SegmentedControl
                className="mt-3"
                aria-label="Source type"
                value={sourceKind}
                onChange={setSourceKind}
                options={[
                  { value: 'file', label: 'Text file' },
                  { value: 'url', label: 'Web page' },
                  { value: 'text', label: 'Note' },
                ]}
              />
            </DialogHeader>

            <DialogBody className="space-y-3.5 py-4 text-xs">
              {sourceKind === 'file' && (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.yaml,.yml,.log,text/*"
                    onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="size-4" />
                    {sourceFile ? sourceFile.name : 'Choose a file'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Text, Markdown, CSV, JSON and HTML up to 2 MB. PDF and Office files can’t be read yet: export them as text
                    or paste the content as a note.
                  </p>
                </div>
              )}

              {sourceKind === 'url' && (
                <div className="space-y-1">
                  <Label htmlFor="kb-url" className="text-[11px] font-semibold text-foreground">
                    Page URL *
                  </Label>
                  <Input
                    id="kb-url"
                    required
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://docs.example.com/guide"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The page is fetched once and converted to markdown. It isn’t re-crawled; add it again to refresh.
                  </p>
                </div>
              )}

              {sourceKind === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="kb-note-name" className="text-[11px] font-semibold text-foreground">
                      Title
                    </Label>
                    <Input
                      id="kb-note-name"
                      value={noteName}
                      onChange={(e) => setNoteName(e.target.value)}
                      placeholder="Refund policy"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kb-note-text" className="text-[11px] font-semibold text-foreground">
                      Content *
                    </Label>
                    <Textarea
                      id="kb-note-text"
                      rows={6}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Q: How do refunds work?&#10;A: Refunds are processed within 3 days."
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {addSourceMutation.isError ? (
                <p className="text-xs text-destructive" role="alert">
                  {errorText(addSourceMutation.error)}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddSourceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={addSourceMutation.isPending} disabled={!canSubmitSource}>
                Index Source
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
