import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  SearchInput,
  Spinner,
} from '@org/ui';
import { cn } from '@org/utils';
import { FileText, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useIntegrationActionQuery, useIntegrationMutations } from './use-integrations.js';

interface GDocFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
  owners?: Array<{ displayName?: string }>;
}

interface GoogleDocsModalProps {
  workspaceId: string;
  integrationId: string;
  accountEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleDocsModal({
  workspaceId,
  integrationId,
  accountEmail,
  isOpen,
  onClose,
}: GoogleDocsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<GDocFile | null>(null);
  const isSearching = searchQuery.trim().length > 0;

  const listQuery = useIntegrationActionQuery<{ files: GDocFile[] }>(
    workspaceId,
    integrationId,
    isSearching ? 'search_documents' : 'list_documents',
    isSearching ? { query: searchQuery.trim() } : {},
    { enabled: isOpen && !selectedDoc },
  );

  const contentQuery = useIntegrationActionQuery<{ title: string; plainText: string }>(
    workspaceId,
    integrationId,
    'get_document',
    { documentId: selectedDoc?.id },
    { enabled: isOpen && !!selectedDoc },
  );

  const { sync } = useIntegrationMutations(workspaceId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate text-sm">
              Google Docs{accountEmail ? ` — ${accountEmail}` : ''}
            </DialogTitle>
            {!selectedDoc ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Sync now"
                disabled={sync.isPending}
                onClick={() => sync.mutate(integrationId, { onSuccess: () => listQuery.refetch() })}
              >
                <RefreshCw className={cn('size-3.5', sync.isPending && 'animate-spin')} />
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {!selectedDoc ? (
          <div className="px-5 py-2.5 border-b border-border shrink-0">
            <SearchInput value={searchQuery} onValueChange={setSearchQuery} placeholder="Search documents…" className="h-7 text-xs" />
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedDoc ? (
            <div className="p-5 space-y-3">
              <button type="button" onClick={() => setSelectedDoc(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                ← Back to documents
              </button>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{selectedDoc.name}</h3>
                {selectedDoc.webViewLink ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedDoc.webViewLink} target="_blank" rel="noreferrer">
                      Open in Google Docs
                    </a>
                  </Button>
                ) : null}
              </div>
              {contentQuery.isLoading ? (
                <div className="py-8 flex justify-center">
                  <Spinner label="Loading document…" />
                </div>
              ) : contentQuery.isError ? (
                <ErrorState
                  title="Couldn't load this document"
                  description={contentQuery.error instanceof Error ? contentQuery.error.message : 'Please try again.'}
                  onRetry={() => contentQuery.refetch()}
                />
              ) : (
                <div className="rounded-lg border border-border bg-surface-inset p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {contentQuery.data?.plainText || 'This document has no readable text content.'}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                This is the document's real text — ask the AI assistant to summarize or extract from it and it will read exactly what's shown above.
              </p>
            </div>
          ) : listQuery.isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner label="Loading documents…" />
            </div>
          ) : listQuery.isError ? (
            <ErrorState
              title="Couldn't load your documents"
              description={listQuery.error instanceof Error ? listQuery.error.message : 'Please try again.'}
              onRetry={() => listQuery.refetch()}
            />
          ) : (listQuery.data?.files?.length ?? 0) === 0 ? (
            <EmptyState title="No documents found" description={isSearching ? 'No documents match your search.' : 'Create a doc in Google Docs to see it here.'} />
          ) : (
            <div className="divide-y divide-border">
              {(listQuery.data?.files ?? []).map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className="w-full px-5 py-2.5 gap-3 flex items-center text-left transition-colors hover:bg-surface-inset"
                >
                  <FileText className="size-4 shrink-0 text-accent-blue" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{doc.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {doc.owners?.[0]?.displayName ? `${doc.owners[0].displayName} · ` : ''}
                      {doc.modifiedTime ? new Date(doc.modifiedTime).toLocaleDateString() : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
