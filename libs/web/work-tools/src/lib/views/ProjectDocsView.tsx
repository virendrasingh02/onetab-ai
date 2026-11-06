import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ScrollArea,
  SearchInput,
  SkeletonList,
  Toolbar,
  toast,
  IconRenderer,
} from '@org/ui';
import { cn } from '@org/utils';
import type { ProjectDetail } from '@org/types';
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Link2,
  Plus,
  Settings2,
  Sparkles,
  TriangleAlert,
  Unlink,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { readingMinutes } from '../docs/doc-content.js';
import {
  DEFAULT_COVER,
  type DocCategory,
  type DocItem,
} from '../docs/doc-types.js';
import { CARD_ACTIONS_REVEAL, DocStatusBadge } from '../docs/DocStatusBadge.js';
import { useDocsWorkspace } from '../docs/use-docs.js';

export type ProjectDocTemplate = 'prd' | 'meeting' | 'spec' | 'checklist';

const PROJECT_DOC_TEMPLATES: Record<
  ProjectDocTemplate,
  { titleSuffix: string; category: DocCategory }
> = {
  prd: { titleSuffix: 'PRD', category: 'Engineering' },
  meeting: { titleSuffix: 'Sprint Sync', category: 'General' },
  spec: { titleSuffix: 'Technical Spec', category: 'Architecture' },
  checklist: { titleSuffix: 'Launch Checklist', category: 'Engineering' },
};

export interface ProjectDocsViewProps {
  project: ProjectDetail;
  docs: DocItem[];
  isLoading?: boolean;
  isError?: boolean;
  onSelectDoc: (docId: string) => void;
  onCreateProjectDoc: (template?: ProjectDocTemplate) => void;
  onLinkDoc: (docId: string) => void;
  onUnlinkDoc: (docId: string) => void;
}

/**
 * The project's Docs tab. A wrapper so the workspace's documents are only
 * fetched and decoded while the tab is open, not on every project view.
 */
export function ProjectDocsTab({
  project,
  workspaceId,
  workspaceSlug,
}: {
  project: ProjectDetail;
  workspaceId: string | undefined;
  workspaceSlug: string | undefined;
}) {
  const navigate = useNavigate();
  const { docs, isLoading, isError, createDoc, updateDocProject } =
    useDocsWorkspace(workspaceId);

  const openDoc = (docId: string) =>
    navigate(`/w/${workspaceSlug}/docs/${docId}?tab=editor`);

  return (
    <ProjectDocsView
      project={project}
      docs={docs}
      isLoading={isLoading}
      isError={isError}
      onSelectDoc={openDoc}
      onCreateProjectDoc={(template) => {
        const preset = template ? PROJECT_DOC_TEMPLATES[template] : undefined;
        createDoc(
          undefined,
          preset ? `${project.name} ${preset.titleSuffix}` : undefined,
          preset?.category,
          template,
          undefined,
          project.id,
          project.name,
        ).then(
          (id) => {
            if (id) openDoc(id);
          },
          // The mutation cache already toasts the failure.
          () => undefined,
        );
      }}
      onLinkDoc={(docId) => {
        void updateDocProject(docId, project.id, project.name).then((saved) => {
          if (saved) toast.success('Document linked to project');
        });
      }}
      onUnlinkDoc={(docId) => {
        void updateDocProject(docId, undefined, undefined).then((saved) => {
          if (saved) toast.info('Document unlinked from project');
        });
      }}
    />
  );
}

