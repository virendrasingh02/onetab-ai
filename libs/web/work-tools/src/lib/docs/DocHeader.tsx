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
  IconPickerPopover,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ChevronDown,
  Clock,
  FileText,
  Folder,
  Image as ImageIcon,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import type {
  DocCategory,
  DocItem,
  DocStatus,
} from './docs-hook.js';
import {
  COVER_PRESETS,
} from './docs-hook.js';

interface DocHeaderProps {
  doc: DocItem;
  onUpdateTitle: (title: string) => void;
  onUpdateIcon: (icon: string, iconColor?: string) => void;
  onUpdateCover: (cover: string) => void;
  onUpdateStatus: (status: DocStatus) => void;
  onUpdateCategory: (category: DocCategory) => void;
  onToggleFavorite: () => void;
}

export function DocHeader({
  doc,
  onUpdateTitle,
  onUpdateIcon,
  onUpdateCover,
  onUpdateStatus,
  onUpdateCategory,
  onToggleFavorite,
}: DocHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(doc.title);

  // Compute metrics
  const totalWords = doc.blocks
    ? doc.blocks.reduce((acc, b) => {
        const text = b.content + (b.rows ? b.rows.flat().join(' ') : '');
        return acc + text.trim().split(/\s+/).filter(Boolean).length;
      }, 0)
    : 0;

  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 200));

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
    <div className="relative w-full rounded-xl overflow-hidden border border-border bg-surface shadow-sm mb-6 transition-all">
      {/* Notion Cover Banner Header */}
      <div
        className="h-36 md:h-44 w-full relative transition-all duration-300 group"
        style={{
          background: doc.cover || 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
        }}
      >
        {/* Cover Actions Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10">
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
              <p className="text-xs font-semibold text-foreground">Header Banner Preset</p>
              <div className="grid grid-cols-2 gap-2">
                {COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onUpdateCover(preset.style)}
                    className="h-10 rounded-md border border-border overflow-hidden hover:scale-105 transition-transform flex items-end p-1 text-[10px] text-white font-medium shadow-sm"
                    style={{ background: preset.style }}
                  >
                    <span className="bg-black/50 px-1 rounded backdrop-blur-xs truncate max-w-full">
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
              doc.favorite && 'text-amber-300 font-semibold',
            )}
          >
            <Star
              className={cn(
                'size-3.5',
                doc.favorite ? 'fill-amber-400 text-amber-400' : 'text-white',
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
          <IconPickerPopover
            icon={doc.icon}
            iconColor={doc.iconColor}
            onSelectIcon={(newIcon: string, newColor?: string) => onUpdateIcon(newIcon, newColor)}
            onRemoveIcon={() => onUpdateIcon('📝', undefined)}
            align="start"
          />

          {/* Status & Category Selector */}
          <div className="flex items-center gap-2 pt-8">
            {/* Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="cursor-pointer">
                  {getStatusBadge(doc.status)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuLabel className="text-[11px]">Set Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['Draft', 'In Review', 'Finalized', 'Archived'] as DocStatus[]).map(
                  (st) => (
                    <DropdownMenuItem
                      key={st}
                      onClick={() => onUpdateStatus(st)}
                      className="text-xs justify-between"
                    >
                      {st}
                      {doc.status === st ? '✓' : ''}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Category Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Tag className="size-3 text-muted-foreground" />
                  <span>{doc.category}</span>
                  <ChevronDown className="size-3 text-subtle" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[11px]">Category</DropdownMenuLabel>
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
          </div>
        </div>

        {/* Breadcrumb Path */}
        <div className="mb-2">
          <Breadcrumb>
            <BreadcrumbList className="text-[11px]">
              <BreadcrumbItem>
                <BreadcrumbLink className="flex items-center gap-1">
                  <Folder className="size-3 text-accent-blue" />
                  Workspace Docs
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink>{doc.category}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-foreground">
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
              className="text-2xl md:text-3xl font-extrabold tracking-tight bg-surface-raised border-primary h-auto py-1 px-2 text-foreground"
            />
          ) : (
            <h1
              onClick={() => {
                setTitleInput(doc.title);
                setIsEditingTitle(true);
              }}
              className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground hover:bg-accent/40 rounded px-1 -ml-1 py-0.5 cursor-pointer transition-colors flex items-center justify-between group/title"
              title="Click to edit document title"
            >
              <span>{doc.title}</span>
            </h1>
          )}
        </div>

        {/* Header Metrics */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-subtle" />
            <span>Updated {doc.updatedAt}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-subtle" />
            <span>{totalWords} words</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-accent-blue" />
            <span>~{readingTimeMinutes} min read</span>
          </div>
        </div>
      </div>
    </div>
  );
}
