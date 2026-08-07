import {
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
  DropdownMenuTrigger,
  IconRenderer,
  Input,
  Panel,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Copy,
  Folder,
  LayoutTemplate,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { DocCategory, DocItem } from './docs-hook.js';

interface DocSidebarProps {
  docs: DocItem[];
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  onCreateDoc: (title?: string, category?: DocCategory, template?: string) => void;
  onDuplicateDoc: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onUpdateIcon?: (id: string, icon: string, iconColor?: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
}

export function DocSidebar({
  docs,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDuplicateDoc,
  onToggleFavorite,
  onDeleteDoc,
  onUpdateIcon,
  onUpdateTitle,
}: DocSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

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
      className="md:w-72 w-full shrink-0 flex flex-col justify-between"
      title={
        <span className="gap-2 flex items-center">
          <Folder className="size-4 text-accent-blue" aria-hidden />
          <span>Notion Docs Tree</span>
        </span>
      }
      actions={
        <div className="flex items-center gap-1">
          {/* Templates Launcher Modal */}
          <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Notion Templates"
                aria-label="Notion Templates"
              >
                <LayoutTemplate className="size-3.5 text-accent-blue" />
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
                    onCreateDoc('Product Requirements Document', 'Engineering', 'prd');
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
                    onCreateDoc('Sprint Sync Notes', 'General', 'meeting');
                    setIsTemplateDialogOpen(false);
                  }}
                  className="w-full p-3 rounded-lg border border-border bg-surface-raised hover:border-emerald-500 hover:bg-accent/40 text-left transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                    📊
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground group-hover:text-emerald-400">
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
            <Plus className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-subtle" />
          <Input
            placeholder="Search docs or blocks..."
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
        {favoriteDocs.length > 0 && selectedCategoryFilter === 'All' && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1 px-1">
              <Star className="size-3 fill-amber-400" />
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

        {/* All Documents Tree */}
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle px-1">
            {selectedCategoryFilter === 'All' ? 'All Workspace Pages' : selectedCategoryFilter}
          </p>
          <nav aria-label="Docs Tree Directory">
            <ul className="space-y-1">
              {filteredDocs.map((docItem) => {
                const isActive = docItem.id === activeDocId;
                return (
                  <li key={docItem.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectDoc(docItem.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'p-2.5 text-xs flex flex-col w-full text-left rounded-lg transition-colors cursor-pointer',
                        isActive
                          ? 'bg-selected font-medium text-foreground border border-border/80'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 truncate pr-6">
                          <IconRenderer
                            icon={docItem.icon}
                            iconColor={docItem.iconColor}
                            sizeClassName="size-4 shrink-0"
                          />
                          <span className="font-semibold text-foreground truncate">
                            {docItem.title}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-subtle line-clamp-1 mt-1 pl-6">
                        {docItem.snippet}
                      </p>
                    </button>

                    {/* Doc Item Action Dropdown */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2.5">
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
                        <DropdownMenuContent align="end" className="w-44">
                          {onUpdateTitle && (
                            <DropdownMenuItem
                              onClick={() => {
                                const newTitle = prompt('Enter new document title:', docItem.title);
                                if (newTitle && newTitle.trim()) {
                                  onUpdateTitle(docItem.id, newTitle.trim());
                                }
                              }}
                              className="text-xs gap-2"
                            >
                              <Pencil className="size-3 text-primary" />
                              Rename Doc
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => onToggleFavorite(docItem.id)}
                            className="text-xs gap-2"
                          >
                            <Star className="size-3 text-amber-400" />
                            {docItem.favorite ? 'Unfavorite' : 'Favorite'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDuplicateDoc(docItem.id)}
                            className="text-xs gap-2"
                          >
                            <Copy className="size-3" />
                            Duplicate Doc
                          </DropdownMenuItem>
                          {docs.length > 1 && (
                            <DropdownMenuItem
                              onClick={() => onDeleteDoc(docItem.id)}
                              className="text-xs gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3" />
                              Delete Doc
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </Panel>
  );
}
