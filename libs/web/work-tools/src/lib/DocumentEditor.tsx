import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Page,
  Panel,
  SkeletonList,
  usePromptDialog,
} from '@org/ui';
import { useCurrentUser } from '@org/auth';
import { cn } from '@org/utils';
import { CheckCircle, FileText, FolderPlus, Loader2, MoreHorizontal, Plus, TriangleAlert, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentWorkspace } from './use-work-tools.js';
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

interface DocTemplateItem {
  id: 'prd' | 'meeting';
  title: string;
  category: string;
  description: string;
  icon: string;
}

const DOC_TEMPLATES: DocTemplateItem[] = [
  {
    id: 'prd',
    title: 'Product Requirement Document (PRD)',
    category: 'Product & Planning',
    description: 'Structured PRD template with goals, user stories, requirements & success metrics.',
    icon: '📋',
  },
  {
    id: 'meeting',
    title: 'Meeting Notes & Actions',
    category: 'Team Collaboration',
    description: 'Meeting recap template with agenda, discussion points, decisions & action items.',
    icon: '📝',
  },
];

type DocTab = 'all' | 'templates' | 'mine';

export function DocumentEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const docsWorkspace = useDocsWorkspace(workspaceId);
  /* Teamspace create/rename/delete used `prompt()` and `confirm()`. Those are
     unthemed, block the main thread, and Electron dropped `prompt()` entirely —
     in the desktop build the rename simply did nothing. */
  const prompts = usePromptDialog();

  const urlTab = searchParams.get('tab') as DocTab | null;
  const [tab, setTab] = useState<DocTab>(urlTab ?? 'all');

  useEffect(() => {
    if (urlTab) {
      setTab(urlTab);
    }
  }, [urlTab]);

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
    (docId: string) => setSearchParams({ doc: docId, tab: 'all' }),
    [setSearchParams],
  );

  const handleNewDoc = useCallback(() => {
    void createDoc().then((id) => {
      if (id) openDoc(id);
      setTab('all');
    });
  }, [createDoc, openDoc]);

  const handleNewFolder = useCallback(() => {
    void prompts
      .promptText({
        title: 'New folder',
        description: 'A folder groups related documents together.',
        label: 'Folder name',
        placeholder: 'Engineering Docs',
        confirmLabel: 'Create folder',
      })
      .then((name) => {
        if (name) {
          void addCompany(name);
          setTab('all');
        }
      });
  }, [addCompany, prompts]);

  const handleUseTemplate = useCallback(
    (templateKey: 'prd' | 'meeting') => {
      void createDoc(undefined, undefined, undefined, templateKey).then((id) => {
        if (id) openDoc(id);
        setTab('all');
      });
    },
    [createDoc, openDoc],
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
      if (id) setSearchParams({ doc: id, tab: 'all' });
      setTab('all');
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
      {/* Header section matching reference image design */}
      <div className="mb-6 border-b border-border/60 pb-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Docs
          </h1>

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

            <Button
              onClick={handleNewDoc}
              size="lg"
              leadingIcon={<Plus />}
            >
              New
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleNewDoc} className="gap-2 text-xs">
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create new document</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewFolder} className="gap-2 text-xs">
                  <FolderPlus className="size-3.5 text-muted-foreground" />
                  <span>Create new folder</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={flush}
                  disabled={!currentDoc || !pendingBlocks}
                  className="gap-2 text-xs"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>Save changes</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab('templates')} className="gap-2 text-xs">
                  <Zap className="size-3.5 text-muted-foreground" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Underline tab strip */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={cn(
              'relative pb-3 transition-colors',
              tab === 'all'
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setTab('templates')}
            className={cn(
              'relative pb-3 transition-colors',
              tab === 'templates'
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Templates
          </button>

          <button
            type="button"
            onClick={() => setTab('mine')}
            className={cn(
              'relative pb-3 transition-colors',
              tab === 'mine'
                ? 'border-b-2 border-primary font-semibold text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Managed by you
          </button>
        </div>
      </div>

      {tab === 'templates' ? (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Document Templates ({DOC_TEMPLATES.length})
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DOC_TEMPLATES.map((tmpl) => (
              <li key={tmpl.id}>
                <Card className="h-full justify-between p-5 transition-colors duration-(--duration-fast) hover:border-border-strong">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge variant="neutral">{tmpl.category}</Badge>
                      <Badge variant="primary">Template</Badge>
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">{tmpl.icon}</span>
                      <h2 className="text-sm font-semibold text-foreground">{tmpl.title}</h2>
                    </div>
                    <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                      {tmpl.description}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleUseTemplate(tmpl.id)}
                    leadingIcon={<Zap className="size-3.5 text-accent-amber" />}
                  >
                    Use template
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : isError ? (
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
          title="No folders yet"
          description="A folder groups related documents. Create one to start writing."
          action={
            <Button
              leadingIcon={<Plus />}
              onClick={() => void addCompany('My Folder')}
            >
              Create folder
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
                  title: 'New folder',
                  description: 'A folder groups related documents together.',
                  label: 'Name',
                  placeholder: 'Engineering Docs',
                  confirmLabel: 'Create folder',
                })
                .then((name) => {
                  if (name) void addCompany(name);
                });
            }}
            onRenameCompany={(companyId, currentName) => {
              void prompts
                .promptText({
                  title: 'Rename folder',
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
                  title: 'Delete this folder?',
                  description:
                    'Every document inside it is deleted too. This cannot be undone.',
                  confirmLabel: 'Delete folder',
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
