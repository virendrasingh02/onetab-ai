import {
  ActionDropdownMenu,
  Button,
  confirm,
  copyToClipboard,
  EntityContextMenu,
  entityUrl,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconRenderer,
  Panel,
  SearchInput,
  usePromptDialog,
  type EntityAction,
  type PromptDialog,
} from '@org/ui';
import { useSaveForLater } from '@org/web-chat/bookmarks';
import { cn } from '@org/utils';
import {
  Building,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  Download,
  FileText,
  Folder,
  Link2,
  FolderPlus,
  LayoutTemplate,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { downloadDocAsMarkdown } from './doc-export.js';
import type { CompanyItem, DocCategory, DocItem } from './doc-types.js';

interface DocSidebarProps {
  companies: CompanyItem[];
  docs: DocItem[];
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onAddCompany?: () => void;
  onRenameCompany?: (companyId: string, currentName: string) => void;
  onDeleteCompany?: (companyId: string) => void;
  onCreateDoc: (
    companyId?: string,
    title?: string,
    category?: DocCategory,
    template?: string,
    parentId?: string,
  ) => void;
  onMoveDocToCompany?: (docId: string, targetCompanyId: string) => void;
  onDuplicateDoc: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
}

export function DocSidebar({
  companies,
  docs,
  activeDocId,
  onSelectDoc,
  onAddCompany,
  onRenameCompany,
  onDeleteCompany,
  onCreateDoc,
  onMoveDocToCompany,
  onDuplicateDoc,
  onToggleFavorite,
  onDeleteDoc,
  onUpdateTitle,
}: DocSidebarProps) {
  /* One dialog for the whole tree — the rename and delete items in every node
     menu route through it instead of `prompt()` / no confirmation at all. */
  const prompts = usePromptDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>('All');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [collapsedCompanies, setCollapsedCompanies] = useState<
    Record<string, boolean>
  >({});
  const [expandedDocIds, setExpandedDocIds] = useState<Record<string, boolean>>(
    {},
  );

  const toggleCompanyCollapse = (companyId: string) => {
    setCollapsedCompanies((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  const toggleDocExpand = (docId: string) => {
    setExpandedDocIds((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const filteredDocs = docs.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.snippet.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'All' || d.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const favoriteDocs = docs.filter((d) => d.favorite);

  const categories: DocCategory[] = [
    'Architecture',
    'Design System',
    'Engineering',
    'General',
    'Security',
  ];

  return (
    <Panel
      className="md:w-76 flex w-full shrink-0 flex-col justify-between"
      title={
        <span className="gap-2 text-sm font-semibold flex items-center">
          <Folder className="size-4 text-accent-blue" aria-hidden />
          <span>Folders & Docs</span>
        </span>
      }
      actions={
        <div className="gap-1 flex items-center">
          {/* Add Folder Action Button */}
          {onAddCompany && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Add Folder"
              onClick={() => onAddCompany()}
              title="Add Folder"
            >
              <FolderPlus className="size-3.5 text-accent-blue" />
            </Button>
          )}

          {/* Templates Launcher Modal */}
          <Dialog
            open={isTemplateDialogOpen}
            onOpenChange={setIsTemplateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Notion Templates"
                aria-label="Notion Templates"
              >
                <LayoutTemplate className="size-3.5 text-subtle hover:text-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="gap-2 flex items-center">
                  <LayoutTemplate className="size-4 text-accent-blue" />
                  Starter Notion Templates
                </DialogTitle>
                <DialogDescription>
                  Pick a pre-configured template with interactive Notion block
                  layouts.
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onCreateDoc(
                      companies[0]?.id,
                      'Product Requirements Document',
                      'Engineering',
                      'prd',
                    );
                    setIsTemplateDialogOpen(false);
                  }}
                  className="p-3 group gap-3 flex w-full cursor-pointer items-start rounded-lg border border-border bg-surface-raised text-left transition-all hover:border-accent-blue hover:bg-accent/40"
                >
                  <div className="size-8 text-lg flex shrink-0 items-center justify-center rounded-lg border border-accent-blue/30 bg-accent-blue/10">
                    🚀
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-accent-blue">
                      Product Requirements Document (PRD)
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-subtle">
                      Problem statement, user stories, checklist & feature
                      matrix grid.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCreateDoc(
                      companies[0]?.id,
                      'Sprint Sync Notes',
                      'General',
                      'meeting',
                    );
                    setIsTemplateDialogOpen(false);
                  }}
                  className="p-3 group gap-3 flex w-full cursor-pointer items-start rounded-lg border border-border bg-surface-raised text-left transition-all hover:border-accent-green/30 hover:bg-accent/40"
                >
                  <div className="size-8 text-lg flex shrink-0 items-center justify-center rounded-lg border border-accent-green/30 bg-accent-green-soft">
                    📊
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-accent-green">
                      Sprint Sync & Planning Notes
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-subtle">
                      Agenda bullet points, attendee list, and interactive task
                      checkboxes.
                    </p>
                  </div>
                </button>
              </DialogBody>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New doc"
            onClick={() => onCreateDoc()}
            title="Create blank doc"
          >
            <Plus className="size-4 text-subtle hover:text-foreground" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Search Input */}
        <div>
          <SearchInput
            placeholder="Search docs or companies…"
            label="Search docs"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        </div>

        {/* Category Pills Filter */}
        <div className="gap-1 pb-1 flex scrollbar-none items-center overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('All')}
            className={cn(
              'px-2 py-0.5 font-medium cursor-pointer rounded-md text-[10px] whitespace-nowrap transition-colors',
              selectedCategoryFilter === 'All'
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-raised text-muted-foreground hover:bg-accent',
            )}
          >
            All ({docs.length})
          </button>
          {categories.map((cat) => {
            const count = docs.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={cn(
                  'px-2 py-0.5 font-medium cursor-pointer rounded-md text-[10px] whitespace-nowrap transition-colors',
                  selectedCategoryFilter === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-raised text-muted-foreground hover:bg-accent',
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Favorites Section */}
        {favoriteDocs.length > 0 &&
          selectedCategoryFilter === 'All' &&
          !searchQuery && (
            <div className="space-y-1 pt-1 pb-2 border-b border-border/50">
              <p className="font-semibold tracking-wider gap-1 px-1 flex items-center text-[10px] text-accent-amber uppercase">
                <Star className="size-3 fill-accent-amber" />
                Favorites
              </p>
              <ul className="space-y-0.5">
                {favoriteDocs.map((docItem) => {
                  const isActive = docItem.id === activeDocId;
                  return (
                    <li key={docItem.id}>
                      <button
                        type="button"
                        onClick={() => onSelectDoc(docItem.id)}
                        className={cn(
                          'p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-md text-left transition-colors',
                          isActive
                            ? 'font-semibold bg-selected text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <div className="gap-2 flex items-center truncate">
                          <IconRenderer
                            icon={docItem.icon}
                            iconColor={docItem.iconColor}
                            sizeClassName="size-4"
                          />
                          <span className="truncate">{docItem.title}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-subtle">
                          {docItem.updatedAt}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        {/* Company-Wise Tree Navigation */}
        <div className="space-y-3 pt-1">
          {companies.map((company) => {
            const companyDocs = filteredDocs.filter(
              (d) =>
                d.companyId === company.id ||
                (!d.companyId && company.id === companies[0]?.id),
            );
            const rootDocs = companyDocs.filter((d) => !d.parentId);
            const isCollapsed = !!collapsedCompanies[company.id];

            return (
              <div key={company.id} className="space-y-1">
                {/* Company Tree Header */}
                <div className="group/comp px-1 py-1 flex items-center justify-between rounded-md transition-colors hover:bg-accent/50">
                  <button
                    type="button"
                    onClick={() => toggleCompanyCollapse(company.id)}
                    className="gap-1.5 text-xs font-bold flex flex-1 cursor-pointer items-center truncate text-left text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5 shrink-0 text-subtle" />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0 text-subtle" />
                    )}
                    <span className="text-sm shrink-0">
                      {company.icon || '🏠'}
                    </span>
                    <span className="truncate">{company.name}</span>
                  </button>

                  {/* Company Options & Action Menu */}
                  <div className="gap-0.5 flex items-center opacity-0 transition-opacity group-hover/comp:opacity-100">
                    <button
                      type="button"
                      onClick={() => onCreateDoc(company.id)}
                      className="p-1 rounded cursor-pointer text-subtle hover:bg-accent hover:text-foreground"
                      title="Add Doc in Folder"
                    >
                      <Plus className="size-3.5 text-accent-blue" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded cursor-pointer text-subtle hover:bg-accent hover:text-foreground"
                          title="Folder Options"
                        >
                          <MoreVertical className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => onCreateDoc(company.id)}
                          className="text-xs gap-2"
                        >
                          <Plus className="size-3.5 text-accent-blue" />
                          Add Doc inside {company.name}
                        </DropdownMenuItem>
                        {onRenameCompany && (
                          <DropdownMenuItem
                            onClick={() =>
                              onRenameCompany(company.id, company.name)
                            }
                            className="text-xs gap-2"
                          >
                            <Pencil className="size-3 text-primary" />
                            Rename Folder
                          </DropdownMenuItem>
                        )}
                        {onDeleteCompany && companies.length > 1 && (
                          <DropdownMenuItem
                            onClick={() => {
                              const docCount = docs.filter(
                                (d) => d.companyId === company.id,
                              ).length;
                              void confirm({
                                title: `Delete “${company.name}”?`,
                                description: docCount
                                  ? `This permanently deletes the folder and its ${docCount} doc${
                                      docCount === 1 ? '' : 's'
                                    }. This can't be undone.`
                                  : "This permanently deletes the folder. This can't be undone.",
                                confirmLabel: 'Delete folder',
                                destructive: true,
                              }).then((ok) => {
                                if (ok) onDeleteCompany(company.id);
                              });
                            }}
                            className="text-xs gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3" />
                            Delete Folder
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Nested Docs Tree Items */}
                {!isCollapsed && (
                  <ul className="space-y-1 pl-1">
                    {rootDocs.length === 0 ? (
                      <li className="py-1 pl-6 text-[11px] text-subtle italic">
                        <p>No pages inside</p>
                        <button
                          type="button"
                          onClick={() => onCreateDoc(company.id)}
                          className="mt-1 gap-1 font-medium px-1.5 py-0.5 rounded flex cursor-pointer items-center text-[11px] text-subtle transition-colors hover:bg-accent/40 hover:text-foreground"
                        >
                          <Plus className="size-3 text-accent-blue" />
                          Add new
                        </button>
                      </li>
                    ) : (
                      rootDocs.map((docItem) => (
                        <DocTreeNodeItem
                          key={docItem.id}
                          doc={docItem}
                          allDocs={companyDocs}
                          companyId={company.id}
                          activeDocId={activeDocId}
                          expandedDocIds={expandedDocIds}
                          toggleDocExpand={toggleDocExpand}
                          onSelectDoc={onSelectDoc}
                          onCreateDoc={onCreateDoc}
                          onUpdateTitle={onUpdateTitle}
                          onDuplicateDoc={onDuplicateDoc}
                          onMoveDocToCompany={onMoveDocToCompany}
                          onDeleteDoc={onDeleteDoc}
                          onToggleFavorite={onToggleFavorite}
                          companies={companies}
                          prompts={prompts}
                          level={0}
                        />
                      ))
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {prompts.dialog}
    </Panel>
  );
}

function DocTreeNodeItem({
  doc,
  allDocs,
  companyId,
  activeDocId,
  expandedDocIds,
  toggleDocExpand,
  onSelectDoc,
  onCreateDoc,
  onUpdateTitle,
  onDuplicateDoc,
  onMoveDocToCompany,
  onDeleteDoc,
  onToggleFavorite,
  companies,
  prompts,
  level = 0,
}: {
  doc: DocItem;
  allDocs: DocItem[];
  companyId: string;
  activeDocId: string;
  expandedDocIds: Record<string, boolean>;
  toggleDocExpand: (docId: string) => void;
  onSelectDoc: (id: string) => void;
  onCreateDoc: (
    companyId?: string,
    title?: string,
    category?: DocCategory,
    template?: string,
    parentId?: string,
  ) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onDuplicateDoc: (id: string) => void;
  onMoveDocToCompany?: (id: string, targetCompanyId: string) => void;
  onDeleteDoc: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  companies: CompanyItem[];
  /* Owned by `DocSidebar` and drilled down: one dialog for the whole tree
     rather than one per node. */
  prompts: PromptDialog;
  level?: number;
}) {
  const childDocs = allDocs.filter((d) => d.parentId === doc.id);
  const isExpanded = !!expandedDocIds[doc.id];
  const isActive = doc.id === activeDocId;
  const moveTargets = companies.filter((c) => c.id !== doc.companyId);
  const { saveAction } = useSaveForLater();

  /* The row's "⋯" menu, right-click and touch sheet all render this list. */
  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Open',
      icon: FileText,
      run: () => onSelectDoc(doc.id),
    },
    {
      id: 'add-subpage',
      group: 'edit',
      label: 'Add subpage',
      icon: Plus,
      run: () => {
        if (!isExpanded) toggleDocExpand(doc.id);
        onCreateDoc(companyId, 'Untitled Page', 'General', undefined, doc.id);
      },
    },
    {
      id: 'rename',
      group: 'edit',
      label: 'Rename…',
      icon: Pencil,
      shortcut: 'R',
      hidden: !onUpdateTitle,
      run: async () => {
        const title = await prompts.promptText({
          title: 'Rename document',
          label: 'Title',
          defaultValue: doc.title,
          confirmLabel: 'Rename',
        });
        if (title && title !== doc.title) onUpdateTitle?.(doc.id, title);
      },
    },
    {
      id: 'duplicate',
      group: 'edit',
      label: 'Duplicate',
      icon: CopyPlus,
      shortcut: 'D',
      run: () => onDuplicateDoc(doc.id),
    },
    {
      id: 'favorite',
      group: 'organize',
      label: doc.favorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      shortcut: 'F',
      run: () => onToggleFavorite(doc.id),
    },
    saveAction({
      type: 'doc',
      id: doc.id,
      title: doc.title,
      snippet: doc.snippet,
      href: `docs/${doc.id}`,
    }),
    {
      id: 'move',
      group: 'organize',
      label: 'Move to folder',
      icon: MoveRight,
      hidden: !onMoveDocToCompany || moveTargets.length === 0,
      children: moveTargets.map((c): EntityAction => ({
        id: `move-${c.id}`,
        label: c.name,
        icon: Building,
        run: () => onMoveDocToCompany?.(doc.id, c.id),
      })),
    },
    {
      id: 'copy-link',
      group: 'share',
      label: 'Copy link',
      icon: Link2,
      shortcut: 'L',
      run: () =>
        copyToClipboard(
          entityUrl(
            `${window.location.pathname.replace(/\/docs(\/.*)?$/, '')}/docs/${doc.id}`,
          ),
        ),
    },
    {
      id: 'export',
      group: 'share',
      label: 'Export as Markdown',
      icon: Download,
      run: () => downloadDocAsMarkdown(doc),
    },
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete…',
      icon: Trash2,
      destructive: true,
      // The last document can't go — the editor always needs one open.
      hidden: allDocs.length <= 1,
      confirm: {
        title: `Delete “${doc.title}”?`,
        description:
          childDocs.length > 0
            ? `This also deletes ${childDocs.length} page${
                childDocs.length === 1 ? '' : 's'
              } inside it. This cannot be undone.`
            : 'This cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
      },
      run: () => onDeleteDoc(doc.id),
    },
  ];

  return (
    <li className="space-y-0.5">
      <EntityContextMenu
        actions={actions}
        scope={`doc:${doc.id}`}
        entityType="doc"
        entity={doc}
        label={doc.title}
      >
        <div className="group relative flex items-center justify-between">
          {/* Row wrapper carries the styling so the expand toggle and the
            select button are siblings — a <button> inside a <button> is
            invalid HTML and React warns on every render. */}
          <div
            className={cn(
              'p-1.5 text-xs gap-1.5 flex w-full items-center rounded-md transition-colors',
              isActive
                ? 'font-medium border border-border/80 bg-selected text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            style={{ paddingLeft: `${level * 12 + 6}px` }}
          >
            <button
              type="button"
              onClick={() => toggleDocExpand(doc.id)}
              aria-label={isExpanded ? 'Collapse page' : 'Expand page'}
              aria-expanded={isExpanded}
              className="p-0.5 rounded shrink-0 cursor-pointer hover:bg-accent/70"
            >
              {isExpanded ? (
                <ChevronDown className="size-3 text-subtle" />
              ) : (
                <ChevronRight className="size-3 text-subtle" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectDoc(doc.id)}
              aria-current={isActive ? 'page' : undefined}
              className="gap-1.5 min-w-0 flex flex-1 cursor-pointer items-center text-left"
            >
              <IconRenderer
                icon={doc.icon}
                iconColor={doc.iconColor}
                fallbackEmoji="📝"
                sizeClassName="size-3.5 shrink-0"
              />
              <span className="font-medium text-xs flex-1 truncate">
                {doc.title}
              </span>
            </button>
          </div>

          {/* Action Dropdown */}
          <div className="right-1.5 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => {
                toggleDocExpand(doc.id);
                onCreateDoc(
                  companyId,
                  'Untitled Page',
                  'General',
                  undefined,
                  doc.id,
                );
              }}
              className="p-1 rounded cursor-pointer text-subtle hover:bg-accent hover:text-foreground"
              title="Add Sub-page"
            >
              <Plus className="size-3 text-accent-blue" />
            </button>
            <ActionDropdownMenu
              actions={actions}
              scope={`doc:${doc.id}`}
              entityType="doc"
              entity={doc}
              contentClassName="w-52"
              trigger={
                <button
                  type="button"
                  className="p-1 rounded cursor-pointer text-subtle hover:bg-accent hover:text-foreground"
                  title="Doc options"
                  aria-label={`Options for ${doc.title}`}
                >
                  <MoreVertical className="size-3.5" />
                </button>
              }
            />
          </div>
        </div>
      </EntityContextMenu>

      {/* Expanded Children */}
      {isExpanded && (
        <ul className="space-y-0.5">
          {childDocs.length === 0 ? (
            <li
              style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }}
              className="py-1"
            >
              <p className="text-[11px] text-subtle italic">No pages inside</p>
              <button
                type="button"
                onClick={() =>
                  onCreateDoc(
                    companyId,
                    'Untitled Page',
                    'General',
                    undefined,
                    doc.id,
                  )
                }
                className="mt-0.5 gap-1 font-medium px-1.5 py-0.5 rounded flex cursor-pointer items-center text-[11px] text-subtle transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                <Plus className="size-3 text-accent-blue" />
                Add new
              </button>
            </li>
          ) : (
            <>
              {childDocs.map((childDoc) => (
                <DocTreeNodeItem
                  key={childDoc.id}
                  doc={childDoc}
                  allDocs={allDocs}
                  companyId={companyId}
                  activeDocId={activeDocId}
                  expandedDocIds={expandedDocIds}
                  toggleDocExpand={toggleDocExpand}
                  onSelectDoc={onSelectDoc}
                  onCreateDoc={onCreateDoc}
                  onUpdateTitle={onUpdateTitle}
                  onDuplicateDoc={onDuplicateDoc}
                  onMoveDocToCompany={onMoveDocToCompany}
                  onDeleteDoc={onDeleteDoc}
                  onToggleFavorite={onToggleFavorite}
                  companies={companies}
                  prompts={prompts}
                  level={level + 1}
                />
              ))}
              <li
                style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }}
                className="pt-0.5"
              >
                <button
                  type="button"
                  onClick={() =>
                    onCreateDoc(
                      companyId,
                      'Untitled Page',
                      'General',
                      undefined,
                      doc.id,
                    )
                  }
                  className="gap-1 font-medium px-1.5 py-0.5 rounded flex cursor-pointer items-center text-[11px] text-subtle transition-colors hover:bg-accent/40 hover:text-foreground"
                >
                  <Plus className="size-3 text-accent-blue" />
                  Add new
                </button>
              </li>
            </>
          )}
        </ul>
      )}
    </li>
  );
}
