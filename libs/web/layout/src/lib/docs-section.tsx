import {
  ActionDropdownMenu,
  Button,
  copyToClipboard,
  EntityContextMenu,
  entityUrl,
  Hint,
  IconRenderer,
  type EntityAction,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useDocsWorkspace } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Building,
  ChevronDown,
  CopyPlus,
  FileText,
  FolderPlus,
  Link2,
  MoveRight,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSplitViewAction } from './split-view/use-split-view-action.js';
import {
  FavoriteToggle,
  isOnPath,
  navActionClass,
  navIconClass,
  NAV_ROW_ACTIONS_PADDING,
  navRowClass,
  NavRowActions,
  NavRowMenuButton,
  Section,
  type NavDepth,
} from './nav-primitives.js';
import { useSidebarStore } from './navigation/sidebar-store.js';
import { useSidebarFavorites } from './use-sidebar-favorites.js';

export interface DocItemData {
  id: string;
  title: string;
  icon?: string;
  iconColor?: string;
  companyId?: string;
  parentId?: string | null;
}

/**
 * The doc the current URL points at, or null. `/docs/:docId` is the canonical
 * route; `?doc=` is the old query form, which still resolves.
 */
export function activeDocId(
  location: { pathname: string; search: string },
  workspaceSlug: string,
): string | null {
  const base = `/w/${workspaceSlug}/docs`;
  if (!isOnPath(location.pathname, base)) return null;
  const fromPath = location.pathname.slice(base.length + 1).split('/')[0];
  return fromPath || new URLSearchParams(location.search).get('doc');
}

/**
 * Indented list under a parent row. The guide line runs under the parent's
 * icon, the same treatment `NavGroup` gives its rows, so nesting reads from
 * position and not only from font weight.
 */
