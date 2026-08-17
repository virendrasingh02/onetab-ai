import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Hint,
  IconRenderer,
  type PromptDialog,
} from '@org/ui';
import { useDocsWorkspace } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Building,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderPlus,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  navActionClass,
  navGroupHeaderClass,
  navGroupTriggerClass,
  navIconClass,
  navRowClass,
  Section,
} from './nav-primitives.js';


/**
 * The docs tree, over the same `useDocsWorkspace` projection the editor uses.
 *
 * Sharing that hook is the point: the sidebar and `/docs` read one cache, so a
 * page created here opens in the editor by the id the server assigned it. The
 * tree used to be a local-storage store with ids of its own, which meant every
 * row in it navigated to a document that did not exist.
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
    /*
     * The old code called `alert()` when this was the last company. Now the
     * action is simply not offered — the menu item is already conditional on
     * there being more than one, so this is belt and braces.
     */
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

  /** Creates the page server-side, then opens it — ids come from the API. */
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
        <div className="flex items-center gap-0.5">
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
            {/*
              Rebuilt on the shared row geometry. This header used to be a
              one-off (`rounded-md px-2 py-1`, `text-[11px]`, `hover:bg-accent/60`)
              that matched nothing else in the sidebar.
            */}
            <div className={navGroupHeaderClass({ extra: 'group/comp relative' })}>
              <button
                type="button"
                onClick={() => toggleCompany(company.id)}
                aria-expanded={!isCollapsed}
                className={navGroupTriggerClass}
              >
                {isCollapsed ? (
                  <ChevronRight
                    className={navIconClass(0, 'text-subtle')}
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    className={navIconClass(0, 'text-subtle')}
                    aria-hidden
                  />
                )}
                <span className="shrink-0">{company.icon || '🏠'}</span>
                <span className="truncate">{company.name}</span>
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
                      onSelect={() => void renameCompany(company.id, company.name)}
                      className="gap-2 text-xs"
                    >
                      <Pencil className="size-3" />
                      Rename folder
                    </DropdownMenuItem>
                    {companies.length > 1 ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => void deleteCompany(company.id, company.name)}
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
              /* Indentation comes from the rows' own `depth` now. The old
                 `ml-2 border-l pl-1` guide rail added a second, competing
                 indent system — and drew a rule that no other tree used. */
              <ul className="space-y-0.5">
                {rootDocs.length === 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => void addDoc(company.id)}
                      className={navActionClass({ depth: 1 })}
                    >
                      <Plus className={navIconClass(1)} aria-hidden />
                      <span className="flex-1 truncate">Add the first page</span>
                    </button>
                  </li>
                ) : (
                  rootDocs.map((doc) => {
                    const isSelected =
                      location.pathname.includes('/docs') &&
                      location.search.includes(`doc=${doc.id}`);
                    const children = companyDocs.filter((d) => d.parentId === doc.id);

                    return (
                      <li key={doc.id} className="group/doc relative space-y-0.5">
                        <NavLink
                          to={`/w/${workspaceSlug}/docs?doc=${doc.id}`}
                          className={navRowClass(isSelected, {
                            depth: 1,
                            extra: 'pr-8',
                          })}
                        >
                          <IconRenderer
                            icon={doc.icon}
                            iconColor={doc.iconColor}
                            fallbackEmoji="📝"
                            sizeClassName={navIconClass(1)}
                          />
                          <span className="flex-1 truncate">{doc.title}</span>
                        </NavLink>

                        <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover/doc:opacity-100 group-focus-within/doc:opacity-100">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-5 p-0"
                                aria-label={`Options for ${doc.title}`}
                              >
                                <MoreVertical className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onSelect={() => void addDoc(company.id, doc.id)}
                                className="gap-2 text-xs"
                              >
                                <Plus className="size-3" />
                                Add subpage
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void renameDoc(doc.id, doc.title)}
                                className="gap-2 text-xs"
                              >
                                <Pencil className="size-3" />
                                Rename doc
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void duplicateDoc(doc.id)}
                                className="gap-2 text-xs"
                              >
                                <Copy className="size-3" />
                                Duplicate doc
                              </DropdownMenuItem>
                              {companies.length > 1 ? (
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="gap-2 text-xs">
                                    <MoveRight className="size-3" />
                                    Move to folder
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="w-44">
                                    {companies
                                      .filter((c) => c.id !== doc.companyId)
                                      .map((c) => (
                                        <DropdownMenuItem
                                          key={c.id}
                                          onSelect={() =>
                                            workspace.moveDocToCompany(doc.id, c.id)
                                          }
                                          className="gap-2 text-xs"
                                        >
                                          <Building className="size-3" />
                                          {c.name}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              ) : null}
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => void deleteDoc(doc.id, doc.title)}
                                className="gap-2 text-xs"
                              >
                                <Trash2 className="size-3" />
                                Delete doc
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {children.length > 0 ? (
                          <ul className="space-y-0.5">
                            {children.map((child) => {
                              const childSelected =
                                location.pathname.includes('/docs') &&
                                location.search.includes(`doc=${child.id}`);
                              return (
                                <li key={child.id}>
                                  <NavLink
                                    to={`/w/${workspaceSlug}/docs?doc=${child.id}`}
                                    className={navRowClass(childSelected, { depth: 2 })}
                                  >
                                    <IconRenderer
                                      icon={child.icon}
                                      iconColor={child.iconColor}
                                      fallbackEmoji="📝"
                                      sizeClassName={navIconClass(2)}
                                    />
                                    <span className="flex-1 truncate">{child.title}</span>
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
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