/** Lists the workspace docs that can be linked, naming any current project. */
function LinkDocMenu({
  project,
  docs,
  onLinkDoc,
  children,
}: {
  project: ProjectDetail;
  docs: DocItem[];
  onLinkDoc: (docId: string) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-h-72 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-[11px]">
          Link document to {project.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {docs.length > 0 ? (
          docs.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onClick={() => onLinkDoc(d.id)}
              className="text-xs gap-2 flex items-center justify-between"
            >
              <div className="gap-2 min-w-0 flex items-center">
                <span className="shrink-0">
                  <IconRenderer
                    icon={d.icon}
                    iconColor={d.iconColor}
                    sizeClassName="size-3.5"
                  />
                </span>
                <span className="truncate">
                  {d.title || 'Untitled Document'}
                </span>
              </div>
              {/* A doc has one project, so linking moves it from this one. */}
              <Badge variant="neutral" className="shrink-0 text-[9px]">
                {d.projectName ? `In ${d.projectName}` : d.category}
              </Badge>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No other documents to link
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectDocsView({
  project,
  docs,
  isLoading = false,
  isError = false,
  onSelectDoc,
  onCreateProjectDoc,
  onLinkDoc,
  onUnlinkDoc,
}: ProjectDocsViewProps) {
  const [search, setSearch] = useState('');

  // Documents attached to this specific project
  const projectDocs = useMemo(() => {
    return docs.filter((d) => d.projectId === project.id);
  }, [docs, project.id]);

  // Documents available to link (not yet linked to this project)
  const unlinkedDocs = useMemo(() => {
    return docs.filter((d) => d.projectId !== project.id);
  }, [docs, project.id]);

  const visibleDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projectDocs;
    return projectDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.snippet ?? '').toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [projectDocs, search]);

  // Creating before the tree loads would make a second "General" folder.
  const actionsDisabled = isLoading || isError;

  return (
    <div className="px-4 sm:px-6 py-4 flex h-full flex-col overflow-hidden">
      {/* Top action toolbar */}
      <Toolbar className="mb-4 gap-2 shrink-0 flex-wrap justify-between">
        <div className="gap-2 flex items-center">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search project docs…"
            className="bg-muted/40"
            wrapperClassName="w-48 sm:w-64"
          />
          <Badge variant="neutral" className="text-xs">
            {projectDocs.length} {projectDocs.length === 1 ? 'doc' : 'docs'}
          </Badge>
        </div>

        <div className="gap-2 flex flex-wrap items-center">
          <LinkDocMenu
            project={project}
            docs={unlinkedDocs}
            onLinkDoc={onLinkDoc}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={actionsDisabled}
            >
              <Link2 className="size-3.5 text-muted-foreground" />
              <span>Link existing doc</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </LinkDocMenu>

          {/* New Document Button with dropdown options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                disabled={actionsDisabled}
              >
                <Plus className="size-4" />
                <span>New Project Doc</span>
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => onCreateProjectDoc('prd')}
                className="gap-2 text-xs"
              >
                <Zap className="size-3.5 text-accent-amber" />
                <span>Product Requirements (PRD)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCreateProjectDoc('meeting')}
                className="gap-2 text-xs"
              >
                <BookOpen className="size-3.5 text-accent-blue" />
                <span>Sprint Planning & Notes</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCreateProjectDoc('spec')}
                className="gap-2 text-xs"
              >
                <Settings2 className="size-3.5 text-muted-foreground" />
                <span>Technical Architecture Spec</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCreateProjectDoc('checklist')}
                className="gap-2 text-xs"
              >
                <ClipboardCheck className="size-3.5 text-muted-foreground" />
                <span>Launch Readiness Checklist</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onCreateProjectDoc()}
                className="gap-2 text-xs"
              >
                <FilePlus2 className="size-3.5 text-muted-foreground" />
                <span>Blank Document</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Toolbar>

      {/* Main Content Area */}
      <ScrollArea className="min-h-0 flex-1" contentClassName="pb-6">
        {isError ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="Could not load documents"
            description="The project's documents could not be read from the server. Check your connection and try again."
          />
        ) : isLoading ? (
          <SkeletonList rows={6} />
        ) : projectDocs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8 text-muted-foreground" />}
            title={`No documents linked to ${project.name}`}
            description="Keep your project specs, technical requirements, sprint goals, and decision logs centralized right here alongside your tasks."
            action={
              <div className="gap-2 flex flex-wrap justify-center">
                <Button
                  size="sm"
                  onClick={() => onCreateProjectDoc('prd')}
                  leadingIcon={<Zap className="size-3.5 text-accent-amber" />}
                >
                  Create PRD
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCreateProjectDoc('meeting')}
                  leadingIcon={
                    <BookOpen className="size-3.5 text-accent-blue" />
                  }
                >
                  Create Sprint Notes
                </Button>
                {unlinkedDocs.length > 0 && (
                  <LinkDocMenu
                    project={project}
                    docs={unlinkedDocs}
                    onLinkDoc={onLinkDoc}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      leadingIcon={<Link2 className="size-3.5" />}
                    >
                      Link Existing Document
                    </Button>
                  </LinkDocMenu>
                )}
              </div>
            }
          />
        ) : visibleDocs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8 text-muted-foreground" />}
            title="No matching documents"
            description="Try a different search term to find project documentation."
          />
        ) : (
          <div className="gap-3.5 sm:grid-cols-2 lg:grid-cols-3 grid">
            {visibleDocs.map((doc) => {
              return (
                <Card
                  key={doc.id}
                  onClick={() => onSelectDoc(doc.id)}
                  className="group cursor-pointer overflow-hidden border-border bg-surface text-foreground transition-all duration-200 hover:border-border-strong hover:bg-surface-raised hover:shadow-xs"
                >
                  {/* Gradient cover header */}
                  <div
                    className="h-14 relative w-full"
                    style={{ background: doc.cover || DEFAULT_COVER }}
                  >
                    <div
                      className={cn(
                        'top-2 right-2 gap-1 bg-black/40 backdrop-blur-md p-1 absolute flex items-center rounded-md',
                        CARD_ACTIONS_REVEAL,
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-white hover:bg-white/20 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnlinkDoc(doc.id);
                        }}
                        title="Unlink from this project"
                        aria-label="Unlink from this project"
                      >
                        <Unlink className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <CardHeader className="pt-3 pb-2">
                    <div className="gap-2 flex items-start justify-between">
                      <div className="gap-2.5 min-w-0 flex items-center">
                        <span className="text-xl shrink-0 select-none">
                          <IconRenderer
                            icon={doc.icon}
                            iconColor={doc.iconColor}
                          />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold truncate transition-colors group-hover:text-primary">
                            {/* The focusable control: its click bubbles to the card. */}
                            <button
                              type="button"
                              className="max-w-full cursor-pointer truncate text-left"
                            >
                              {doc.title || 'Untitled Document'}
                            </button>
                          </CardTitle>
                          <CardDescription className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {doc.category}
                          </CardDescription>
                        </div>
                      </div>

                      <DocStatusBadge status={doc.status} />
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 pb-3">
                    {doc.snippet ? (
                      <p className="text-xs leading-relaxed mb-3 line-clamp-2 text-muted-foreground">
                        {doc.snippet}
                      </p>
                    ) : (
                      <p className="text-xs mb-3 text-muted-foreground/60 italic">
                        Empty document
                      </p>
                    )}

                    <div className="pt-2.5 flex items-center justify-between border-t border-border/60 text-[11px] text-muted-foreground">
                      <span className="max-w-[120px] truncate">
                        {doc.updatedAt}
                      </span>

                      <div className="gap-1.5 flex shrink-0 items-center text-[10px] text-muted-foreground">
                        <Sparkles className="size-3 text-accent-blue" />
                        <span>{readingMinutes(doc.blocks)}m read</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
