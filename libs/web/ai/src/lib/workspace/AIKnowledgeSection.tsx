import { knowledgeApi, queryKeys } from '@org/api-client';
import type { KnowledgeBase, KnowledgeRetrievalResult } from '@org/types';
import {
  Badge,
  Button,
  Card,
  confirm,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Hint,
  Input,
  LoadingState,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useWorkspacePermission } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorText, useWorkspaceIds } from './use-ai-workspace.js';

/**
 * Knowledge bases agents retrieve from. An agent's Knowledge node picks one of
 * these; at run time the top passages for the question are added to its
 * context and cited by document name.
 */
export function AIKnowledgeSection() {
  const { workspaceId } = useWorkspaceIds();
  const { can } = useWorkspacePermission();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({
    queryKey: queryKeys.knowledge.list(workspaceId ?? ''),
    queryFn: () => knowledgeApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const bases = list.data ?? [];
  const selected = bases.find((kb) => kb.id === selectedId) ?? bases[0] ?? null;

  const removeBase = useMutation({
    mutationFn: (id: string) => knowledgeApi.delete(workspaceId as string, id),
    onSuccess: () => {
      toast.success('Knowledge base deleted');
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(workspaceId ?? '') });
    },
    onError: (err) => toast.error('Could not delete it', { description: errorText(err) }),
  });

  if (list.isLoading) return <LoadingState label="Loading knowledge bases…" />;
  if (list.isError) return <ErrorState title="Couldn't load knowledge bases" onRetry={() => void list.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Add documents here, then attach a knowledge base to an agent with a Knowledge node. The agent
          receives the most relevant passages for each question and cites them.
        </p>
        {can('create') ? (
          <Button leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>
            New knowledge base
          </Button>
        ) : null}
      </div>

      {bases.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No knowledge bases yet"
          description="Create one and paste in policies, product docs or FAQs your agents should answer from."
          action={
            can('create') ? (
              <Button leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>
                New knowledge base
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <nav aria-label="Knowledge bases" className="space-y-2">
            {bases.map((kb) => (
              <button
                key={kb.id}
                type="button"
                onClick={() => setSelectedId(kb.id)}
                aria-current={selected?.id === kb.id ? 'true' : undefined}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected?.id === kb.id
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{kb.name}</span>
                  <Badge variant="neutral" className="shrink-0 text-[10px]">
                    {kb._count?.documents ?? 0} docs
                  </Badge>
                </div>
                {kb.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{kb.description}</p>
                ) : null}
              </button>
            ))}
          </nav>

          {selected ? (
            <KnowledgeBaseDetail
              key={selected.id}
              workspaceId={workspaceId as string}
              base={selected}
              canEdit={can('create')}
              canDelete={can('delete')}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Delete “${selected.name}”?`,
                  description:
                    'Its documents and passages are deleted too. Agents using it stop receiving its context. This cannot be undone.',
                  destructive: true,
                });
                if (ok) removeBase.mutate(selected.id);
              }}
            />
          ) : null}
        </div>
      )}

      <CreateKnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId as string}
        onCreated={(kb) => setSelectedId(kb.id)}
      />
    </div>
  );
}

function KnowledgeBaseDetail({
  workspaceId,
  base,
  canEdit,
  canDelete,
  onDelete,
}: {
  workspaceId: string;
  base: KnowledgeBase;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [ingestOpen, setIngestOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeRetrievalResult[] | null>(null);

  const documents = useQuery({
    queryKey: queryKeys.knowledge.documents(workspaceId, base.id),
    queryFn: () => knowledgeApi.listDocuments(workspaceId, base.id),
  });

  const removeDoc = useMutation({
    mutationFn: (documentId: string) => knowledgeApi.deleteDocument(workspaceId, base.id, documentId),
    onSuccess: () => {
      toast.success('Document removed');
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(workspaceId) });
    },
    onError: (err) => toast.error('Could not remove the document', { description: errorText(err) }),
  });

  const search = useMutation({
    mutationFn: (q: string) => knowledgeApi.testRetrieval(workspaceId, base.id, { query: q, topK: 5 }),
    onSuccess: (hits) => setResults(hits),
    onError: (err) => toast.error('Search failed', { description: errorText(err) }),
  });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) search.mutate(query.trim());
  };

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{base.name}</h2>
          {base.description ? <p className="text-sm text-muted-foreground">{base.description}</p> : null}
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <Button size="sm" leadingIcon={<Plus />} onClick={() => setIngestOpen(true)}>
              Add document
            </Button>
          ) : null}
          {canDelete ? (
            <Hint label="Delete knowledge base">
              <Button variant="ghost" size="icon-sm" aria-label="Delete knowledge base" onClick={onDelete}>
                <Trash2 className="size-4" />
              </Button>
            </Hint>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="kb-docs">
        <h3 id="kb-docs" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </h3>
        {documents.isLoading ? (
          <LoadingState label="Loading documents…" />
        ) : (documents.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet. Add one to start answering from it.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(documents.data ?? []).map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate text-foreground">{doc.name}</span>
                  <Badge
                    variant={doc.status === 'INDEXED' ? 'success' : doc.status === 'FAILED' ? 'destructive' : 'neutral'}
                    className="shrink-0 text-[10px]"
                  >
                    {doc.status.toLowerCase()}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">{doc.chunkCount} passages</span>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${doc.name}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove “${doc.name}”?`,
                          description: 'Agents stop citing it. This cannot be undone.',
                          destructive: true,
                          confirmLabel: 'Remove',
                        });
                        if (ok) removeDoc.mutate(doc.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="kb-test" className="border-t border-border pt-4">
        <h3 id="kb-test" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Try a question
        </h3>
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would someone ask an agent?"
            aria-label="Test question"
          />
          <Button type="submit" leadingIcon={<Search />} loading={search.isPending} disabled={!query.trim()}>
            Search
          </Button>
        </form>
        {results ? (
          results.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing relevant found for that question.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {results.map((hit) => (
                <li key={hit.chunkId} className="rounded-lg border border-border bg-surface-inset p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">{hit.documentName}</span>
                    <span className="tabular-nums text-muted-foreground">relevance {hit.score.toFixed(2)}</span>
                  </div>
                  <p className="line-clamp-4 text-muted-foreground">{hit.content}</p>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </section>

      <IngestDocumentDialog
        open={ingestOpen}
        onOpenChange={setIngestOpen}
        workspaceId={workspaceId}
        base={base}
      />
    </Card>
  );
}

function CreateKnowledgeBaseDialog({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: (kb: KnowledgeBase) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useMutation({
    mutationFn: () =>
      knowledgeApi.create(workspaceId, { name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (kb) => {
      toast.success('Knowledge base created');
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(workspaceId) });
      onCreated(kb);
      setName('');
      setDescription('');
      onOpenChange(false);
    },
    onError: (err) => toast.error('Could not create it', { description: errorText(err) }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>New knowledge base</DialogTitle>
            <DialogDescription>A collection of documents agents can retrieve from.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support handbook" />
            </Field>
            <Field label="Description" optional>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What does it cover?"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IngestDocumentDialog({
  open,
  onOpenChange,
  workspaceId,
  base,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  base: KnowledgeBase;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const ingest = useMutation({
    mutationFn: () =>
      knowledgeApi.ingestDocument(workspaceId, base.id, {
        name: name.trim(),
        rawText: text,
        sourceType: 'MANUAL',
      }),
    onSuccess: () => {
      toast.success('Document added', { description: 'It is split into passages and indexed.' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(workspaceId) });
      setName('');
      setText('');
      onOpenChange(false);
    },
    onError: (err) => toast.error('Could not add the document', { description: errorText(err) }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && text.trim()) ingest.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a document to {base.name}</DialogTitle>
            <DialogDescription>Paste text or Markdown. It is split into passages and indexed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Field label="Title" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Refund policy" />
            </Field>
            <Field label="Content" required hint={`${text.length.toLocaleString()} characters`}>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder="Paste the document here…"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={ingest.isPending} disabled={!name.trim() || !text.trim()}>
              Add document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
