import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  IconRenderer,
  Hint,
  ScrollArea,
  SkeletonList,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
  Activity,
  Building,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Hash,
  Lock,
  MessagesSquare,
  MoveRight,
  Plus,
  Star,
  Users,
  Video,
  FileText,
  HardDrive,
  Bot,
  Workflow,
  Sparkles,
  Clock,
  Inbox,
  Share2,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Home,
  FolderKanban,
  Package,
  ArrowRight,
  SquarePen,
  Settings,
  Headphones,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  end?: boolean;
}

// Most Used / Essential Nav Items (Shown directly)
const MOST_USED_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, end: true },
  { path: 'inbox', label: 'Inbox', icon: Inbox },
  { path: 'threads', label: 'Threads', icon: MessagesSquare },
  { path: 'meetings', label: 'Meetings', icon: Video },
];

// Secondary Nav Items (Collapsible inside 'More' dropdown menu)
const SECONDARY_LINKS: readonly NavEntry[] = [
  { path: 'pulse', label: 'Pulse', icon: Activity },
  { path: 'schedule', label: 'Schedule', icon: Clock },
  { path: 'tasks', label: 'Projects', icon: FolderKanban },
  { path: 'docs', label: 'Docs', icon: FileText },
  { path: 'directory', label: 'Team Directory', icon: Users },
  { path: 'files', label: 'Files', icon: HardDrive },
  { path: 'settings', label: 'Settings', icon: Settings },
];

const AGENTS_LINKS: readonly NavEntry[] = [
  { path: 'agents', label: 'Agent Directory', icon: Bot, end: true },
  { path: 'agents/builder', label: 'Agent Studio', icon: Bot },
  { path: 'agents/logs', label: 'Agent Logs', icon: HardDrive },
];

const APPS_LINKS: readonly NavEntry[] = [
  { path: 'integrations', label: 'App Directory', icon: Share2, end: true },
];

const AUTOMATION_LINKS: readonly NavEntry[] = [
  { path: 'automations', label: 'Workflows', icon: Workflow, end: true },
  { path: 'automations/builder', label: 'Workflow Builder', icon: Workflow },
  { path: 'automations/logs', label: 'Workflow Logs', icon: HardDrive },
];

/**
 * One nav row. The active indicator is a 2px pseudo-element rather than a real
 * border so switching rows never reflows the list by a pixel.
 */
function navRowClass(isActive: boolean, extra?: string) {
  return cn(
    'group relative flex items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
    'transition-colors duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5',
    'before:-translate-y-1/2 before:rounded-full before:bg-primary',
    'before:transition-opacity before:duration-(--duration-fast)',
    isActive
      ? 'bg-selected font-medium text-foreground before:opacity-100'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground before:opacity-0',
    extra,
  );
}

