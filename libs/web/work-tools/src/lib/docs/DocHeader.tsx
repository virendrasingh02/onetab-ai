import type { Project } from '@org/types';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProjectGlyph,
} from '@org/ui';
import { IconPicker, useIconEditor, type IconSource } from '@org/icons';
import { cn } from '@org/utils';
import {
  ChevronDown,
  Check,
  Clock,
  FileText,
  Folder,
  FolderKanban,
  Image as ImageIcon,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readingMinutes, wordCount } from './doc-content.js';
import {
  COVER_PRESETS,
  type DocCategory,
  type DocItem,
  type DocStatus,
} from './doc-types.js';

type ProjectMark = Pick<Project, 'icon' | 'iconColor' | 'color'>;

interface DocHeaderProps {
  doc: DocItem;
  onUpdateTitle: (title: string) => void;
  onUpdateIcon: (icon: string, iconColor?: string) => void;
  onUpdateCover: (cover: string) => void;
  onUpdateStatus: (status: DocStatus) => void;
  onUpdateCategory: (category: DocCategory) => void;
  onToggleFavorite: () => void;
  onUpdateProject?: (projectId?: string, projectName?: string) => void;
  projects?: Array<
    { id: string; name: string; slug: string } & Partial<ProjectMark>
  >;
  workspaceSlug?: string;
}

