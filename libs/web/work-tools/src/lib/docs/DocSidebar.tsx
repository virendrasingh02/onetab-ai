import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  IconRenderer,
  Input,
  Panel,
  usePromptDialog,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Building,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  FolderPlus,
  LayoutTemplate,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { CompanyItem, DocCategory, DocItem } from './doc-types.js';

interface DocSidebarProps {
  companies: CompanyItem[];
  docs: DocItem[];
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onAddCompany?: () => void;
  onRenameCompany?: (companyId: string, currentName: string) => void;
  onDeleteCompany?: (companyId: string) => void;
  onCreateDoc: (companyId?: string, title?: string, category?: DocCategory, template?: string, parentId?: string) => void;
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [collapsedCompanies, setCollapsedCompanies] = useState<Record<string, boolean>>({});
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
      className="md:w-76 w-full shrink-0 flex flex-col justify-between"
      title={
        <span className="gap-2 flex items-center text-sm font-semibold">
          <Folder className="size-4 text-accent-blue" aria-hidden />
          <span>Company Docs Tree</span>
        </span>
      }
      actions={
        <div className="flex items-center gap-1">
          {/* Add Company Action Button */}
          {onAddCompany && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Add Company"
              onClick={() => onAddCompany()}
              title="Add Company Folder"
            >
              <FolderPlus className="size-3.5 text-accent-blue" />
            </Button>
          )}