function NavRow({
  entry,
  workspaceSlug,
}: {
  entry: NavEntry;
  workspaceSlug: string;
}) {
  const Icon = entry.icon;
  const to = entry.path
    ? `/w/${workspaceSlug}/${entry.path}`
    : `/w/${workspaceSlug}`;

  return (
    <NavLink
      to={to}
      end={entry.end}
      className={({ isActive }) => navRowClass(isActive)}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{entry.label}</span>
      {entry.badge ? (
        <Badge variant="count" aria-label={`${entry.badge} unread`}>
          {entry.badge}
        </Badge>
      ) : null}
    </NavLink>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}

function Section({
  title,
  count,
  children,
  action,
  defaultOpen = true,
}: SectionProps) {
  if (count === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-3 mb-1" asChild>
      <section>
        <div className="group flex select-none items-center gap-1.5 px-3 py-1">
          <CollapsibleTrigger
            className={cn(
              'group/trigger flex flex-1 items-center gap-1.5 rounded-md',
              'text-[11px] font-medium tracking-wide text-subtle uppercase',
              'transition-colors duration-(--duration-fast) hover:text-muted-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <ChevronDown
              className="size-3.5 shrink-0 transition-transform duration-(--duration-fast) group-data-[state=closed]/trigger:-rotate-90"
              aria-hidden
            />
            <span>{title}</span>
            {count === undefined ? null : (
              <span className="text-subtle tabular-nums">{count}</span>
            )}
          </CollapsibleTrigger>
          {action}
        </div>

        <CollapsibleContent>
          <ul className="mt-0.5 space-y-0.5 px-1">{children}</ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function ProjectsTreeSection({ workspaceSlug }: { workspaceSlug: string }) {
  const location = useLocation();

  const loadProjects = () => {
    try {
      const saved = localStorage.getItem('onetab_project_boards_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [
      { id: 'proj_product', name: 'Q3 Product & Release', color: 'violet', icon: 'Rocket', iconColor: '#5E6AD2' },
      { id: 'proj_design', name: 'Website & UI Redesign', color: 'blue', icon: 'Sparkles', iconColor: '#4EA7FC' },
      { id: 'proj_api', name: 'AI & Vector Pipeline', color: 'green', icon: 'Cpu', iconColor: '#4CB782' },
    ];
  };

  const [projects, setProjects] = useState(loadProjects);

  useEffect(() => {
    const handleSync = () => {
      setProjects(loadProjects());
    };
    window.addEventListener('onetab_projects_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('onetab_projects_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);



  const handleDeleteProject = (projId: string) => {
    if (projects.length <= 1) return;
    const updated = projects.filter((p: any) => p.id !== projId);
    setProjects(updated);
    try {
      localStorage.setItem('onetab_project_boards_v2', JSON.stringify(updated));
      window.dispatchEvent(new Event('onetab_projects_updated'));
    } catch {
      // ignore
    }
  };

  const handleRenameProject = (projId: string, currentName: string) => {
    const newName = prompt('Enter new project name:', currentName);
    if (newName && newName.trim()) {
      const updated = projects.map((p: any) =>
        p.id === projId ? { ...p, name: newName.trim() } : p
      );
      setProjects(updated);
      try {
        localStorage.setItem('onetab_project_boards_v2', JSON.stringify(updated));
        window.dispatchEvent(new Event('onetab_projects_updated'));
      } catch {
        // ignore
      }
    }
  };

  return (
    <Section
      title="Projects"
      defaultOpen={true}
      action={
        <Hint label="New Project">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New Project"
            className="size-5 hover:bg-accent p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/tasks?newProject=true`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {projects.map((proj: any, index: number) => {
        const projTo = `/w/${workspaceSlug}/tasks?project=${proj.id}`;
        const isSelected =
          location.pathname.includes('/tasks') &&
          (location.search.includes(`project=${proj.id}`) ||
            (!location.search.includes('project=') && index === 0));

        return (
          <li key={proj.id} className="group/proj relative">
            <NavLink
              to={projTo}
              className={navRowClass(isSelected, 'pl-6 pr-8 text-[12px] flex items-center gap-2')}
            >
              <IconRenderer
                icon={proj.icon}
                iconColor={proj.iconColor}
                fallbackEmoji="📁"
                sizeClassName="size-3.5 shrink-0"
              />
              <span className="flex-1 truncate">{proj.name}</span>
            </NavLink>

            {/* Project Options Dropdown */}
            <div className="opacity-0 group-hover/proj:opacity-100 transition-opacity absolute right-1.5 top-1/2 -translate-y-1/2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                    title="Project Options"
                  >
                    <MoreVertical className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => handleRenameProject(proj.id, proj.name)}
                    className="text-xs gap-2"
                  >
                    <Pencil className="size-3 text-primary" />
                    Rename Project
                  </DropdownMenuItem>
                  {projects.length > 1 && (
                    <DropdownMenuItem
                      onClick={() => handleDeleteProject(proj.id)}
                      className="text-xs gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3" />
                      Delete Project
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}

      <NavLink
        to={`/w/${workspaceSlug}/tasks?newProject=true`}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
          'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
          'hover:bg-accent hover:text-foreground',
          'outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">Add project</span>
      </NavLink>
    </Section>
  );
}

function DocsTreeSection({ workspaceSlug }: { workspaceSlug: string }) {
  const location = useLocation();

  const loadStore = () => {
    try {
      const saved = localStorage.getItem('onetab_company_docs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.companies) && parsed.companies.length > 0 && Array.isArray(parsed.docs)) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return {
      companies: [{ id: 'company_onetab', name: 'Onetab AI', icon: '🏢' }],
      docs: [
        { id: 'doc_onetab_arch', companyId: 'company_onetab', title: 'Onetab AI System Architecture', icon: '🏗️' },
        { id: 'doc_onetab_guide', companyId: 'company_onetab', title: 'Onetab AI Design System Tokens', icon: '🎨' },
        { id: 'doc_onetab_roadmap', companyId: 'company_onetab', title: 'Onetab AI Product Roadmap 2026', icon: '⚡' },
      ],
    };
  };

  const [store, setStore] = useState(loadStore);
  const [collapsedCompanies, setCollapsedCompanies] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleSync = () => {
      setStore(loadStore());
    };
    window.addEventListener('onetab_docs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('onetab_docs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const companies = store.companies || [];
  const docs = store.docs || [];

  const toggleCompanyCollapse = (companyId: string) => {
    setCollapsedCompanies((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  const saveStore = (updatedStore: { companies: any[]; docs: any[] }) => {
    setStore(updatedStore);
    try {
      localStorage.setItem('onetab_company_docs_v1', JSON.stringify(updatedStore));
      window.dispatchEvent(new Event('onetab_docs_updated'));
    } catch {
      // ignore
    }
  };

  const handleAddCompany = () => {
    const companyName = prompt('Enter company name:')?.trim();
    if (!companyName) return;

    const newCompany = {
      id: `company_${Date.now()}`,
      name: companyName,
      icon: '🏢',
    };

    const newDoc = {
      id: `doc_${Date.now()}`,
      companyId: newCompany.id,
      title: `${companyName} Overview`,
      icon: '📝',
      snippet: 'Welcome to company documentation.',
    };

    saveStore({
      companies: [...companies, newCompany],
      docs: [newDoc, ...docs],
    });
  };

  const handleRenameCompany = (companyId: string, currentName: string) => {
    const newName = prompt('Enter new company name:', currentName)?.trim();
    if (!newName) return;

    saveStore({
      companies: companies.map((c: any) => (c.id === companyId ? { ...c, name: newName } : c)),
      docs,
    });
  };

  const handleDeleteCompany = (companyId: string) => {
    if (companies.length <= 1) {
      alert('Workspace requires at least one company.');
      return;
    }
    if (!confirm('Are you sure you want to delete this company and all its docs?')) return;

    saveStore({
      companies: companies.filter((c: any) => c.id !== companyId),
      docs: docs.filter((d: any) => d.companyId !== companyId),
    });
  };

  const handleAddDocToCompany = (companyId: string) => {
    const newDoc = {
      id: `doc_${Date.now()}`,
      companyId: companyId,
      title: 'Untitled Document',
      icon: '📝',
      snippet: 'Start writing...',
    };

    saveStore({
      companies,
      docs: [newDoc, ...docs],
    });
  };

  const handleDeleteDoc = (docId: string) => {
    if (docs.length <= 1) return;
    saveStore({
      companies,
      docs: docs.filter((d: any) => d.id !== docId),
    });
  };

  const handleRenameDoc = (docId: string, currentTitle: string) => {
    const newTitle = prompt('Enter new document title:', currentTitle);
    if (newTitle && newTitle.trim()) {
      saveStore({
        companies,
        docs: docs.map((d: any) => (d.id === docId ? { ...d, title: newTitle.trim() } : d)),
      });
    }
  };

  const handleDuplicateDoc = (docId: string) => {
    const source = docs.find((d: any) => d.id === docId);
    if (!source) return;
    const newDoc = {
      ...source,
      id: `doc_${Date.now()}`,
      title: `${source.title} (Copy)`,
      updatedAt: 'Just now',
    };
    saveStore({
      companies,
      docs: [newDoc, ...docs],
    });
  };

  const handleMoveDoc = (docId: string, targetCompanyId: string) => {
    saveStore({
      companies,
      docs: docs.map((d: any) => (d.id === docId ? { ...d, companyId: targetCompanyId } : d)),
    });
  };

  return (
    <Section
      title="Docs & Knowledge"
      defaultOpen={true}
      action={
        <div className="flex items-center gap-1">
          <Hint label="Add Company">
            <button
              type="button"
              onClick={handleAddCompany}
              aria-label="Add Company"
              className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <FolderPlus className="size-3.5 text-accent-blue" />
            </button>
          </Hint>
          <Hint label="New Document">
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label="New Document"
              className="size-5 hover:bg-accent p-0"
            >
              <NavLink to={`/w/${workspaceSlug}/docs?newDoc=true`}>
                <Plus className="size-3.5" />
              </NavLink>
            </Button>
          </Hint>
        </div>
      }
    >

      {/* Company Tree Folders */}
      {companies.map((company: any) => {
        const companyDocs = docs.filter((d: any) => d.companyId === company.id || (!d.companyId && company.id === companies[0]?.id));
        const rootDocs = companyDocs.filter((d: any) => !d.parentId);
        const isCollapsed = !!collapsedCompanies[company.id];

        return (
          <li key={company.id} className="space-y-0.5 mt-1">
            {/* Company Folder Header */}
            <div className="group/comp relative flex items-center justify-between px-2 py-1 rounded-md hover:bg-accent/60 transition-colors">
              <button
                type="button"
                onClick={() => toggleCompanyCollapse(company.id)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-foreground flex-1 truncate cursor-pointer text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3 text-subtle shrink-0" />
                ) : (
                  <ChevronDown className="size-3 text-subtle shrink-0" />
                )}
                <span className="text-xs shrink-0">{company.icon || '🏠'}</span>
                <span className="truncate">{company.name}</span>
                <Badge variant="neutral" className="ml-1 text-[9px] px-1 py-0 h-3.5">
                  {companyDocs.length}
                </Badge>
              </button>

              {/* Company Hover Actions */}
              <div className="opacity-0 group-hover/comp:opacity-100 transition-opacity flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleAddDocToCompany(company.id)}
                  className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                  title="Add Doc in Company"
                >
                  <Plus className="size-3 text-accent-blue" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                      title="Company Options"
                    >
                      <MoreVertical className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => handleAddDocToCompany(company.id)}
                      className="text-xs gap-2"
                    >
                      <Plus className="size-3 text-accent-blue" />
                      Add Doc in {company.name}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRenameCompany(company.id, company.name)}
                      className="text-xs gap-2"
                    >
                      <Pencil className="size-3 text-primary" />
                      Rename Company
                    </DropdownMenuItem>
                    {companies.length > 1 && (
                      <DropdownMenuItem
                        onClick={() => handleDeleteCompany(company.id)}
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

            {/* Company Nested Docs */}
            {!isCollapsed && (
              <ul className="space-y-0.5 pl-2 border-l border-border/40 ml-2">
                {rootDocs.length === 0 ? (
                  <li className="text-[10px] text-subtle italic py-1 pl-4">
                    <p>No pages inside</p>
                    <button
                      type="button"
                      onClick={() => handleAddDocToCompany(company.id)}
                      className="mt-0.5 text-[10px] text-subtle hover:text-foreground flex items-center gap-1 font-medium cursor-pointer hover:bg-accent/40 px-1.5 py-0.5 rounded transition-colors"
                    >
                      <Plus className="size-2.5 text-accent-blue" />
                      Add new
                    </button>
                  </li>
                ) : (
                  rootDocs.map((docItem: any) => {
                    const docTo = `/w/${workspaceSlug}/docs?doc=${docItem.id}`;
                    const isSelected = location.pathname.includes('/docs') && location.search.includes(`doc=${docItem.id}`);
                    const childDocs = companyDocs.filter((d: any) => d.parentId === docItem.id);

                    return (
                      <li key={docItem.id} className="group/doc relative space-y-0.5">
                        <div className="flex items-center justify-between">
                          <NavLink
                            to={docTo}
                            className={navRowClass(isSelected, 'pl-1.5 pr-6 text-[11px] flex items-center gap-1.5 flex-1')}
                          >
                            <IconRenderer
                              icon={docItem.icon}
                              iconColor={docItem.iconColor}
                              fallbackEmoji="📝"
                              sizeClassName="size-3 shrink-0"
                            />
                            <span className="flex-1 truncate">{docItem.title}</span>
                          </NavLink>

                          {/* Doc Item Dropdown Options */}
                          <div className="opacity-0 group-hover/doc:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="p-0.5 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                                  title="Doc Options"
                                >
                                  <MoreVertical className="size-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() => handleRenameDoc(docItem.id, docItem.title)}
                                  className="text-xs gap-2"
                                >
                                  <Pencil className="size-3 text-primary" />
                                  Rename Doc
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicateDoc(docItem.id)}
                                  className="text-xs gap-2"
                                >
                                  <Copy className="size-3" />
                                  Duplicate Doc
                                </DropdownMenuItem>
                                {companies.length > 1 && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-xs gap-2">
                                      <MoveRight className="size-3 text-accent-blue" />
                                      Move to Company
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-44">
                                      {companies
                                        .filter((c: any) => c.id !== docItem.companyId)
                                        .map((c: any) => (
                                          <DropdownMenuItem
                                            key={c.id}
                                            onClick={() => handleMoveDoc(docItem.id, c.id)}
                                            className="text-xs gap-2"
                                          >
                                            <Building className="size-3" />
                                            {c.name}
                                          </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}
                                {docs.length > 1 && (
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteDoc(docItem.id)}
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

                        {/* Child sub-pages */}
                        <ul className="pl-3 space-y-0.5 border-l border-border/30 ml-2">
                          {childDocs.length === 0 ? (
                            <li className="text-[10px] text-subtle italic py-0.5 pl-2">
                              No pages inside
                            </li>
                          ) : (
                            childDocs.map((child: any) => {
                              const childTo = `/w/${workspaceSlug}/docs?doc=${child.id}`;
                              const childSelected = location.pathname.includes('/docs') && location.search.includes(`doc=${child.id}`);
                              return (
                                <li key={child.id}>
                                  <NavLink
                                    to={childTo}
                                    className={navRowClass(childSelected, 'pl-1 pr-4 text-[10.5px] flex items-center gap-1')}
                                  >
                                    <IconRenderer
                                      icon={child.icon}
                                      iconColor={child.iconColor}
                                      fallbackEmoji="📝"
                                      sizeClassName="size-2.5 shrink-0"
                                    />
                                    <span className="flex-1 truncate">{child.title}</span>
                                  </NavLink>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </li>
        );
      })}
    </Section>
  );
}

function LinkSection({
  title,
  links,
  workspaceSlug,
  defaultOpen = true,
}: {
  title: string;
  links: readonly NavEntry[];
  workspaceSlug: string;
  defaultOpen?: boolean;
}) {
  return (
    <Section title={title} defaultOpen={defaultOpen}>
      {links.map((entry) => (
        <li key={entry.label}>
          <NavRow entry={entry} workspaceSlug={workspaceSlug} />
        </li>
      ))}
    </Section>
  );
}

interface ChannelRowProps {
  channel: ChannelSummary;
  workspaceSlug: string;
  onToggleFavorite: (channel: ChannelSummary) => void;
}

function ChannelRow({
  channel,
  workspaceSlug,
  onToggleFavorite,
}: ChannelRowProps) {
  const isFavorite = channel.membership?.isFavorite ?? false;
  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/c/${channel.slug}`}
        className={({ isActive }) =>
          navRowClass(isActive, cn('pr-8', channel.isArchived && 'opacity-65'))
        }
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{channel.name}</span>
      </NavLink>

      {channel.membership ? (
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFavorite(channel)}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'absolute top-1/2 right-1.5 size-5 -translate-y-1/2 p-0',
              isFavorite
                ? 'text-warning opacity-100'
                : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
          </Button>
        </Hint>
      ) : null}
    </li>
  );
}

interface DMItem {
  id: string;
  name: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  unreadCount?: number;
  isAi?: boolean;
}

const SLACK_DMS: DMItem[] = [
  {
    id: 'dm_ai',
    name: 'AI Workspace Copilot',
    status: 'online',
    isAi: true,
  },
  {
    id: 'dm_alex',
    name: 'Alex Morgan',
    status: 'online',
    unreadCount: 2,
  },
  {
    id: 'dm_sarah',
    name: 'Sarah Chen',
    status: 'away',
  },
  {
    id: 'dm_david',
    name: 'David Miller',
    status: 'offline',
    unreadCount: 1,
  },
];

function DirectMessagesSection({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <Section
      title="Direct Messages"
      count={SLACK_DMS.length}
      defaultOpen={true}
      action={
        <Hint label="New Direct Message">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New Direct Message"
            className="size-5 hover:bg-accent p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/dms`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {SLACK_DMS.map((dm) => (
        <li key={dm.id}>
          <NavLink
            to={`/w/${workspaceSlug}/dms`}
            className={({ isActive }) =>
              navRowClass(
                isActive,
                'gap-2.5 py-1 px-2.5 text-xs hover:bg-accent/60',
              )
            }
          >
            {/* Slack Avatar & Presence Indicator */}
            <div className="relative flex size-5 shrink-0 items-center justify-center">
              {dm.isAi ? (
                <div className="flex size-5 items-center justify-center rounded-md bg-primary/20 text-primary">
                  <Sparkles className="size-3" />
                </div>
              ) : dm.avatarUrl ? (
                <img
                  src={dm.avatarUrl}
                  alt={dm.name}
                  className="size-5 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-md bg-secondary text-[10px] font-bold text-foreground">
                  {dm.name.charAt(0)}
                </div>
              )}

              {/* Slack Presence Indicator Dot */}
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-sidebar',
                  dm.status === 'online' && 'bg-success',
                  dm.status === 'away' && 'bg-warning',
                  dm.status === 'dnd' && 'bg-destructive',
                  dm.status === 'offline' && 'bg-muted-foreground/60',
                )}
              />
            </div>

            <span
              className={cn(
                'flex-1 truncate text-xs',
                dm.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {dm.name}
            </span>

            {dm.unreadCount ? (
              <Badge variant="count" className="ml-auto text-[10px] px-1.5 py-0">
                {dm.unreadCount}
              </Badge>
            ) : null}
          </NavLink>
        </li>
      ))}

      {/* Slack Add Teammates Action Link */}
      <li className="pt-1">
        <NavLink
          to={`/w/${workspaceSlug}/members`}
          className="flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          <div className="flex size-4 items-center justify-center rounded-md border border-dashed border-border text-subtle">
            <Plus className="size-3" />
          </div>
          <span className="text-xs">Add teammates</span>
        </NavLink>
      </li>
    </Section>
  );
}

export interface ChannelNavProps {
  workspaceId: string;
  workspaceSlug: string;
  channels: ChannelSummary[] | undefined;
  isLoading: boolean;
  onCreateChannel: () => void;
  onBrowseChannels: () => void;
}

export function ChannelNav({
  workspaceId,
  workspaceSlug,
  channels,
  isLoading,
  onCreateChannel,
  onBrowseChannels,
}: ChannelNavProps) {
  const navigate = useNavigate();
  const groups = useGroupedChannels(channels);
  const preferences = useChannelPreferences(workspaceId);

  const toggleFavorite = (channel: ChannelSummary) =>
    preferences.mutate({
      channelId: channel.id,
      input: { isFavorite: !channel.membership?.isFavorite },
    });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        onCreateChannel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateChannel]);

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <SkeletonList rows={6} className="gap-2" />
      </div>
    );
  }

  const rowProps = { workspaceSlug, onToggleFavorite: toggleFavorite };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="scrollbar-subtle flex-1 px-2 pt-2">
        <div className="pb-4">
          {/* Primary Nav Links (Most Used) */}
          <nav aria-label="Primary navigation" className="space-y-0.5">
            {MOST_USED_LINKS.map((entry) => (
              <NavRow
                key={entry.label}
                entry={entry}
                workspaceSlug={workspaceSlug}
              />
            ))}

            {/* More Dropdown Menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
                    'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
                    'hover:bg-accent hover:text-foreground',
                    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  aria-label="More menu"
                >
                  <MoreHorizontal className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-left">
                    More
                  </span>
                  <ChevronRight
                    className="size-3.5 text-subtle transition-transform duration-(--duration-fast) group-data-[state=open]:rotate-90"
                    aria-hidden
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="right"
                sideOffset={8}
                className="w-52 p-1 z-50 bg-popover border-border shadow-xl rounded-xl"
              >
                {SECONDARY_LINKS.map((entry) => {
                  const Icon = entry.icon;
                  const to = entry.path
                    ? `/w/${workspaceSlug}/${entry.path}`
                    : `/w/${workspaceSlug}`;
                  return (
                    <DropdownMenuItem
                      key={entry.label}
                      asChild
                      className="text-xs flex items-center gap-2.5 cursor-pointer py-2 px-2.5 rounded-md hover:bg-accent focus:bg-accent text-popover-foreground font-medium"
                    >
                      <NavLink to={to} end={entry.end}>
                        <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden />
                        <span className="flex-1 truncate">{entry.label}</span>
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="mt-3 border-t border-border pt-2">
            <Section
              title="Favorites"
              count={groups.favorites.length}
              defaultOpen={true}
            >
              {groups.favorites.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
              ))}
            </Section>

            <Section
              title="Channels"
              count={groups.joined.length}
              defaultOpen={true}
              action={
                <Hint label="Create a channel">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onCreateChannel}
                    aria-label="Create a channel"
                    className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </Hint>
              }
            >
              {groups.joined.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
              ))}
              <button
                onClick={onBrowseChannels}
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-btn py-1.5 pr-2 pl-3 text-[13px]',
                  'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
                  'hover:bg-accent hover:text-foreground',
                  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 truncate text-left">Browse channels</span>
              </button>
            </Section>

            {/* Direct Messages Section right after Channels */}
            <DirectMessagesSection workspaceSlug={workspaceSlug} />

            <ProjectsTreeSection workspaceSlug={workspaceSlug} />

            <DocsTreeSection workspaceSlug={workspaceSlug} />

            <LinkSection
              title="AI Agents"
              links={AGENTS_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={true}
            />

            <LinkSection
              title="Apps"
              links={APPS_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={true}
            />

            <LinkSection
              title="Automations"
              links={AUTOMATION_LINKS}
              workspaceSlug={workspaceSlug}
              defaultOpen={false}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Sidebar Footer Section */}
      <div className="shrink-0 p-3 space-y-3 border-t border-border/60 bg-sidebar">
        {/* Upgrade Prompt Banner Card */}
        <div className="rounded-xl border border-border/80 bg-accent/40 p-3.5 space-y-2 text-left shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0 text-warning">
              <Package className="size-5" />
              <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-warning text-[9px] font-extrabold text-warning-foreground leading-none">
                !
              </span>
            </div>
            <span className="text-xs font-bold text-foreground tracking-tight">
              2 days left to upgrade
            </span>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground font-normal">
            This workspace is out of free blocks for you and your team
          </p>

          <div className="pt-0.5">
            <NavLink
              to={`/w/${workspaceSlug}/members`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span>Manage members</span>
              <ArrowRight className="size-3.5" />
            </NavLink>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateChannel}
            className={cn(
              'flex-1 flex items-center justify-between gap-2 bg-secondary/80 hover:bg-secondary text-secondary-foreground px-3.5 py-2.5 rounded-full text-xs font-medium transition-colors border border-border/30',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <span className="flex items-center gap-2">
              <svg
                className="size-4 shrink-0 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 10h.01" />
                <path d="M15 10h.01" />
                <path d="M9.5 14.5c.8 1 2.2 1.5 3.5 1.5s2.7-.5 3.5-1.5" />
              </svg>
              <span>New chat</span>
            </span>
            <kbd className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-background/70 text-muted-foreground border border-border/40 tabular-nums">
              Ctrl+O
            </kbd>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex size-9 items-center justify-center rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors border border-border/30 shrink-0 cursor-pointer',
                  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                aria-label="Create item"
                title="Create..."
              >
                <Plus className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={8}
              className="w-80 p-1.5 bg-popover text-popover-foreground border border-border/80 shadow-2xl rounded-xl space-y-0.5 z-50"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Create
              </DropdownMenuLabel>

              {/* AI Chat */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/home`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">AI Chat</span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                      Ctrl+O
                    </kbd>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Start a session with AI Copilot
                  </p>
                </div>
              </DropdownMenuItem>

              {/* Direct Message */}
              <DropdownMenuItem
                onClick={onCreateChannel}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <SquarePen className="size-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Direct Message</span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                      Ctrl+N
                    </kbd>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Send a private message to a teammate
                  </p>
                </div>
              </DropdownMenuItem>

              {/* Channel */}
              <DropdownMenuItem
                onClick={onCreateChannel}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-muted border border-border/60 flex items-center justify-center shrink-0">
                  <Hash className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Channel</span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Create a topic or team channel
                  </p>
                </div>
              </DropdownMenuItem>

              {/* Project Board */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/tasks`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <FolderKanban className="size-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Project Board</span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Track tasks & project boards
                  </p>
                </div>
              </DropdownMenuItem>

              {/* AI Agent */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/agents/builder`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Bot className="size-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">AI Agent</span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Build a custom autonomous agent
                  </p>
                </div>
              </DropdownMenuItem>

              {/* Workflow */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/automations/builder`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <Workflow className="size-4 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Workflow</span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Automate tasks with visual builder
                  </p>
                </div>
              </DropdownMenuItem>

              {/* Doc & Note */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/docs`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <FileText className="size-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Doc & Note</span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                      Ctrl+Shift+N
                    </kbd>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Write collaborative documents & notes
                  </p>
                </div>
              </DropdownMenuItem>

              {/* Meeting */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/meetings`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Headphones className="size-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Meeting</span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Start or schedule a video/audio chat
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 border-t border-border/60" />

              {/* Invite Teammates */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/directory`)}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors"
              >
                <div className="size-8 flex items-center justify-center shrink-0 text-muted-foreground">
                  <UserPlus className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Invite Teammates</span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Add members to this workspace
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