const NAV_NESTED_LIST_CLASS =
  'ml-4.5 pl-1.5 space-y-0.5 border-l border-border/60';

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
  const navigate = useNavigate();
  const docPath = `/w/${workspaceSlug}/docs/${doc.id}`;
  const splitAction = useSplitViewAction();
  const moveTargets = companies.filter((c) => c.id !== doc.companyId);

  /* One list behind the "⋯" menu, right-click and the touch sheet. Delete is
     confirmed by the section's handler, which knows the doc's subpages. */
  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Open',
      icon: FileText,
      run: () => navigate(docPath),
    },
    splitAction(docPath, doc.title),
    {
      id: 'add-subpage',
      group: 'edit',
      label: 'Add subpage',
      icon: Plus,
      hidden: !onAddSubpage,
      run: onAddSubpage,
    },
    {
      id: 'rename',
      group: 'edit',
      label: 'Rename…',
      icon: Pencil,
      shortcut: 'R',
      hidden: !onRename,
      run: onRename,
    },
    {
      id: 'duplicate',
      group: 'edit',
      label: 'Duplicate',
      icon: CopyPlus,
      shortcut: 'D',
      hidden: !onDuplicate,
      run: onDuplicate,
    },
    {
      id: 'favorite',
      group: 'organize',
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      shortcut: 'F',
      run: () => onToggleFavorite(doc),
    },
    {
      id: 'move',
      group: 'organize',
      label: 'Move to folder',
      icon: MoveRight,
      hidden: !onMoveToCompany || moveTargets.length === 0,
      children: moveTargets.map(
        (c): EntityAction => ({
          id: `move-${c.id}`,
          label: c.name,
          icon: Building,
          run: () => onMoveToCompany?.(c.id),
        }),
      ),
    },
    {
      id: 'copy-link',
      group: 'share',
      label: 'Copy link',
      icon: Link2,
      shortcut: 'C',
      run: () => copyToClipboard(entityUrl(docPath)),
    },
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete…',
      icon: Trash2,
      shortcut: 'Del',
      destructive: true,
      hidden: !onDelete,
      run: onDelete,
    },
  ];

  return (
    <EntityContextMenu
      actions={actions}
      scope={`doc:${doc.id}`}
      entityType="doc"
      entity={doc}
      label={doc.title}
    >
      <li className="space-y-0.5">
        {/* The hover group is the row alone: with subpages inside it, the
            actions centred on the whole block and showed while a subpage was
            hovered. */}
        <div className="group/row relative">
          <NavLink
            to={docPath}
            aria-current={isSelected ? 'page' : undefined}
            className={navRowClass(isSelected, {
              depth,
              extra: NAV_ROW_ACTIONS_PADDING,
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
            <ActionDropdownMenu
              modal={false}
              actions={actions}
              scope={`doc:${doc.id}`}
              entityType="doc"
              entity={doc}
              contentClassName="w-64"
              trigger={<NavRowMenuButton label={`Options for ${doc.title}`} />}
            />
          </NavRowActions>
        </div>

        {children ? (
          <ul className={NAV_NESTED_LIST_CLASS}>{children}</ul>
        ) : null}
      </li>
    </EntityContextMenu>
  );
}

/** Key for a docs folder in the sidebar store's persisted collapse map. */
function folderKey(folderId: string) {
  return `docs-folder:${folderId}`;
}

/**
 * The docs tree, over the same `useDocsWorkspace` projection the editor uses.
 *
 * Folders are the API's "companies"; the UI calls them folders throughout.
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
  // Persisted with the rest of the sidebar's collapse state.
  const collapsedGroups = useSidebarStore((s) => s.collapsedGroups);
  const toggleGroupCollapsed = useSidebarStore((s) => s.toggleGroupCollapsed);
  const setGroupCollapsed = useSidebarStore((s) => s.setGroupCollapsed);

  const { companies, docs } = workspace;
  const currentDocId = activeDocId(location, workspaceSlug);
  const currentFolderId = currentDocId
    ? docs.find((d) => d.id === currentDocId)?.companyId
    : undefined;

  // Opening a doc reveals it: a collapsed folder would hide where you are.
  useEffect(() => {
    if (currentFolderId) setGroupCollapsed(folderKey(currentFolderId), false);
  }, [currentFolderId, setGroupCollapsed]);

  const addFolder = async () => {
    const name = await prompts.promptText({
      title: 'New folder',
      label: 'Folder name',
      placeholder: 'e.g. Product specs',
      confirmLabel: 'Create folder',
    });
    if (!name) return;
    await workspace.addCompany(name);
  };

  const renameFolder = async (id: string, currentName: string) => {
    const name = await prompts.promptText({
      title: 'Rename folder',
      label: 'Folder name',
      defaultValue: currentName,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    workspace.renameCompany(id, name);
  };

  const deleteFolder = async (id: string, name: string, docCount: number) => {
    if (companies.length <= 1) return;

    const confirmed = await prompts.confirmAction({
      title: `Delete “${name}”?`,
      description:
        docCount === 0
          ? 'This folder is empty.'
          : `${docCount === 1 ? 'The 1 document' : `All ${docCount} documents`} inside this folder will be deleted too. This cannot be undone.`,
      confirmLabel: 'Delete folder',
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
    if (!docId) return;
    setGroupCollapsed(folderKey(companyId), false);
    navigate(`/w/${workspaceSlug}/docs/${docId}`);
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
    if (docId) navigate(`/w/${workspaceSlug}/docs/${docId}`);
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

  /* Subpages nest one level, so only a top-level doc (one given `subpages`)
     offers "Add subpage". */
  const renderDoc = (
    doc: (typeof docs)[number],
    folderId: string,
    subpages?: typeof docs,
  ) => (
    <DocNavRow
      key={doc.id}
      doc={doc}
      workspaceSlug={workspaceSlug}
      isSelected={doc.id === currentDocId}
      isFavorite={isFavorite('doc', doc.id)}
      onToggleFavorite={() => toggleFavorite('doc', doc.id)}
      onAddSubpage={subpages ? () => void addDoc(folderId, doc.id) : undefined}
      onRename={() => void renameDoc(doc.id, doc.title)}
      onDuplicate={() => void duplicateDoc(doc.id)}
      onMoveToCompany={(targetId) =>
        workspace.moveDocToCompany(doc.id, targetId)
      }
      onDelete={() => void deleteDoc(doc.id, doc.title)}
      companies={companies}
      depth={1}
    >
      {subpages && subpages.length > 0
        ? subpages.map((child) => renderDoc(child, folderId))
        : null}
    </DocNavRow>
  );

  return (
    <Section
      title="Docs & Knowledge"
      count={companies.length}
      emptyLabel={
        workspace.isLoading
          ? 'Loading docs…'
          : workspace.isError
            ? 'Docs could not be loaded'
            : undefined
      }
      action={
        <div className="gap-0.5 flex items-center opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <Hint label="New folder">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void addFolder()}
              aria-label="New folder"
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
        const folderDocs = docs.filter((d) => d.companyId === company.id);
        const rootDocs = folderDocs.filter((d) => !d.parentId);
        const isCollapsed = !!collapsedGroups[folderKey(company.id)];

        /* One list behind the "⋯" menu, right-click and the touch sheet. */
        const folderActions: EntityAction[] = [
          {
            id: 'add-doc',
            group: 'edit',
            label: 'New document',
            icon: Plus,
            run: () => void addDoc(company.id),
          },
          {
            id: 'rename',
            group: 'edit',
            label: 'Rename…',
            icon: Pencil,
            run: () => void renameFolder(company.id, company.name),
          },
          {
            id: 'delete',
            group: 'danger',
            label: 'Delete…',
            icon: Trash2,
            destructive: true,
            hidden: companies.length <= 1,
            run: () =>
              void deleteFolder(company.id, company.name, folderDocs.length),
          },
        ];

        return (
          <li key={company.id} className="space-y-0.5">
            <EntityContextMenu
              actions={folderActions}
              scope={`doc-folder:${company.id}`}
              label={company.name}
            >
              <div className="group/row relative">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(folderKey(company.id))}
                  aria-expanded={!isCollapsed}
                  className={navActionClass({
                    depth: 1,
                    extra: cn(
                      'font-semibold text-foreground',
                      NAV_ROW_ACTIONS_PADDING,
                    ),
                  })}
                >
                  <span
                    className={navIconClass(
                      1,
                      'flex items-center justify-center leading-none',
                    )}
                    aria-hidden
                  >
                    {company.icon || '📁'}
                  </span>
                  <span className="truncate">{company.name}</span>
                  <ChevronDown
                    className={cn(
                      'size-3 shrink-0 text-subtle transition-transform duration-150',
                      isCollapsed && '-rotate-90',
                    )}
                    aria-hidden
                  />
                  {/* What a closed folder is hiding. Gives way to the actions. */}
                  {isCollapsed && folderDocs.length > 0 ? (
                    <span className="font-medium ml-auto text-[11px] text-subtle tabular-nums group-focus-within/row:hidden group-hover/row:hidden pointer-coarse:hidden">
                      {folderDocs.length}
                    </span>
                  ) : null}
                </button>

                <NavRowActions>
                  <Hint label={`New document in ${company.name}`}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void addDoc(company.id)}
                      aria-label={`New document in ${company.name}`}
                      className="size-5 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </Hint>
                  <ActionDropdownMenu
                    modal={false}
                    actions={folderActions}
                    scope={`doc-folder:${company.id}`}
                    contentClassName="w-56"
                    trigger={
                      <NavRowMenuButton label={`Options for ${company.name}`} />
                    }
                  />
                </NavRowActions>
              </div>
            </EntityContextMenu>

            {!isCollapsed ? (
              <ul className={NAV_NESTED_LIST_CLASS}>
                {rootDocs.length === 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => void addDoc(company.id)}
                      className={navActionClass({
                        depth: 1,
                        extra: 'font-normal text-subtle',
                      })}
                    >
                      <Plus className={navIconClass(1)} aria-hidden />
                      <span className="flex-1 truncate">
                        Empty. Add a document
                      </span>
                    </button>
                  </li>
                ) : (
                  rootDocs.map((doc) =>
                    renderDoc(
                      doc,
                      company.id,
                      folderDocs.filter((d) => d.parentId === doc.id),
                    ),
                  )
                )}
              </ul>
            ) : null}
          </li>
        );
      })}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/docs?newDoc=true`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add doc</span>
        </NavLink>
      </li>
    </Section>
  );
}
