import { useCurrentUser } from '@org/auth';
import { useMediaPreview } from '@org/media-preview';
import type { Upload } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Hint,
  SearchInput,
  SegmentedControl,
  SkeletonList,
  UserAvatar,
  usePromptDialog,
  type SegmentedOption,
} from '@org/ui';
import { cn, formatBytes, formatRelative } from '@org/utils';
import {
  FileDropzone,
  useUploadMediaAdapter,
  useUploadMutations,
  useUploads,
} from '@org/web-upload';
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  FileArchive,
  FileJson,
  FileText,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  SlidersHorizontal,
  Table2,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCurrentWorkspace } from './use-work-tools.js';

/**
 * Broad buckets over the allowed MIME types.
 *
 * The filter reads in the user's terms ("Images", "Spreadsheets") rather than
 * `image/svg+xml`, and grouping keeps the menu from growing a row every time
 * the allow-list gains a type.
 */
type FileKind = 'image' | 'document' | 'spreadsheet' | 'archive' | 'data';

const KIND_LABEL: Record<FileKind, string> = {
  image: 'Images',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  archive: 'Archives',
  data: 'Data',
};

function kindOf(mimeType: string): FileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'text/csv') return 'spreadsheet';
  if (mimeType === 'application/zip') return 'archive';
  if (mimeType === 'application/json') return 'data';
  return 'document';
}

const KIND_STYLE: Record<FileKind, string> = {
  image: 'bg-accent-cyan-soft border-accent-cyan/30 text-accent-cyan',
  document: 'bg-accent-rose-soft border-accent-rose/30 text-accent-rose',
  spreadsheet: 'bg-accent-green-soft border-accent-green/30 text-accent-green',
  archive: 'bg-accent-amber-soft border-accent-amber/30 text-accent-amber',
  data: 'bg-accent-blue-soft border-accent-blue/30 text-accent-blue',
};

function FileTypeBadge({ mimeType }: { mimeType: string }) {
  const kind = kindOf(mimeType);
  const Icon =
    kind === 'image'
      ? ImageIcon
      : kind === 'spreadsheet'
        ? Table2
        : kind === 'archive'
          ? FileArchive
          : kind === 'data'
            ? FileJson
            : FileText;

  return (
    <div
      className={cn(
        'size-9 relative flex shrink-0 items-center justify-center rounded-lg border select-none',
        KIND_STYLE[kind],
      )}
    >
      <Icon className="size-4" aria-hidden />
    </div>
  );
}

type OwnerTab = 'all' | 'created' | 'shared';

const OWNER_TABS: readonly SegmentedOption<OwnerTab>[] = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Uploaded by you' },
  { value: 'shared', label: 'From teammates' },
];
type SortKey = 'recent' | 'name' | 'size';