          {/* Templates Launcher Modal */}
          <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
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
                <DialogTitle className="flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-accent-blue" />
                  Starter Notion Templates
                </DialogTitle>
                <DialogDescription>
                  Pick a pre-configured template with interactive Notion block layouts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 py-2">
                <button
                  type="button"
                  onClick={() => {
                    onCreateDoc(companies[0]?.id, 'Product Requirements Document', 'Engineering', 'prd');
                    setIsTemplateDialogOpen(false);
                  }}
                  className="w-full p-3 rounded-lg border border-border bg-surface-raised hover:border-accent-blue hover:bg-accent/40 text-left transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="size-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-lg shrink-0">
                    🚀
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-accent-blue">
                      Product Requirements Document (PRD)
                    </p>
                    <p className="text-[11px] text-subtle line-clamp-1 mt-0.5">
                      Problem statement, user stories, checklist & feature matrix grid.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCreateDoc(companies[0]?.id, 'Sprint Sync Notes', 'General', 'meeting');
                    setIsTemplateDialogOpen(false);
                  }}
                  className="w-full p-3 rounded-lg border border-border bg-surface-raised hover:border-accent-green/30 hover:bg-accent/40 text-left transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="size-8 rounded-lg bg-accent-green-soft border border-accent-green/30 flex items-center justify-center text-lg shrink-0">
                    📊
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-accent-green">
                      Sprint Sync & Planning Notes
                    </p>
                    <p className="text-[11px] text-subtle line-clamp-1 mt-0.5">
                      Agenda bullet points, attendee list, and interactive task checkboxes.
                    </p>
                  </div>
                </button>
              </div>
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
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-subtle" />
          <Input
            placeholder="Search docs or companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('All')}
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer',
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
                  'px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer',
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
        {favoriteDocs.length > 0 && selectedCategoryFilter === 'All' && !searchQuery && (
          <div className="space-y-1 pt-1 border-b border-border/50 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber flex items-center gap-1 px-1">
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
                        'w-full p-2 text-xs flex items-center justify-between rounded-md transition-colors text-left cursor-pointer',
                        isActive
                          ? 'bg-selected font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <IconRenderer icon={docItem.icon} iconColor={docItem.iconColor} sizeClassName="size-4" />
                        <span className="truncate">{docItem.title}</span>
                      </div>
                      <span className="text-[10px] text-subtle shrink-0">
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
              (d) => d.companyId === company.id || (!d.companyId && company.id === companies[0]?.id),
            );
            const rootDocs = companyDocs.filter((d) => !d.parentId);
            const isCollapsed = !!collapsedCompanies[company.id];

            return (
              <div key={company.id} className="space-y-1">
                {/* Company Tree Header */}
                <div className="group/comp flex items-center justify-between px-1 py-1 rounded-md hover:bg-accent/50 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleCompanyCollapse(company.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-foreground flex-1 truncate cursor-pointer text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5 text-subtle shrink-0" />
                    ) : (
                      <ChevronDown className="size-3.5 text-subtle shrink-0" />
                    )}
                    <span className="text-sm shrink-0">{company.icon || '🏠'}</span>
                    <span className="truncate">{company.name}</span>
                    <Badge variant="neutral" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                      {companyDocs.length}
                    </Badge>
                  </button>

                  {/* Company Options & Action Menu */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/comp:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onCreateDoc(company.id)}
                      className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                      title="Add Doc in Company"
                    >
                      <Plus className="size-3.5 text-accent-blue" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                          title="Company Options"
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
                            onClick={() => onRenameCompany(company.id, company.name)}
                            className="text-xs gap-2"
                          >
                            <Pencil className="size-3 text-primary" />
                            Rename Company
                          </DropdownMenuItem>
                        )}
                        {onDeleteCompany && companies.length > 1 && (
                          <DropdownMenuItem
                            onClick={() => onDeleteCompany(company.id)}
                            className="text-xs gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3" />
                            Delete Company
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
                      <li className="text-[11px] text-subtle italic py-1 pl-6">
                        <p>No pages inside</p>
                        <button
                          type="button"
                          onClick={() => onCreateDoc(company.id)}
                          className="mt-1 text-[11px] text-subtle hover:text-foreground flex items-center gap-1 font-medium cursor-pointer hover:bg-accent/40 px-1.5 py-0.5 rounded transition-colors"
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
  onCreateDoc: (companyId?: string, title?: string, category?: DocCategory, template?: string, parentId?: string) => void;
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

  return (
    <li className="space-y-0.5">
      <div className="group relative flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSelectDoc(doc.id)}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'p-1.5 text-xs flex items-center w-full text-left rounded-md transition-colors cursor-pointer gap-1.5',
            isActive
              ? 'bg-selected font-medium text-foreground border border-border/80'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          style={{ paddingLeft: `${level * 12 + 6}px` }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleDocExpand(doc.id);
            }}
            className="p-0.5 hover:bg-accent/70 rounded cursor-pointer shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="size-3 text-subtle" />
            ) : (
              <ChevronRight className="size-3 text-subtle" />
            )}
          </button>

          <IconRenderer
            icon={doc.icon}
            iconColor={doc.iconColor}
            fallbackEmoji="📝"
            sizeClassName="size-3.5 shrink-0"
          />
          <span className="font-medium truncate flex-1 text-xs">{doc.title}</span>
        </button>

        {/* Action Dropdown */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              toggleDocExpand(doc.id);
              onCreateDoc(companyId, 'Untitled Page', 'General', undefined, doc.id);
            }}
            className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
            title="Add Sub-page"
          >
            <Plus className="size-3 text-accent-blue" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                title="Doc Options"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onUpdateTitle && (
                <DropdownMenuItem
                  onClick={() => {
                    void prompts
                      .promptText({
                        title: 'Rename document',
                        label: 'Title',
                        defaultValue: doc.title,
                        confirmLabel: 'Rename',
                      })
                      .then((title) => {
                        if (title) onUpdateTitle(doc.id, title);
                      });
                  }}
                  className="text-xs gap-2"
                >
                  <Pencil className="size-3 text-primary" />
                  Rename Doc
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onToggleFavorite(doc.id)}
                className="text-xs gap-2"
              >
                <Star className="size-3 text-accent-amber" />
                {doc.favorite ? 'Unfavorite' : 'Favorite'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDuplicateDoc(doc.id)}
                className="text-xs gap-2"
              >
                <Copy className="size-3" />
                Duplicate Doc
              </DropdownMenuItem>

              {onMoveDocToCompany && companies.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs gap-2">
                    <MoveRight className="size-3 text-accent-blue" />
                    Move to Company
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    {companies
                      .filter((c) => c.id !== doc.companyId)
                      .map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          onClick={() => onMoveDocToCompany(doc.id, c.id)}
                          className="text-xs gap-2"
                        >
                          <Building className="size-3" />
                          {c.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {allDocs.length > 1 && (
                <DropdownMenuItem
                  /* Deleting used to fire straight off the menu item, taking any
                     sub-pages with it and with no undo anywhere in the app. */
                  onClick={() => {
                    void prompts
                      .confirmAction({
                        title: `Delete “${doc.title}”?`,
                        description:
                          childDocs.length > 0
                            ? `This also deletes ${childDocs.length} page${
                                childDocs.length === 1 ? '' : 's'
                              } inside it. This cannot be undone.`
                            : 'This cannot be undone.',
                        confirmLabel: 'Delete',
                        destructive: true,
                      })
                      .then((confirmed) => {
                        if (confirmed) onDeleteDoc(doc.id);
                      });
                  }}
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3" />
                  Delete Doc
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded Children */}
      {isExpanded && (
        <ul className="space-y-0.5">
          {childDocs.length === 0 ? (
            <li style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }} className="py-1">
              <p className="text-[11px] text-subtle italic">No pages inside</p>
              <button
                type="button"
                onClick={() => onCreateDoc(companyId, 'Untitled Page', 'General', undefined, doc.id)}
                className="mt-0.5 text-[11px] text-subtle hover:text-foreground flex items-center gap-1 font-medium cursor-pointer hover:bg-accent/40 px-1.5 py-0.5 rounded transition-colors"
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
              <li style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }} className="pt-0.5">
                <button
                  type="button"
                  onClick={() => onCreateDoc(companyId, 'Untitled Page', 'General', undefined, doc.id)}
                  className="text-[11px] text-subtle hover:text-foreground flex items-center gap-1 font-medium cursor-pointer hover:bg-accent/40 px-1.5 py-0.5 rounded transition-colors"
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

