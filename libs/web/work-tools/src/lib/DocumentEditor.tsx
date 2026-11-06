import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Page,
  Panel,
  SkeletonList,
  Tabs,
  TabsTrigger,
  toast,
  usePromptDialog,
  PageBar,
  PageTabBar,
} from '@org/ui';
import { useCurrentUser } from '@org/auth';
import { FiledFilesSection } from '@org/web-upload';
import {
  CheckCircle,
  ChevronDown,
  Download,
  FileText,
  FolderPlus,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Plus,
  TriangleAlert,
  User,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCurrentWorkspace, useProjects } from './use-work-tools.js';
import { DocGallery } from './docs/DocGallery.js';
import { DocHeader } from './docs/DocHeader.js';
import { DocSidebar } from './docs/DocSidebar.js';
import { DocToolsDrawer } from './docs/DocToolsDrawer.js';
import { downloadDocAsMarkdown } from './docs/doc-export.js';
import type { DocItem, NotionBlock } from './docs/doc-types.js';
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
  id: 'prd' | 'meeting' | 'spec' | 'checklist';
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
    description:
      'Structured PRD template with goals, user stories, requirements & success metrics.',
    icon: '📋',
  },
  {
    id: 'meeting',
    title: 'Meeting Notes & Actions',
    category: 'Team Collaboration',
    description:
      'Meeting recap template with agenda, discussion points, decisions & action items.',
    icon: '📝',
  },
  {
    id: 'spec',
    title: 'Technical Architecture Spec',
    category: 'Engineering & Architecture',
    description:
      'Technical design specification with component overview, endpoints, and schema models.',
    icon: '⚙️',
  },
  {
    id: 'checklist',
    title: 'Launch Readiness Checklist',
    category: 'Release & Operations',
    description:
      'Production deployment verification, smoke tests, and post-launch monitoring checklist.',
    icon: '✅',
  },
];

const DOC_TABS = ['editor', 'gallery', 'templates', 'mine'] as const;
type DocTab = (typeof DOC_TABS)[number];

/** Anything else — including the retired `?tab=all` — opens the editor. */
function parseDocTab(value: string | null): DocTab {
  return DOC_TABS.find((candidate) => candidate === value) ?? 'editor';
}