export function FileManagerView() {
  const user = useCurrentUser();
  const { workspaceId } = useCurrentWorkspace();
  const uploads = useUploads(workspaceId);
  const { remove, download } = useUploadMutations(workspaceId);
  const { toMediaItem } = useUploadMediaAdapter(workspaceId);
  const { openPreview } = useMediaPreview();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<OwnerTab>('all');
  const [selectedKind, setSelectedKind] = useState<FileKind | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const prompts = usePromptDialog();

  /*
   * Deleting a file is immediate and irreversible for everyone in the
   * workspace — the row's menu used to fire the mutation straight from the
   * click, so a mis-click destroyed a teammate's upload with no way back.
   */
  const confirmDelete = async (filename: string, id: string) => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${filename}”?`,
      description:
        'The file is removed for everyone in this workspace. This cannot be undone.',
      confirmLabel: 'Delete file',
      destructive: true,
    });
    if (confirmed) remove.mutate(id);
  };

  const visibleFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = (uploads.data ?? []).filter((file) => {
      if (query && !file.filename.toLowerCase().includes(query)) return false;

      const isOwner = file.uploader.id === user?.id;
      if (activeTab === 'created' && !isOwner) return false;
      if (activeTab === 'shared' && isOwner) return false;

      if (selectedKind !== 'all' && kindOf(file.mimeType) !== selectedKind) {
        return false;
      }
      return true;
    });

    // `toSorted` is not available in every target browser this ships to.
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      if (sortBy === 'size') return b.size - a.size;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [uploads.data, searchQuery, activeTab, selectedKind, sortBy, user?.id]);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveTab('all');
    setSelectedKind('all');
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <FolderOpen
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                All Files
              </h2>
              <Badge
                variant="neutral"
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {uploads.data?.length ?? 0} files
              </Badge>
            </div>

            {/* <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Everything uploaded to this workspace by you and teammates
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search files…"
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-48"
            />
            <Button
              onClick={() => setIsUploadOpen(true)}
              size="sm"
              className="h-7 text-xs gap-1"
              leadingIcon={<Plus className="size-3.5" />}
            >
              Upload
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl space-y-4 mx-auto">
          <div className="sm:flex-row sm:items-center gap-3 pt-1 flex flex-col justify-between">
            <SegmentedControl
              aria-label="Filter files by who uploaded them"
              value={activeTab}
              onChange={setActiveTab}
              options={OWNER_TABS}
              className="no-scrollbar max-w-full self-start overflow-x-auto"
            />

            <div className="gap-2 sm:self-auto flex items-center self-end">
              {/* File Types Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="gap-1.5 px-3 py-1.5 text-xs font-medium flex items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-accent"
                    aria-label="Filter file types"
                  >
                    <SlidersHorizontal className="size-3.5 text-accent-cyan" />
                    <span>
                      {selectedKind === 'all'
                        ? 'All types'
                        : KIND_LABEL[selectedKind]}
                    </span>
                    <ChevronDown className="size-3 text-subtle" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 text-xs">
                  <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedKind('all')}>
                    <span>All types</span>
                    {selectedKind === 'all' ? (
                      <Check className="size-3.5 ml-auto text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                  {(Object.keys(KIND_LABEL) as FileKind[]).map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      onSelect={() => setSelectedKind(kind)}
                    >
                      <span>{KIND_LABEL[kind]}</span>
                      {selectedKind === kind ? (
                        <Check className="size-3.5 ml-auto text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="gap-1.5 px-3 py-1.5 text-xs font-medium flex items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-accent"
                    aria-label="Sort options"
                  >
                    <span>
                      {sortBy === 'recent'
                        ? 'Newest first'
                        : sortBy === 'name'
                          ? 'Name (A-Z)'
                          : 'Largest first'}
                    </span>
                    <ChevronDown className="size-3 text-subtle" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 text-xs">
                  <DropdownMenuItem onSelect={() => setSortBy('recent')}>
                    <span>Newest first</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSortBy('name')}>
                    <span>Name (A-Z)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSortBy('size')}>
                    <span>Largest first</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 4. Main Files List Container */}
          <div className="shadow-2xs divide-y divide-border/60 overflow-hidden rounded-card border border-border bg-surface/60">
            {uploads.isLoading ? (
              <div className="p-4">
                <SkeletonList rows={6} withAvatar />
              </div>
            ) : uploads.isError ? (
              <div className="p-8 text-center">
                <EmptyState
                  size="sm"
                  icon={<TriangleAlert />}
                  title="Could not load files"
                  description="Something went wrong fetching this workspace's files."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void uploads.refetch()}
                    >
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : visibleFiles.length === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  size="sm"
                  icon={<HardDrive />}
                  title={
                    uploads.data?.length
                      ? 'No files match your search'
                      : 'No files yet'
                  }
                  description={
                    uploads.data?.length
                      ? 'Try adjusting your filter pills or search query.'
                      : 'Upload a file to share it with the workspace.'
                  }
                  action={
                    uploads.data?.length ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetFilters}
                      >
                        Reset filters
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setIsUploadOpen(true)}>
                        Upload a file
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              visibleFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  isOwner={file.uploader.id === user?.id}
                  isDownloading={
                    download.isPending && download.variables?.id === file.id
                  }
                  isDeleting={remove.isPending && remove.variables === file.id}
                  onDownload={() => download.mutate(file)}
                  onDelete={() => confirmDelete(file.filename, file.id)}
                  onPreview={() =>
                    openPreview(
                      visibleFiles.map(toMediaItem),
                      visibleFiles.indexOf(file),
                    )
                  }
                />
              ))
            )}
          </div>

          {/* Upload Dialog */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogContent className="sm:max-w-md text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold">
                  Upload files
                </DialogTitle>
              </DialogHeader>
              <FileDropzone
                workspaceId={workspaceId}
                label="Add files to this workspace"
              />
            </DialogContent>
          </Dialog>

          {prompts.dialog}
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file,
  isOwner,
  isDownloading,
  isDeleting,
  onDownload,
  onDelete,
  onPreview,
}: {
  file: Upload;
  isOwner: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const uploaderName = file.uploader.displayName ?? file.uploader.name;

  return (
    <div
      className={cn(
        'group gap-3 p-3 sm:px-4 flex items-center justify-between transition-colors hover:bg-accent/40',
        isDeleting && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${file.filename}`}
        className="gap-3 min-w-0 flex flex-1 items-center text-left focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none rounded-md"
      >
        <FileTypeBadge mimeType={file.mimeType} />

        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-medium truncate text-foreground">
            {file.filename}
          </h3>
          <div className="gap-1.5 mt-0.5 flex items-center truncate text-[11px] text-muted-foreground">
            <span className="truncate">
              {isOwner ? `${uploaderName} (you)` : uploaderName}
            </span>
            <span>·</span>
            <span className="truncate">{formatRelative(file.createdAt)}</span>
            <span>·</span>
            <span>{formatBytes(file.size)}</span>
          </div>
        </div>
      </button>

      <div className="gap-2 sm:gap-3 flex shrink-0 items-center">
        <UserAvatar
          name={uploaderName}
          src={file.uploader.avatarUrl}
          seed={file.uploader.id}
          size="xs"
          className="sm:block hidden ring-2 ring-background"
        />

        <Hint label="Preview">
          <button
            onClick={onPreview}
            aria-label={`Preview ${file.filename}`}
            className="size-7 hidden sm:flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground"
          >
            <Eye className="size-3.5" />
          </button>
        </Hint>

        <Hint label="Download file">
          <button
            onClick={onDownload}
            disabled={isDownloading}
            aria-label={`Download ${file.filename}`}
            className="size-7 flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" />
          </button>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="size-7 flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`More options for ${file.filename}`}
            >
              <MoreVertical className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            <DropdownMenuItem onSelect={onPreview}>
              <Eye className="size-3.5 mr-2" />
              <span>Preview</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDownload}>
              <Download className="size-3.5 mr-2" />
              <span>Download</span>
            </DropdownMenuItem>
            {/*
              `DELETE /uploads/:id` is guarded by workspace membership only, so
              every member can remove any file. Offered to everyone here to
              match what the API actually permits.
            */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5 mr-2" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
