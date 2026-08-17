import {
  Badge,
  Button,
  EmptyState,
  Page,
  PageHeader,
  Panel,
  SkeletonList,
  usePromptDialog,
} from '@org/ui';
import { useCurrentUser } from '@org/auth';
import { useCurrentWorkspace } from '@org/web-workspace';
import { CheckCircle, FileText, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocHeader } from './docs/DocHeader.js';
import { DocSidebar } from './docs/DocSidebar.js';
import { DocToolsDrawer } from './docs/DocToolsDrawer.js';
import type { NotionBlock } from './docs/doc-types.js';
import { NotionBlockEditor } from './docs/NotionBlockEditor.js';
import { useDocsWorkspace } from './docs/use-docs.js';

/**
 * How long the editor sits idle before a block edit is sent.
 *
 * `NotionBlockEditor` reports a new block array on every keystroke; each one is
 * a `PATCH` of the whole document, so they are coalesced rather than sent as
 * typed. Short enough that "Saved" appears while the user is still looking at
 * the page.
 */
const SAVE_DEBOUNCE_MS = 800;

export function DocumentEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const docsWorkspace = useDocsWorkspace(workspaceId);
  /* Teamspace create/rename/delete used `prompt()` and `confirm()`. Those are
     unthemed, block the main thread, and Electron dropped `prompt()` entirely —
     in the desktop build the rename simply did nothing. */
  const prompts = usePromptDialog();

  const {
    companies,
    docs,
    isLoading,
    isError,
    addCompany,
    renameCompany,
    deleteCompany,
    moveDocToCompany,
    updateDocTitle,
    updateDocCategory,
    updateDocStatus,
    updateDocCover,
    updateDocIcon,
    toggleFavorite,
    updateDocBlocks,
    addComment,
    createDoc,
    duplicateDoc,
    deleteDoc,
    isSaving,
  } = docsWorkspace;

  const docParam = searchParams.get('doc');
  const currentDoc = useMemo(
    () => docs.find((doc) => doc.id === docParam) ?? docs[0],
    [docs, docParam],
  );

  const openDoc = useCallback(
    (docId: string) => setSearchParams({ doc: docId }),
    [setSearchParams],
  );

  /*
   * `?newDoc=true` is a one-shot instruction, so the guard is a ref rather than
   * state: re-running the effect must not create a second document.
   */
  const handledNewDoc = useRef(false);
  useEffect(() => {
    if (searchParams.get('newDoc') !== 'true' || handledNewDoc.current) return;
    if (!workspaceId || companies.length === 0) return;

    handledNewDoc.current = true;
    void createDoc().then((id) => {
      if (id) setSearchParams({ doc: id });
    });
  }, [companies.length, createDoc, searchParams, setSearchParams, workspaceId]);

  /* ------------------------------------------------------- block saving --- */

  const [pendingBlocks, setPendingBlocks] = useState<NotionBlock[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The edit that has not reached the server yet.
   *
   * Mirrors `pendingBlocks` so the unmount handler and the document switch can
   * commit it without either of them depending on the state — a cleanup that
   * closed over `pendingBlocks` would re-register on every keystroke, and would
   * see a stale value when it finally ran.
   */
  const pending = useRef<{ docId: string; blocks: NotionBlock[] } | null>(null);

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const outstanding = pending.current;
    pending.current = null;
    if (!outstanding) return;

    updateDocBlocks(outstanding.docId, outstanding.blocks);
    setPendingBlocks(null);
    setSavedAt(Date.now());
  }, [updateDocBlocks]);

  const handleBlocksChange = useCallback(
    (blocks: NotionBlock[]) => {
      if (!currentDoc) return;
      // Held locally so the editor stays responsive between saves; the query
      // cache catches up when the debounce fires.
      setPendingBlocks(blocks);
      pending.current = { docId: currentDoc.id, blocks };

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [currentDoc, flush],
  );

  // Leaving the page must not drop an edit mid-debounce.
  useEffect(() => () => flush(), [flush]);

  const activeDocId = currentDoc?.id;
  useEffect(() => {
    // Switching documents commits whatever the previous one had outstanding,
    // rather than discarding it along with the local copy.
    if (pending.current && pending.current.docId !== activeDocId) flush();
    setPendingBlocks(null);
  }, [activeDocId, flush]);

  // The badge is transient: it confirms a save happened, it is not a status.
  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const blocks = pendingBlocks ?? currentDoc?.blocks ?? [];

  /* --------------------------------------------------------------- views --- */

  if (!workspaceId) {
    return (
      <Page width="full">
        <EmptyState
          icon={<FileText />}
          title="No workspace selected"
          description="Open a workspace to see its documents."
        />
      </Page>
    );
  }

  return (
    <Page width="full">
      <PageHeader
        title="Docs & Knowledge Base"
        description="Notion-style workspace documentation with teamspace tree navigation, multi-block editing, custom covers, and AI Copilot."
        icon={<FileText className="text-accent-blue" />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            {isSaving ? (
              <Badge variant="neutral" className="gap-1 px-3 py-1">
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </Badge>
            ) : savedAt !== null ? (
              <Badge variant="primary" className="gap-1 px-3 py-1">
                <CheckCircle className="size-3.5" />
                Saved
              </Badge>
            ) : null}

            {currentDoc && (
              <DocToolsDrawer
                doc={currentDoc}
                onAddComment={(text) =>
                  addComment(
                    currentDoc.id,
                    currentUser?.displayName ?? currentUser?.name ?? 'Someone',
                    text,
                  )
                }
              />
            )}

            <Button onClick={flush} disabled={!currentDoc || !pendingBlocks}>
              Save Changes
            </Button>
          </div>
        }
      />

      {isError ? (
        <EmptyState
          icon={<TriangleAlert />}
          title="Could not load documents"
          description="The document tree could not be read from the server. Check your connection and try again."
        />
      ) : isLoading ? (
        <Panel className="flex-1">
          <SkeletonList rows={8} />
        </Panel>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No teamspaces yet"
          description="A teamspace groups related documents. Create one to start writing."
          action={
            <Button
              leadingIcon={<Plus />}
              onClick={() => void addCompany('My Teamspace')}
            >
              Create teamspace
            </Button>
          }
        />
      ) : (
        <div className="gap-6 md:flex-row flex flex-1 flex-col items-start w-full">
          {/* Left Notion Docs Tree Sidebar */}
          <DocSidebar
            companies={companies}
            docs={docs}
            activeDocId={currentDoc?.id ?? ''}
            onSelectDoc={openDoc}
            onAddCompany={() => {
              void prompts
                .promptText({
                  title: 'New teamspace',
                  description: 'A teamspace groups related documents together.',
                  label: 'Name',
                  placeholder: 'Engineering',
                  confirmLabel: 'Create',
                })
                .then((name) => {
                  if (name) void addCompany(name);
                });
            }}
            onRenameCompany={(companyId, currentName) => {
              void prompts
                .promptText({
                  title: 'Rename teamspace',
                  label: 'Name',
                  defaultValue: currentName,
                  confirmLabel: 'Rename',
                })
                .then((name) => {
                  if (name) renameCompany(companyId, name);
                });
            }}
            onDeleteCompany={(companyId) => {
              if (companies.length <= 1) return;
              void prompts
                .confirmAction({
                  title: 'Delete this teamspace?',
                  description:
                    'Every document inside it is deleted too. This cannot be undone.',
                  confirmLabel: 'Delete teamspace',
                  destructive: true,
                })
                .then((confirmed) => {
                  if (confirmed) void deleteCompany(companyId);
                });
            }}
            onCreateDoc={(companyId, title, category, template, parentId) => {
              void createDoc(companyId, title, category, template, parentId).then(
                (id) => {
                  if (id) openDoc(id);
                },
              );
            }}
            onMoveDocToCompany={moveDocToCompany}
            onDuplicateDoc={(docId) => {
              void duplicateDoc(docId).then((id) => {
                if (id) openDoc(id);
              });
            }}
            onToggleFavorite={toggleFavorite}
            onDeleteDoc={deleteDoc}
            onUpdateTitle={updateDocTitle}
          />

          {/* Main Workspace Area */}
          <Panel className="flex-1 flex flex-col min-h-160 w-full">
            {currentDoc ? (
              <>
                <DocHeader
                  doc={currentDoc}
                  onUpdateTitle={(title) => updateDocTitle(currentDoc.id, title)}
                  onUpdateIcon={(icon, color) =>
                    updateDocIcon(currentDoc.id, icon, color)
                  }
                  onUpdateCover={(cover) => updateDocCover(currentDoc.id, cover)}
                  onUpdateStatus={(status) =>
                    updateDocStatus(currentDoc.id, status)
                  }
                  onUpdateCategory={(category) =>
                    updateDocCategory(currentDoc.id, category)
                  }
                  onToggleFavorite={() => toggleFavorite(currentDoc.id)}
                />

                <div className="flex-1 rounded-xl border border-border bg-surface p-4 md:p-6 shadow-xs">
                  <NotionBlockEditor
                    key={currentDoc.id}
                    blocks={blocks}
                    onUpdateBlocks={handleBlocksChange}
                  />
                </div>
              </>
            ) : (
              <EmptyState
                icon={<FileText />}
                title="No document open"
                description="Pick a page from the sidebar, or create a new one."
                action={
                  <Button
                    leadingIcon={<Plus />}
                    onClick={() => {
                      void createDoc().then((id) => {
                        if (id) openDoc(id);
                      });
                    }}
                  >
                    New document
                  </Button>
                }
              />
            )}
          </Panel>
        </div>
      )}

      {prompts.dialog}
    </Page>
  );
}