export function DocHeader({
  doc,
  onUpdateTitle,
  onUpdateIcon,
  onUpdateCover,
  onUpdateStatus,
  onUpdateCategory,
  onToggleFavorite,
  onUpdateProject,
  projects,
  workspaceSlug,
}: DocHeaderProps) {
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  /*
   * A doc keeps its icon inside its encoded content rather than in a column of
   * its own, so the saver is the doc mutation it already had. Everything around
   * it — the optimistic swap, the rollback, the pending trigger — comes from
   * the shared editor, the same one the workspace icon uses.
   */
  const iconEditor = useIconEditor(
    useMemo<IconSource>(
      () => ({
        icon: doc.icon,
        iconColor: doc.iconColor,
        // A doc always shows something in its header, so clearing lands on the
        // default page glyph instead of nothing.
        save: ({ icon, iconColor }) =>
          onUpdateIcon(icon ?? '📝', iconColor ?? undefined),
      }),
      [doc.icon, doc.iconColor, onUpdateIcon],
    ),
  );
  const [titleInput, setTitleInput] = useState(doc.title);

  const readingTimeMinutes = readingMinutes(doc.blocks);

  // The name stored on the doc goes stale when a project is renamed, so the
  // live project wins; the stored name covers the moment before it loads.
  const linkedProject = projects?.find((p) => p.id === doc.projectId);
  const projectLabel = linkedProject?.name ?? doc.projectName;

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    } else {
      setTitleInput(doc.title);
    }
  };

  const getStatusBadge = (status?: DocStatus) => {
    switch (status) {
      case 'Finalized':
        return <Badge variant="primary">Finalized</Badge>;
      case 'In Review':
        return <Badge variant="warning">In Review</Badge>;
      case 'Archived':
        return <Badge variant="neutral">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="mb-6 relative w-full overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all">
      {/* Notion Cover Banner Header */}
      <div
        className="h-36 md:h-44 group relative w-full transition-all duration-300"
        style={{
          background:
            doc.cover || 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
        }}
      >
        {/* Cover Actions Overlay */}
        <div className="top-3 right-3 gap-2 bg-black/40 backdrop-blur-md p-1.5 border-white/10 absolute flex items-center rounded-lg border opacity-90 transition-opacity group-hover:opacity-100">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 text-xs h-7 px-2.5 gap-1.5"
              >
                <ImageIcon className="size-3.5" />
                <span>Change Cover</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">
                Header Banner Preset
              </p>
              <div className="gap-2 grid grid-cols-2">
                {COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onUpdateCover(preset.style)}
                    className="h-10 p-1 text-white font-medium flex items-end overflow-hidden rounded-md border border-border text-[10px] shadow-sm transition-transform hover:scale-105"
                    style={{ background: preset.style }}
                  >
                    <span className="bg-black/50 px-1 rounded backdrop-blur-xs max-w-full truncate">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFavorite}
            className={cn(
              'text-white hover:bg-white/20 text-xs h-7 px-2 gap-1',
              doc.favorite && 'font-semibold text-accent-amber',
            )}
          >
            <Star
              className={cn(
                'size-3.5',
                doc.favorite
                  ? 'fill-accent-amber text-accent-amber'
                  : 'text-white',
              )}
            />
            <span>{doc.favorite ? 'Favorited' : 'Favorite'}</span>
          </Button>
        </div>
      </div>

      {/* Main Document Info Section */}
      <div className="px-6 pb-6 pt-0 relative bg-surface">
        {/* Floating Notion Page Icon */}
        <div className="-mt-9 mb-3 flex items-center justify-between">
          <IconPicker editor={iconEditor} required align="start" />

          {/* Status & Category Selector */}
          <div className="gap-2 pt-8 flex items-center">
            {/* Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="cursor-pointer">
                  {getStatusBadge(doc.status)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuLabel className="text-[11px]">
                  Set Status
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(
                  ['Draft', 'In Review', 'Finalized', 'Archived'] as DocStatus[]
                ).map((st) => (
                  <DropdownMenuItem
                    key={st}
                    onClick={() => onUpdateStatus(st)}
                    className="text-xs justify-between"
                  >
                    {st}
                    {doc.status === st ? '✓' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Category Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                >
                  <Tag className="size-3 text-muted-foreground" />
                  <span>{doc.category}</span>
                  <ChevronDown className="size-3 text-subtle" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[11px]">
                  Category
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(
                  [
                    'Architecture',
                    'Design System',
                    'Engineering',
                    'General',
                    'Security',
                  ] as DocCategory[]
                ).map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => onUpdateCategory(cat)}
                    className="text-xs justify-between"
                  >
                    {cat}
                    {doc.category === cat ? '✓' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Associated Project Dropdown */}
            {onUpdateProject && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-7 text-xs gap-1.5',
                      doc.projectId
                        ? 'font-medium border-brand/40 bg-brand/5 text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {linkedProject ? (
                      <ProjectGlyph
                        icon={linkedProject.icon}
                        iconColor={linkedProject.iconColor}
                        color={linkedProject.color}
                        size="xs"
                      />
                    ) : (
                      <FolderKanban className="size-3.5 text-primary" />
                    )}
                    <span className="max-w-[120px] truncate">
                      {projectLabel ||
                        (doc.projectId ? 'Project' : 'Link Project')}
                    </span>
                    <ChevronDown className="size-3 text-subtle" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[11px]">
                    Associated Project
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projects && projects.length > 0 ? (
                    projects.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => onUpdateProject(p.id, p.name)}
                        className="text-xs justify-between"
                      >
                        <span className="gap-2 min-w-0 flex items-center">
                          <ProjectGlyph
                            icon={p.icon}
                            iconColor={p.iconColor}
                            color={p.color}
                            size="xs"
                          />
                          <span className="truncate">{p.name}</span>
                        </span>
                        {doc.projectId === p.id && (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem
                      disabled
                      className="text-xs text-muted-foreground"
                    >
                      No projects available
                    </DropdownMenuItem>
                  )}
                  {doc.projectId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onUpdateProject(undefined, undefined)}
                        className="text-xs text-destructive focus:text-destructive"
                      >
                        Unlink project
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Breadcrumb Path */}
        <div className="mb-2">
          <Breadcrumb>
            <BreadcrumbList className="text-[11px]">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    className="gap-1 flex cursor-pointer items-center"
                    onClick={() => {
                      if (workspaceSlug) {
                        navigate(`/w/${workspaceSlug}/docs?tab=gallery`);
                      }
                    }}
                  >
                    <Folder className="size-3 text-accent-blue" />
                    Workspace Docs
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {doc.projectId && projectLabel && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        className="gap-1 flex cursor-pointer items-center text-primary hover:underline"
                        onClick={() => {
                          if (workspaceSlug) {
                            navigate(
                              `/w/${workspaceSlug}/projects/${
                                linkedProject?.slug ?? doc.projectId
                              }`,
                            );
                          }
                        }}
                      >
                        {linkedProject ? (
                          <ProjectGlyph
                            icon={linkedProject.icon}
                            iconColor={linkedProject.iconColor}
                            color={linkedProject.color}
                            size="xs"
                          />
                        ) : (
                          <FolderKanban className="size-3" />
                        )}
                        {projectLabel}
                      </button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink>{doc.category}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold max-w-[200px] truncate text-foreground">
                  {doc.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Title Heading */}
        <div className="mt-1">
          {isEditingTitle ? (
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
              }}
              autoFocus
              className="text-2xl md:text-3xl font-extrabold tracking-tight py-1 px-2 h-auto border-primary bg-surface-raised text-foreground"
            />
          ) : (
            <h1
              onClick={() => {
                setTitleInput(doc.title);
                setIsEditingTitle(true);
              }}
              className="text-2xl md:text-3xl font-extrabold tracking-tight rounded px-1 -ml-1 py-0.5 group/title flex cursor-pointer items-center justify-between text-foreground transition-colors hover:bg-accent/40"
              title="Click to edit document title"
            >
              <span>{doc.title}</span>
            </h1>
          )}
        </div>

        {/* Header Metrics */}
        <div className="gap-4 mt-3 pt-3 flex flex-wrap items-center border-t border-border/60 text-[11px] text-muted-foreground">
          <div className="gap-1.5 flex items-center">
            <Clock className="size-3.5 text-subtle" />
            <span>Updated {doc.updatedAt}</span>
          </div>
          <div className="gap-1.5 flex items-center">
            <FileText className="size-3.5 text-subtle" />
            <span>{wordCount(doc.blocks)} words</span>
          </div>
          <div className="gap-1.5 flex items-center">
            <Sparkles className="size-3.5 text-accent-blue" />
            <span>~{readingTimeMinutes} min read</span>
          </div>
        </div>
      </div>
    </div>
  );
}