export function DocumentEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspaceSlug, docId: routeDocId } = useParams<{
    workspaceSlug: string;
    docId?: string;
  }>();
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const projectsQuery = useProjects(workspaceId);
  const projects = projectsQuery.data ?? [];
  const docsWorkspace = useDocsWorkspace(workspaceId);
  /* Teamspace create/rename/delete used `prompt()` and `confirm()`. Those are
     unthemed, block the main thread, and Electron dropped `prompt()` entirely —
     in the desktop build the rename simply did nothing. */
  const prompts = usePromptDialog();

  // The URL owns the tab, so reload, Back and shared links all land on it.
  const tab = parseDocTab(searchParams.get('tab'));
  const setTab = useCallback(
    (next: DocTab) =>
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('tab', next);
        return params;
      }),
    [setSearchParams],
  );

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
    updateDocProject,
    toggleFavorite,
    updateDocBlocks,
    addComment,
    createDoc,
    duplicateDoc,
    deleteDoc,
    isSaving,
  } = docsWorkspace;

  // `/docs/:docId` is the deep link; `?doc=` is the old query form, still
  // honoured for links persisted server-side (search, notifications).
  const docParam = routeDocId ?? searchParams.get('doc');
  const currentDoc = useMemo(
    () => docs.find((doc) => doc.id === docParam) ?? docs[0],
    [docs, docParam],
  );

  const openDoc = useCallback(
    (docId: string) => navigate(`/w/${workspaceSlug}/docs/${docId}?tab=editor`),
    [navigate, workspaceSlug],
  );

  const handleNewDoc = useCallback(() => {
    void createDoc().then((id) => {
      if (id) openDoc(id);
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
          setTab('editor');
        }
      });
  }, [addCompany, prompts, setTab]);

  const handleUseTemplate = useCallback(
    (templateKey: DocTemplateItem['id']) => {
      void createDoc(undefined, undefined, undefined, templateKey).then(
        (id) => {
          if (id) openDoc(id);
        },
      );
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
    // Wait for the tree, not for a folder: `createDoc` makes one if needed.
    if (!workspaceId || isLoading) return;

    handledNewDoc.current = true;
    void createDoc().then((id) => {
      if (id) openDoc(id);
    });
  }, [isLoading, createDoc, openDoc, searchParams, workspaceId]);

  /* ------------------------------------------------------- block saving --- */

  const [pendingBlocks, setPendingBlocks] = useState<NotionBlock[] | null>(
    null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
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

    void updateDocBlocks(outstanding.docId, outstanding.blocks).then((ok) => {
      // A rejected save keeps the local copy: the person must be able to fix
      // what they typed, and must not be told it was saved.
      setSaveFailed(!ok);
      if (!ok) return;
      setSavedAt(Date.now());
      if (!pending.current) setPendingBlocks(null);
    });
  }, [updateDocBlocks]);

  const handleBlocksChange = useCallback(
    (blocks: NotionBlock[]) => {
      if (!currentDoc) return;
      // Held locally so the editor stays responsive between saves; the query
      // cache catches up when the debounce fires.
      setPendingBlocks(blocks);
      setSaveFailed(false);
      pending.current = { docId: currentDoc.id, blocks };

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [currentDoc, flush],
  );

  // Leaving the page must not drop an edit mid-debounce.
  useEffect(() => () => flush(), [flush]);

  const activeDocId = currentDoc?.id;
  const shownDocId = useRef(activeDocId);
  useEffect(() => {
    // `flush` changes identity on every save, so compare the document itself:
    // resetting on a re-render would wipe text a rejected save left in place.
    if (shownDocId.current === activeDocId) return;
    shownDocId.current = activeDocId;
    // Switching documents commits whatever the previous one had outstanding,
    // rather than discarding it along with the local copy.
    if (pending.current && pending.current.docId !== activeDocId) flush();
    setPendingBlocks(null);
    setSaveFailed(false);
  }, [activeDocId, flush]);

  // The badge is transient: it confirms a save happened, it is not a status.
  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const blocks = pendingBlocks ?? currentDoc?.blocks ?? [];

  /* ------------------------------------------------------------ deleting --- */

  /**
   * Moves off a document that is being deleted. Its unsaved edit goes with it:
   * flushing would PATCH a deleted document and flag the next one "Not saved".
   */
  const leaveDeletedDoc = useCallback(
    (remaining: DocItem[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pending.current = null;

      if (tab === 'editor' && remaining[0]) {
        openDoc(remaining[0].id);
      } else {
        // Deleting from a gallery stays on that gallery.
        const nextTab = tab === 'editor' ? 'gallery' : tab;
        navigate(`/w/${workspaceSlug}/docs?tab=${nextTab}`);
      }
    },
    [navigate, openDoc, tab, workspaceSlug],
  );

  /** For callers that have already confirmed, as the sidebar's menus do. */
  const removeDoc = useCallback(
    (docId: string) => {
      // A refusal is already toasted by the mutation cache; just stay put.
      void deleteDoc(docId).then((deleted) => {
        if (deleted && currentDoc?.id === docId) {
          leaveDeletedDoc(docs.filter((doc) => doc.id !== docId));
        }
      });
    },
    [currentDoc?.id, deleteDoc, docs, leaveDeletedDoc],
  );

  const confirmRemoveDoc = useCallback(
    (docId: string) => {
      void prompts
        .confirmAction({
          title: 'Delete this document?',
          description:
            'This document will be deleted from the workspace. This cannot be undone.',
          confirmLabel: 'Delete document',
          destructive: true,
        })
        .then((confirmed) => {
          if (confirmed) removeDoc(docId);
        });
    },
    [prompts, removeDoc],
  );

  const removeCompany = useCallback(
    (companyId: string) => {
      if (companies.length <= 1) return;
      const wasOpen = currentDoc?.companyId === companyId;

      deleteCompany(companyId).then(
        () => {
          if (wasOpen) {
            leaveDeletedDoc(docs.filter((doc) => doc.companyId !== companyId));
          }
        },
        () => toast.error('Could not delete the folder'),
      );
    },
    [
      companies.length,
      currentDoc?.companyId,
      deleteCompany,
      docs,
      leaveDeletedDoc,
    ],
  );

  const duplicateAndOpen = useCallback(
    (docId: string) => {
      void duplicateDoc(docId).then((newId) => {
        if (newId) openDoc(newId);
      });
    },
    [duplicateDoc, openDoc],
  );

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
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <PageBar
        icon={<FileText />}
        title="Docs"
        hasTabs
        meta={
          <>
            {docs.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded-md hover:bg-muted border border-border/50 transition-colors"
                    title="Jump to document"
                    aria-label="Jump to document"
                  >
                    <span className="truncate max-w-[150px] font-medium">
                      {currentDoc?.title || 'Untitled Document'}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-64 max-h-80 overflow-y-auto"
                >
                  <DropdownMenuLabel className="text-[11px]">
                    Jump to document
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {docs.map((d) => (
                    <DropdownMenuItem
                      key={d.id}
                      onClick={() => openDoc(d.id)}
                      className="text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">{d.icon || '📝'}</span>
                        <span className="truncate">
                          {d.title || 'Untitled Document'}
                        </span>
                      </div>
                      {d.id === currentDoc?.id && (
                        <Badge
                          variant="primary"
                          className="text-[9px] px-1 py-0 h-4"
                        >
                          active
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {saveFailed ? (
            <Badge
              variant="destructive"
              className="gap-1 px-1.5 py-0 h-4.5 text-[11px]"
            >
              Not saved
            </Badge>
          ) : isSaving ? (
            <Badge
              variant="neutral"
              className="gap-1 px-1.5 py-0 h-4.5 text-[11px]"
            >
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </Badge>
          ) : savedAt !== null ? (
            <Badge
              variant="primary"
              className="gap-1 px-1.5 py-0 h-4.5 text-[11px]"
            >
              <CheckCircle className="size-3" />
              Saved
            </Badge>
          ) : null}
          </>
        }
        actions={
          <>
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
              size="sm"
              className="h-7 text-xs gap-1 font-semibold"
              leadingIcon={<Plus className="size-3.5" />}
            >
              New
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={handleNewDoc}
                  className="gap-2 text-xs"
                >
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create new document</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleNewFolder}
                  className="gap-2 text-xs"
                >
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
                {currentDoc && (
                  <DropdownMenuItem
                    onClick={() => downloadDocAsMarkdown(currentDoc)}
                    className="gap-2 text-xs"
                  >
                    <Download className="size-3.5 text-muted-foreground" />
                    <span>Export markdown</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setTab('gallery')}
                  className="gap-2 text-xs"
                >
                  <LayoutGrid className="size-3.5 text-muted-foreground" />
                  <span>View in gallery</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTab('templates')}
                  className="gap-2 text-xs"
                >
                  <Zap className="size-3.5 text-accent-amber" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(next) => setTab(next as DocTab)}>
        <PageTabBar>
          <TabsTrigger value="editor" icon={<FileText className="size-4" />}>
            Editor
          </TabsTrigger>
          <TabsTrigger value="gallery" icon={<LayoutGrid className="size-4" />}>
            Gallery
          </TabsTrigger>
          <TabsTrigger value="templates" icon={<Zap className="size-4" />}>
            Templates
          </TabsTrigger>
          <TabsTrigger value="mine" icon={<User className="size-4" />}>
            Managed by you
          </TabsTrigger>
        </PageTabBar>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'templates' ? (
          <Page width="full">
            <div className="space-y-4 py-2">
              <div>
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Document Templates ({DOC_TEMPLATES.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Start with structured templates designed for product, architecture, and engineering workflows.
                </p>
              </div>

              <ul className="gap-4 md:grid-cols-2 grid grid-cols-1">
                {DOC_TEMPLATES.map((tmpl) => (
                  <li key={tmpl.id}>
                    <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong bg-surface">
                      <div>
                        <div className="mb-3 gap-2 flex items-center justify-between">
                          <Badge variant="neutral">{tmpl.category}</Badge>
                          <Badge variant="primary">Template</Badge>
                        </div>
                        <div className="mb-2 gap-2 flex items-center">
                          <span className="text-lg">{tmpl.icon}</span>
                          <h2 className="text-sm font-semibold text-foreground">
                            {tmpl.title}
                          </h2>
                        </div>
                        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                          {tmpl.description}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full font-semibold"
                        onClick={() => handleUseTemplate(tmpl.id)}
                        leadingIcon={
                          <Zap className="size-3.5 text-accent-amber" />
                        }
                      >
                        Use template
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          </Page>
        ) : isError ? (
          <div className="p-8">
            <EmptyState
              icon={<TriangleAlert />}
              title="Could not load documents"
              description="The document tree could not be read from the server. Check your connection and try again."
            />
          </div>
        ) : tab === 'gallery' || tab === 'mine' ? (
          <DocGallery
            key={tab}
            docs={docs}
            companies={companies}
            projects={projects}
            activeDocId={currentDoc?.id}
            isLoading={isLoading}
            // '' matches nobody, so a missing user shows none rather than all.
            filterAuthorId={tab === 'mine' ? currentUser?.id ?? '' : undefined}
            onSelectDoc={openDoc}
            onNewDoc={handleNewDoc}
            onBrowseTemplates={() => setTab('templates')}
            onDuplicateDoc={duplicateAndOpen}
            onDeleteDoc={confirmRemoveDoc}
            onToggleFavorite={toggleFavorite}
          />
        ) : isLoading ? (
          <div className="p-6">
            <Panel className="flex-1">
              <SkeletonList rows={8} />
            </Panel>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<FileText />}
              title="No documents yet"
              description="Start writing straight away — it goes into a General folder you can rename — or set up a folder first."
              action={
                <div className="gap-2 flex flex-wrap justify-center">
                  <Button leadingIcon={<Plus />} onClick={handleNewDoc}>
                    New document
                  </Button>
                  <Button variant="outline" onClick={handleNewFolder}>
                    Create folder
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <div className="gap-6 md:flex-row flex w-full flex-1 flex-col items-start">
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
                      description:
                        'A folder groups related documents together.',
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
                onDeleteCompany={removeCompany}
                onCreateDoc={(
                  companyId,
                  title,
                  category,
                  template,
                  parentId,
                ) => {
                  void createDoc(
                    companyId,
                    title,
                    category,
                    template,
                    parentId,
                  ).then((id) => {
                    if (id) openDoc(id);
                  });
                }}
                onMoveDocToCompany={moveDocToCompany}
                onDuplicateDoc={(docId) => {
                  void duplicateDoc(docId).then((id) => {
                    if (id) openDoc(id);
                  });
                }}
                onToggleFavorite={toggleFavorite}
                onDeleteDoc={removeDoc}
                onUpdateTitle={updateDocTitle}
              />

              {/* Main Workspace Area */}
              <Panel className="min-h-160 flex w-full flex-1 flex-col">
                {currentDoc ? (
                  <>
                    <DocHeader
                      doc={currentDoc}
                      onUpdateTitle={(title) =>
                        updateDocTitle(currentDoc.id, title)
                      }
                      onUpdateIcon={(icon, color) =>
                        updateDocIcon(currentDoc.id, icon, color)
                      }
                      onUpdateCover={(cover) =>
                        updateDocCover(currentDoc.id, cover)
                      }
                      onUpdateStatus={(status) =>
                        updateDocStatus(currentDoc.id, status)
                      }
                      onUpdateCategory={(category) =>
                        updateDocCategory(currentDoc.id, category)
                      }
                      onToggleFavorite={() => toggleFavorite(currentDoc.id)}
                      onUpdateProject={(pId, pName) =>
                        updateDocProject(currentDoc.id, pId, pName)
                      }
                      projects={projects}
                      workspaceSlug={workspaceSlug}
                    />

                    <div className="p-4 md:p-6 flex-1 rounded-xl border border-border bg-surface shadow-xs">
                      <NotionBlockEditor
                        key={currentDoc.id}
                        blocks={blocks}
                        onUpdateBlocks={handleBlocksChange}
                        workspaceId={workspaceId}
                      />
                    </div>

                    <div className="mt-4 p-4 md:p-6 rounded-xl border border-border bg-surface shadow-xs">
                      <FiledFilesSection
                        workspaceId={workspaceId}
                        workspaceSlug={workspaceSlug}
                        currentUserId={currentUser?.id}
                        target={{ type: 'DOCUMENT', id: currentDoc.id }}
                        uploadLabel="Attach files to this document"
                        emptyDescription="Attach a file to keep it with this document."
                        onNavigateSource={(href) => navigate(href)}
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
          </div>
        )}

        {prompts.dialog}
      </div>
    </div>
  );
}
