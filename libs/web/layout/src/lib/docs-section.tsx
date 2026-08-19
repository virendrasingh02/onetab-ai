import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Hint,
  IconRenderer,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useDocsWorkspace } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Building,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderPlus,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FavoriteToggle,
  navActionClass,
  navGroupHeaderClass,
  navGroupTriggerClass,
  navIconClass,
  navRowClass,
  NavRowActions,
  NavRowMenuTrigger,
  Section,
  useCopyLink,
  type NavDepth,
} from './nav-primitives.js';
import { useSidebarFavorites } from './use-sidebar-favorites.js';

export interface DocItemData {
  id: string;
  title: string;
  icon?: string;
  iconColor?: string;
  companyId?: string;
  parentId?: string | null;
}

export function DocNavRow({
  doc,
  workspaceSlug,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onAddSubpage,
  onRename,
  onDuplicate,
  onMoveToCompany,
  onDelete,
  companies = [],
  depth = 1,
  children,
}: {
  doc: DocItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (doc: DocItemData) => void;
  onAddSubpage?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onMoveToCompany?: (companyId: string) => void;
  onDelete?: () => void;
  companies?: readonly { id: string; name: string }[];
  depth?: NavDepth;
  children?: React.ReactNode;
}) {
  const docUrl = `${window.location.origin}/w/${workspaceSlug}/docs?doc=${doc.id}`;
  const { copied, copy: handleCopyLink } = useCopyLink(docUrl);
  /* "Share" copies the same link; it only differs in the confirmation it shows. */
  const { copied: shared, copy: handleShare } = useCopyLink(docUrl);

  return (
    <li className="group/row relative space-y-0.5">
      <NavLink
        to={`/w/${workspaceSlug}/docs?doc=${doc.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
      >
        <IconRenderer
          icon={doc.icon}
          iconColor={doc.iconColor}
          fallbackEmoji="📝"
          sizeClassName={navIconClass(depth)}
        />
        <span className="flex-1 truncate">{doc.title}</span>
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle
          isFavorite={isFavorite}
          onToggle={() => onToggleFavorite(doc)}
        />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${doc.title}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            {onAddSubpage ? (
              <DropdownMenuItem
                onSelect={onAddSubpage}
                className="gap-2.5"
              >
                <Plus className="size-4" />
                <span>Add subpage</span>
              </DropdownMenuItem>
            ) : null}

            {onRename ? (
              <DropdownMenuItem
                onSelect={onRename}
                className="gap-2.5"
              >
                <Pencil className="size-4" />
                <span>Rename doc</span>
              </DropdownMenuItem>
            ) : null}

            {onDuplicate ? (
              <DropdownMenuItem
                onSelect={onDuplicate}
                className="gap-2.5"
              >
                <Copy className="size-4" />
                <span>Duplicate doc</span>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => onToggleFavorite(doc)}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            {companies.length > 1 && onMoveToCompany ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2.5">
                  <MoveRight className="size-4" />
                  <span>Move to folder</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {companies
                    .filter((c) => c.id !== doc.companyId)
                    .map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() => onMoveToCompany(c.id)}
                        className="gap-2.5 text-xs"
                      >
                        <Building className="size-3.5" />
                        <span>{c.name}</span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}

            <DropdownMenuItem
              onSelect={handleShare}
              className="gap-2.5"
            >
              {shared ? (
                <Check className="size-4 text-success-text" />
              ) : (
                <Share2 className="size-4" />
              )}
              <span>{shared ? 'Link copied!' : 'Sharing & Permissions'}</span>
            </DropdownMenuItem>

            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onDelete}
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Delete doc</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>

      {children}
    </li>
  );
}

/**
 * The docs tree, over the same `useDocsWorkspace` projection the editor uses.
 */
export function DocsTreeSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts: PromptDialog;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceId } = useCurrentWorkspace();
  const workspace = useDocsWorkspace(workspaceId);
  const { isFavorite, toggleFavorite } = useSidebarFavorites(workspaceId);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { companies, docs } = workspace;

  const toggleCompany = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const addCompany = async () => {
    const name = await prompts.promptText({
      title: 'Add company',
      label: 'Company name',
      placeholder: 'Acme Inc.',
      confirmLabel: 'Add company',
    });
    if (!name) return;
    await workspace.addCompany(name);
  };

  const renameCompany = async (id: string, currentName: string) => {
    const name = await prompts.promptText({
      title: 'Rename company',
      label: 'Company name',
      defaultValue: currentName,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    workspace.renameCompany(id, name);
  };

  const deleteCompany = async (id: string, name: string) => {
    if (companies.length <= 1) return;

    const confirmed = await prompts.confirmAction({
      title: `Delete “${name}”?`,
      description: 'Every document inside this company is deleted too.',
      confirmLabel: 'Delete company',
      destructive: true,
    });
    if (!confirmed) return;

    await workspace.deleteCompany(id);
  };

  const addDoc = async (companyId: string, parentId?: string) => {
    const docId = await workspace.createDoc(
      companyId,
      undefined,
      undefined,
      undefined,
      parentId,
    );
    if (docId) navigate(`/w/${workspaceSlug}/docs?doc=${docId}`);
  };

  const renameDoc = async (id: string, currentTitle: string) => {
    const title = await prompts.promptText({
      title: 'Rename document',
      label: 'Document title',
      defaultValue: currentTitle,
      confirmLabel: 'Rename',
    });
    if (!title) return;
    workspace.updateDocTitle(id, title);
  };

  const duplicateDoc = async (id: string) => {
    const docId = await workspace.duplicateDoc(id);
    if (docId) navigate(`/w/${workspaceSlug}/docs?doc=${docId}`);
  };

  const deleteDoc = async (id: string, title: string) => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${title}”?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete document',
      destructive: true,
    });
    if (!confirmed) return;
    workspace.deleteDoc(id);
  };

  return (
    <Section
      title="Docs & Knowledge"
      count={companies.length}
      emptyLabel={
        workspace.isLoading
          ? 'Loading docs…'
          : workspace.isError
            ? 'Docs could not be loaded'
            : 'No docs yet'
      }
      action={
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-within:opacity-100">
          <Hint label="Add company">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void addCompany()}
              aria-label="Add company"
              className="size-5 p-0"
            >
              <FolderPlus className="size-3.5" />
            </Button>
          </Hint>
          <Hint label="New document">
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label="New document"
              className="size-5 p-0"
            >
              <NavLink to={`/w/${workspaceSlug}/docs?newDoc=true`}>
                <Plus className="size-3.5" />
              </NavLink>
            </Button>
          </Hint>
        </div>
      }
    >
      {companies.map((company) => {
        const companyDocs = docs.filter((d) => d.companyId === company.id);
        const rootDocs = companyDocs.filter((d) => !d.parentId);
        const isCollapsed = !!collapsed[company.id];

        return (
          <li key={company.id} className="mt-1 space-y-0.5">
            <div
              className={navGroupHeaderClass({ extra: 'group/comp relative' })}
            >
              <button
                type="button"
                onClick={() => toggleCompany(company.id)}
                aria-expanded={!isCollapsed}
                className={cn(navGroupTriggerClass, 'group/comp-btn')}
              >
                <span className="shrink-0">{company.icon || '🏠'}</span>
                <span className="truncate">{company.name}</span>
                <ChevronDown
                  className={cn(
                    'size-3 shrink-0 text-subtle opacity-0 transition-all duration-150',
                    'group-hover/comp:opacity-100 group-focus-within/comp:opacity-100',
                    isCollapsed && '-rotate-90',
                  )}
                  aria-hidden
                />
              </button>

              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/comp:opacity-100 group-focus-within/comp:opacity-100">
                <Hint label={`Add doc in ${company.name}`}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void addDoc(company.id)}
                    aria-label={`Add doc in ${company.name}`}
                    className="size-5 p-0"
                  >
                    <Plus className="size-3" />
                  </Button>
                </Hint>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-5 p-0"
                      aria-label={`Options for ${company.name}`}
                    >
                      <MoreVertical className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onSelect={() => void addDoc(company.id)}
                      className="gap-2 text-xs"
                    >
                      <Plus className="size-3" />
                      Add doc
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void renameCompany(company.id, company.name)
                      }
                      className="gap-2 text-xs"
                    >
                      <Pencil className="size-3" />
                      Rename folder
                    </DropdownMenuItem>
                    {companies.length > 1 ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          void deleteCompany(company.id, company.name)
                        }
                        className="gap-2 text-xs"
                      >
                        <Trash2 className="size-3" />
                        Delete folder
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {!isCollapsed ? (
              <ul className="space-y-0.5">
                {rootDocs.length === 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => void addDoc(company.id)}
                      className={navActionClass({ depth: 1 })}
                    >
                      <Plus className={navIconClass(1)} aria-hidden />
                      <span className="flex-1 truncate">
                        Add the first page
                      </span>
                    </button>
                  </li>
                ) : (
                  rootDocs.map((doc) => {
                    const isSelected =
                      location.pathname.includes('/docs') &&
                      location.search.includes(`doc=${doc.id}`);
                    const children = companyDocs.filter(
                      (d) => d.parentId === doc.id,
                    );

                    return (
                      <DocNavRow
                        key={doc.id}
                        doc={doc}
                        workspaceSlug={workspaceSlug}
                        isSelected={isSelected}
                        isFavorite={isFavorite('doc', doc.id)}
                        onToggleFavorite={() => toggleFavorite('doc', doc.id)}
                        onAddSubpage={() => void addDoc(company.id, doc.id)}
                        onRename={() => void renameDoc(doc.id, doc.title)}
                        onDuplicate={() => void duplicateDoc(doc.id)}
                        onMoveToCompany={(targetCompanyId) =>
                          workspace.moveDocToCompany(doc.id, targetCompanyId)
                        }
                        onDelete={() => void deleteDoc(doc.id, doc.title)}
                        companies={companies}
                        depth={1}
                      >
                        {children.length > 0 ? (
                          <ul className="space-y-0.5">
                            {children.map((child) => {
                              const childSelected =
                                location.pathname.includes('/docs') &&
                                location.search.includes(`doc=${child.id}`);
                              return (
                                <DocNavRow
                                  key={child.id}
                                  doc={child}
                                  workspaceSlug={workspaceSlug}
                                  isSelected={childSelected}
                                  isFavorite={isFavorite('doc', child.id)}
                                  onToggleFavorite={() =>
                                    toggleFavorite('doc', child.id)
                                  }
                                  onRename={() =>
                                    void renameDoc(child.id, child.title)
                                  }
                                  onDuplicate={() =>
                                    void duplicateDoc(child.id)
                                  }
                                  onMoveToCompany={(targetCompanyId) =>
                                    workspace.moveDocToCompany(
                                      child.id,
                                      targetCompanyId,
                                    )
                                  }
                                  onDelete={() =>
                                    void deleteDoc(child.id, child.title)
                                  }
                                  companies={companies}
                                  depth={2}
                                />
                              );
                            })}
                          </ul>
                        ) : null}
                      </DocNavRow>
                    );
                  })
                )}
              </ul>
            ) : null}
          </li>
        );
      })}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/docs?tab=all&newDoc=true`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add doc</span>
        </NavLink>
      </li>
    </Section>
  );
}
