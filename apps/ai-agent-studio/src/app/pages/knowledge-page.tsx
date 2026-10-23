import { ApiError, integrationsApi } from '@org/api-client';
import type {
  KnowledgeAnswer,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeRetrievalMode,
  KnowledgeRetrievalResult,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Checkbox,
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
  Switch,
  Textarea,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, DatabaseZap, Eye, FileText, Globe, MessageSquareQuote, Plus, RefreshCw, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAiModels, useAiProviders } from '../components/workflow-canvas/agent-config/use-agent-config-data.js';
import { knowledgeService, type NewSource } from '../services/knowledgeService.js';
import { useStudioSession } from '../session-guard.js';

type SourceKind = NewSource['kind'];

const PLATFORM_EMBEDDING_MODEL = 'nvidia/nemotron-3.5-embed-1b';

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
  const [rerank, setRerank] = useState(true);
  const [rerankStrategy, setRerankStrategy] = useState<'LEXICAL' | 'MODEL'>('LEXICAL');
  const [answerResult, setAnswerResult] = useState<KnowledgeAnswer | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [sourceSitemap, setSourceSitemap] = useState(false);
  const [appIntegrationId, setAppIntegrationId] = useState('');
  const [appQuery, setAppQuery] = useState('');
  const [appPicked, setAppPicked] = useState<Record<string, string>>({});

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEmbeddingModel, setNewEmbeddingModel] = useState('');

  const [isReindexOpen, setIsReindexOpen] = useState(false);
  const [reindexModel, setReindexModel] = useState('');

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
    // Uploads and imports index in the background: follow them until they settle.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((d) => d.status === 'QUEUED' || d.status === 'PROCESSING') ? 2_000 : false,
  });

  const usageQuery = useQuery({
    queryKey: [...listKey, activeKb?.id, 'usage'],
    queryFn: () => knowledgeService.usage(workspaceId, activeKb!.id, 7),
    enabled: !!activeKb,
  });
  const usage = usageQuery.data;

  const appsQuery = useQuery({
    queryKey: ['knowledge-apps', workspaceId],
    queryFn: async () =>
      (await integrationsApi.list(workspaceId)).filter(
        (i) => (i.provider === 'GOOGLE_DRIVE' || i.provider === 'NOTION') && i.status === 'CONNECTED',
      ),
    enabled: isAddSourceOpen && sourceKind === 'app',
  });
  const activeApp = (appsQuery.data ?? []).find((i) => i.id === appIntegrationId) ?? appsQuery.data?.[0];
  const appItemsQuery = useQuery({
    queryKey: ['knowledge-app-items', workspaceId, activeApp?.id, appQuery],
    queryFn: () => knowledgeService.browseApp(workspaceId, activeApp!.id, appQuery.trim() || undefined),
    enabled: isAddSourceOpen && sourceKind === 'app' && !!activeApp,
  });

  const previewQuery = useQuery({
    queryKey: [...listKey, activeKb?.id, 'document', previewDocId],
    queryFn: () => knowledgeService.getDocument(workspaceId, activeKb!.id, previewDocId!),
    enabled: !!activeKb && !!previewDocId,
  });
  const documents = documentsQuery.data ?? [];
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);

  const models = useAiModels();
  const providers = useAiProviders();
  // Embedding models grouped by provider, connected providers first, so the
  // default is one that can actually embed (e.g. NVIDIA when only Nemotron is set up).
  const embeddingGroups = useMemo(() => {
    const byProvider = new Map<string, NonNullable<typeof models.data>>();
    for (const m of (models.data ?? []).filter((x) => x.type === 'embedding' && x.enabled !== false)) {
      byProvider.set(m.provider, [...(byProvider.get(m.provider) ?? []), m]);
    }
    const groups = [...byProvider.entries()]
      .map(([provider, ms]) => {
        const p = providers.data?.find((x) => x.id === provider);
        const connected = !p || p.status === 'CONNECTED' || !p.requiresApiKey;
        return {
          connected,
          label: `${p?.name ?? provider}${connected ? '' : ' — not connected'}`,
          options: ms.map((m) => ({
            value: m.model,
            label: (m.name || m.model).replace(/\s*\(NVIDIA\)$/, ''),
            description: connected ? m.model : 'Connect the provider to use it',
          })),
        };
      })
      .sort((a, b) => Number(b.connected) - Number(a.connected) || a.label.localeCompare(b.label));
    // The catalog can lag the platform (or fail to load); never leave the
    // picker empty: the platform's own NVIDIA model is always offered.
    if (!groups.some((g) => g.options.some((o) => o.value === PLATFORM_EMBEDDING_MODEL))) {
      groups.unshift({
        connected: true,
        label: 'NVIDIA',
        options: [{ value: PLATFORM_EMBEDDING_MODEL, label: 'Nemotron 3.5 Embed 1B', description: 'Platform default' }],
      });
    }
    return groups;
  }, [models.data, providers.data]);
  const withCurrent = (current?: string) =>
    current && !embeddingGroups.some((g) => g.options.some((o) => o.value === current))
      ? [{ label: 'Current', options: [{ value: current, label: current, description: 'Not in this workspace’s model list' }] }, ...embeddingGroups]
      : embeddingGroups;
  const defaultEmbedding = (embeddingGroups.find((g) => g.connected) ?? embeddingGroups[0])?.options[0]?.value;
  const embeddingOptions = embeddingGroups.flatMap((g) => g.options);

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: listKey });

  const createMutation = useMutation({
    mutationFn: () =>
      knowledgeService.createKnowledgeBase(workspaceId, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        embeddingModel: newEmbeddingModel || defaultEmbedding,
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

  const reindexMutation = useMutation({
    mutationFn: () => knowledgeService.reindex(workspaceId, activeKb!.id, reindexModel || activeKb!.embeddingModel),
    onSuccess: (res) => {
      void refreshAll();
      setIsReindexOpen(false);
      if (res.failed > 0) toast.warning(`Re-indexed ${res.documents - res.failed} of ${res.documents} documents. See the notes on the rest.`);
      else toast.success(`Re-indexed ${res.documents} document${res.documents === 1 ? '' : 's'} with ${res.knowledgeBase.embeddingModel}`);
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
    onSuccess: ({ documents: added, failed }) => {
      void refreshAll();
      setIsAddSourceOpen(false);
      setSourceFile(null);
      setSourceUrl('');
      setSourceSitemap(false);
      setNoteName('');
      setNoteText('');
      const duplicates = added.filter((d) => d.deduplicated).length;
      const fresh = added.length - duplicates;
      if (fresh > 0) toast.success(`Added ${fresh} document${fresh === 1 ? '' : 's'}. Indexing in the background.`);
      if (duplicates > 0) toast.info(`${duplicates} already in this knowledge base (identical content), skipped.`);
      setAppPicked({});
      if (failed.length > 0) toast.warning(`${failed.length} item${failed.length === 1 ? '' : 's'} couldn’t be read: ${failed[0]!.error}`);
    },
  });

  const reindexDocumentMutation = useMutation({
    mutationFn: (documentId: string) => knowledgeService.reindexDocument(workspaceId, activeKb!.id, documentId),
    onSuccess: () => {
      void refreshAll();
      toast.success('Re-indexing queued');
    },
  });

  const answerMutation = useMutation({
    mutationFn: () =>
      knowledgeService.answer(workspaceId, activeKb!.id, testQuery.trim(), {
        topK,
        mode: searchMode,
        scoreThreshold: minScore || undefined,
        rerank,
        rerankStrategy,
      }),
    onSuccess: (res) => {
      setAnswerResult(res);
      void usageQuery.refetch();
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
        rerank,
        rerankStrategy,
      }),
    onSuccess: (results) => {
      setTestResults(results);
      if (results.length === 0) toast.info('Nothing in this knowledge base matched. Try a lower minimum score.');
    },
  });

  const submitSource = () => {
    if (sourceKind === 'file') {
      if (sourceFile) addSourceMutation.mutate({ kind: 'file', file: sourceFile });
    } else if (sourceKind === 'app') {
      if (activeApp)
        addSourceMutation.mutate({
          kind: 'app',
          integrationId: activeApp.id,
          items: Object.entries(appPicked).map(([id, name]) => ({ id, name })),
        });
    } else if (sourceKind === 'url') {
      addSourceMutation.mutate({ kind: 'url', url: sourceUrl, sitemap: sourceSitemap });
    } else {
      addSourceMutation.mutate({ kind: 'text', name: noteName, text: noteText });
    }
  };

  const canSubmitSource =
    sourceKind === 'app'
      ? Object.keys(appPicked).length > 0
      : sourceKind === 'file' ? !!sourceFile : sourceKind === 'url' ? /^https?:\/\//i.test(sourceUrl.trim()) : noteText.trim().length > 0;

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
    <Page className="space-y-6">
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
                        ? 'border-foreground/30 bg-selected shadow-xs'
                        : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex size-8 items-center justify-center rounded-lg ${
                            selected ? 'bg-foreground text-background' : 'bg-surface-raised text-primary'
                          }`}
                        >
                          <BookOpen className="size-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">{kb.name}</div>
                          <div className="text-xs text-muted-foreground">
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
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{kb.description}</p>
                    ) : null}

                    <div className="mt-3 border-t border-border/50 pt-2 font-mono text-2xs text-muted-foreground">
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
                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setReindexModel(activeKb.embeddingModel);
                          setIsReindexOpen(true);
                        }}
                        disabled={documents.length === 0}
                        className="gap-1 text-xs font-semibold"
                      >
                        <DatabaseZap className="size-3" /> Re-index
                      </Button>
                      <Button size="xs" onClick={() => setIsAddSourceOpen(true)} className="gap-1 text-xs font-semibold">
                        <Upload className="size-3" /> Add Source
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                        No documents yet. Click “Add Source” to upload a PDF, DOCX, Markdown, text or CSV file, import a web page or sitemap, or write a note.
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
                                <div className="truncate font-semibold text-foreground">
                                  {doc.name}
                                  {(doc.version ?? 1) > 1 ? (
                                    <span className="ml-1.5 font-mono text-2xs font-normal text-muted-foreground">v{doc.version}</span>
                                  ) : null}
                                </div>
                                {doc.errorMessage ? (
                                  <div className="truncate text-2xs text-destructive">{doc.errorMessage}</div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground">
                              <span>{doc.chunkCount} chunks</span>
                              <Badge variant={STATUS_VARIANT[doc.status] ?? 'outline'} className="text-2xs">
                                {doc.status}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Preview ${doc.name}`}
                                onClick={() => setPreviewDocId(doc.id)}
                                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Re-index ${doc.name}`}
                                onClick={() => reindexDocumentMutation.mutate(doc.id)}
                                disabled={reindexDocumentMutation.isPending || doc.status === 'PROCESSING'}
                                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <DatabaseZap className="size-3.5" />
                              </Button>
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
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={answerMutation.isPending}
                      disabled={!testQuery.trim() || documents.length === 0}
                      onClick={() => answerMutation.mutate()}
                      className="shrink-0 gap-1.5"
                    >
                      <MessageSquareQuote className="size-3.5" /> Ask
                    </Button>
                  </form>

                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Switch checked={rerank} onCheckedChange={setRerank} aria-label="Rerank results" />
                    Rerank results
                  </label>
                  {rerank ? (
                    <SegmentedControl
                      aria-label="Rerank strategy"
                      size="sm"
                      value={rerankStrategy}
                      onChange={setRerankStrategy}
                      options={[
                        { value: 'LEXICAL', label: 'Query coverage' },
                        { value: 'MODEL', label: 'AI grader' },
                      ]}
                    />
                  ) : null}
                  {usage && usage.queries > 0 ? (
                    <p className="font-mono text-2xs text-muted-foreground">
                      Last {usage.windowDays} days: {usage.queries} searches · {usage.answers} answers
                      {usage.ungrounded ? ` (${usage.ungrounded} unanswerable)` : ''} · avg {usage.avgLatencyMs} ms · p95{' '}
                      {usage.p95LatencyMs} ms · {(usage.promptTokens + usage.completionTokens).toLocaleString()} tokens
                      {usage.costUsd > 0 ? ` · ~$${usage.costUsd.toFixed(4)}` : ' · $0 (free model)'}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-raised/40 p-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-foreground">Top-K chunks: {topK}</span>
                      <Slider aria-label="Top K" min={1} max={10} value={[topK]} onValueChange={([v]) => setTopK(v)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-foreground">
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

                  {answerMutation.isError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errorText(answerMutation.error)}
                    </p>
                  ) : null}

                  {answerResult && (
                    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold uppercase tracking-wider text-foreground">Answer</span>
                        <span className="font-mono">
                          {answerResult.latencyMs} ms{answerResult.model ? ` · ${answerResult.model}` : ''}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-foreground">{answerResult.answer}</p>
                      {!answerResult.grounded ? (
                        <p className="text-xs text-muted-foreground">
                          Nothing in this knowledge base supports an answer, so none was generated.
                        </p>
                      ) : null}
                      {answerResult.sources.length > 0 ? (
                        <ol className="space-y-1.5 border-t border-border/50 pt-2">
                          {answerResult.sources.map((src) => (
                            <li key={src.chunkId} className="flex gap-2">
                              <span
                                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md font-mono text-2xs font-bold ${
                                  src.cited ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {src.sourceNumber}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground">
                                  {src.documentName}{' '}
                                  <span className="font-mono text-2xs font-normal text-muted-foreground">
                                    {(src.score * 100).toFixed(0)}%{src.cited ? '' : ' · not cited'}
                                  </span>
                                </div>
                                <p className="line-clamp-3 text-muted-foreground">{src.content}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  )}

                  {searchMutation.isError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errorText(searchMutation.error)}
                    </p>
                  ) : null}

                  {testResults && (
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Retrieved passages ({testResults.length})
                      </div>
                      <ul className="space-y-2">
                        {testResults.map((chunk) => (
                          <li key={chunk.chunkId} className="space-y-2 rounded-xl border border-border bg-card p-3.5 text-xs">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 font-bold text-foreground">
                                <FileText className="size-3 text-primary" />
                                {chunk.documentName}
                              </span>
                              <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-2xs font-bold text-success">
                                {(chunk.score * 100).toFixed(1)}% match
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{chunk.content}</p>
                            {chunk.citation ? (
                              <div className="border-t border-border/50 pt-1 font-mono text-2xs text-muted-foreground">
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
                <Label htmlFor="kb-name" className="text-xs font-semibold text-foreground">
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
                <Label htmlFor="kb-desc" className="text-xs font-semibold text-foreground">
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
                <Label className="text-xs font-semibold text-foreground">Embedding model</Label>
                <AppSelect
                  value={newEmbeddingModel || defaultEmbedding}
                  loading={models.isLoading || providers.isLoading}
                  placeholder="Workspace default"
                  onValueChange={setNewEmbeddingModel}
                  options={embeddingGroups}
                />
                <p className="text-xs text-muted-foreground">
                  Fixed once documents are indexed: vectors from different models can’t be compared.
                </p>
                {embeddingOptions.length === 0 && !models.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    No embedding model is listed for this workspace; the platform default (NVIDIA Nemotron Embed) is used.
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

      {/* Re-index */}
      <Dialog open={isReindexOpen} onOpenChange={setIsReindexOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <DatabaseZap className="size-4 text-primary" /> Re-index {activeKb?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Re-embeds every chunk. Use it after switching the embedding model, or to enable semantic search on documents added earlier.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2 py-4 text-xs">
            <Label className="text-xs font-semibold text-foreground">Embedding model</Label>
            <AppSelect
              value={reindexModel}
              loading={models.isLoading || providers.isLoading}
              onValueChange={setReindexModel}
              options={withCurrent(activeKb?.embeddingModel)}
            />
            {reindexMutation.isError ? (
              <p className="text-xs text-destructive" role="alert">
                {errorText(reindexMutation.error)}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsReindexOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={reindexMutation.isPending} onClick={() => reindexMutation.mutate()}>
              Re-index now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document preview */}
      <Dialog open={!!previewDocId} onOpenChange={(open) => !open && setPreviewDocId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <FileText className="size-4 text-primary" /> {previewQuery.data?.name ?? 'Document'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewQuery.data
                ? `${previewQuery.data.chunkCount} chunks · ${previewQuery.data.tokenCount.toLocaleString()} tokens · v${previewQuery.data.version ?? 1}${previewQuery.data.sourceUri ? ` · ${previewQuery.data.sourceUri}` : ''}`
                : 'Extracted text'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="py-4">
            {previewQuery.isLoading ? (
              <LoadingState label="Loading preview…" />
            ) : previewQuery.isError ? (
              <p className="text-xs text-destructive" role="alert">
                {errorText(previewQuery.error)}
              </p>
            ) : (
              <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-raised/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {previewQuery.data?.rawText || 'No text stored for this document.'}
              </pre>
            )}
          </DialogBody>
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
                  { value: 'file', label: 'File' },
                  { value: 'url', label: 'Web page' },
                  { value: 'app', label: 'Drive / Notion' },
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
                    accept=".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.png,.jpg,.jpeg,.bmp"
                    onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="size-4" />
                    {sourceFile ? sourceFile.name : 'Choose a file'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, TXT, Markdown, CSV or a PNG/JPG/BMP image, up to 20 MB. Scans and images are read with OCR (English), which is slower.
                  </p>
                </div>
              )}

              {sourceKind === 'url' && (
                <div className="space-y-1">
                  <Label htmlFor="kb-url" className="text-xs font-semibold text-foreground">
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
                  <p className="text-xs text-muted-foreground">
                    The page is fetched once and converted to text. Add it again to refresh: changed content becomes a new
                    version, identical content is skipped.
                  </p>
                  <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-foreground">
                    <Switch checked={sourceSitemap} onCheckedChange={setSourceSitemap} aria-label="URL is a sitemap" />
                    This URL is a sitemap (import up to 20 pages from the same site)
                  </label>
                </div>
              )}

              {sourceKind === 'app' && (
                <div className="space-y-2">
                  {appsQuery.isLoading ? (
                    <LoadingState label="Loading connected apps…" />
                  ) : (appsQuery.data ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                      No Google Drive or Notion account is connected to this workspace. Connect one in Integrations first.
                    </p>
                  ) : (
                    <>
                      <AppSelect
                        value={activeApp?.id}
                        onValueChange={(v) => {
                          setAppIntegrationId(v);
                          setAppPicked({});
                        }}
                        options={(appsQuery.data ?? []).map((i) => ({
                          value: i.id,
                          label: `${i.provider === 'NOTION' ? 'Notion' : 'Google Drive'}${i.displayName ? ` · ${i.displayName}` : ''}`,
                        }))}
                      />
                      <Input
                        type="search"
                        value={appQuery}
                        onChange={(e) => setAppQuery(e.target.value)}
                        placeholder="Search files or pages…"
                        aria-label="Search the connected app"
                        className="text-xs"
                      />
                      {appItemsQuery.isLoading ? (
                        <LoadingState label="Loading…" />
                      ) : appItemsQuery.isError ? (
                        <p className="text-xs text-destructive" role="alert">
                          {errorText(appItemsQuery.error)}
                        </p>
                      ) : (
                        <ul className="max-h-56 space-y-1 overflow-auto rounded-lg border border-border p-1.5">
                          {(appItemsQuery.data ?? []).length === 0 ? (
                            <li className="p-2 text-center text-xs text-muted-foreground">Nothing found.</li>
                          ) : (
                            (appItemsQuery.data ?? []).map((item) => (
                              <li key={item.id}>
                                <label className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-surface-raised/60">
                                  <Checkbox
                                    checked={item.id in appPicked}
                                    onCheckedChange={(on) =>
                                      setAppPicked((prev) => {
                                        const next = { ...prev };
                                        if (on) next[item.id] = item.name;
                                        else delete next[item.id];
                                        return next;
                                      })
                                    }
                                    aria-label={`Select ${item.name}`}
                                  />
                                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.name}</span>
                                  <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                                    {item.kind.replace('application/vnd.google-apps.', '')}
                                  </span>
                                </label>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {Object.keys(appPicked).length} selected (up to 25). Importing again later updates the document as a new
                        version when the content changed.
                      </p>
                    </>
                  )}
                </div>
              )}

              {sourceKind === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="kb-note-name" className="text-xs font-semibold text-foreground">
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
                    <Label htmlFor="kb-note-text" className="text-xs font-semibold text-foreground">
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
