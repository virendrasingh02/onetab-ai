import { resolveMediaUrl } from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { getMediaType, useMediaPreview, type MediaItem } from '@org/media-preview';
import type { Upload, UploadContextType } from '@org/types';
import { getUsagePercentage } from '@org/types';
import {
  AppSelect,
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
  Field,
  Progress,
  SearchInput,
  SegmentedControl,
  SkeletonList,
  usePromptDialog,
  type SegmentedOption,
} from '@org/ui';
import { formatBytes } from '@org/utils';
import {
  AssetDetailsDialog,
  FileDropzone,
  KIND_LABEL,
  UploadList,
  kindOf,
  parseDestinationValue,
  uploadSourceHref,
  useDestinationOptions,
  useInfiniteUploads,
  useUploadMediaAdapter,
  useUploadMutations,
  useUploadStorageUsage,
  type FileKind,
  type UploadListItem,
  type UploadTarget,
} from '@org/web-upload';
import { useWorkspaceRoomFiles } from '@org/web-chat';
import {
  Check,
  ChevronDown,
  FolderOpen,
  HardDrive,
  Plus,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentWorkspace } from './use-work-tools.js';

type OwnerTab = 'all' | 'created' | 'shared';

const OWNER_TABS: readonly SegmentedOption<OwnerTab>[] = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Uploaded by you' },
  { value: 'shared', label: 'From teammates' },
];

type SortKey = 'recent' | 'name' | 'size';

type SourceFilter = UploadContextType | 'all';

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'CHANNEL', label: 'Channels' },
  { value: 'DIRECT', label: 'Direct messages' },
  { value: 'PROJECT', label: 'Projects' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'APP', label: 'Apps' },
  { value: 'DOCUMENT', label: 'Documents' },
  { value: 'ISSUE', label: 'Issues' },
  { value: 'WORKSPACE', label: 'Workspace' },
];

const DEST_WORKSPACE = 'WORKSPACE';

/** One merged row: a workspace `Upload` or a Matrix chat attachment. */
interface HubRow {
  item: UploadListItem;
  createdAtMs: number;
  kind: FileKind;
  sourceType: UploadContextType;
  isMine: boolean;
  media: MediaItem;
  /** The full row for the details panel; null for Matrix chat items. */
  upload: Upload | null;
  /** Direct URL for chat items; `null` for `Upload` rows (auth'd download only). */
  directUrl: string | null;
}

export function FileManagerView() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();

  const uploads = useInfiniteUploads(workspaceId);
  const roomFiles = useWorkspaceRoomFiles();
  const usage = useUploadStorageUsage(workspaceId);
  const { groups: destinationGroups, isLoading: destsLoading } =
    useDestinationOptions(workspaceId);
  const { remove, download } = useUploadMutations(workspaceId);
  const { toMediaItem } = useUploadMediaAdapter(workspaceId);
  const { openPreview } = useMediaPreview();
  const prompts = usePromptDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<OwnerTab>('all');
  const [selectedKind, setSelectedKind] = useState<FileKind | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<SourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [destination, setDestination] = useState<string>(DEST_WORKSPACE);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = uploads;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const confirmDelete = async (id: string, filename: string) => {
    const ok = await prompts.confirmAction({
      title: `Delete “${filename}”?`,
      description:
        'The file is removed for everyone in this workspace. This cannot be undone.',
      confirmLabel: 'Delete file',
      destructive: true,
    });
    if (ok) remove.mutate(id);
  };

  const allRows = useMemo<HubRow[]>(() => {
    const fromUploads: HubRow[] = uploads.items.map((u) => ({
      item: {
        id: u.id,
        filename: u.filename,
        mimeType: u.mimeType,
        size: u.size,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        version: u.version,
        thumbnailUrl: u.thumbnailUrl ? resolveMediaUrl(u.thumbnailUrl) : null,
        uploader: u.uploader,
        source: {
          type: u.contextType,
          label: u.context?.label ?? null,
          href: uploadSourceHref(slug, u.context),
        },
        manageable: true,
      },
      createdAtMs: Date.parse(u.createdAt),
      kind: kindOf(u.mimeType),
      sourceType: u.contextType,
      isMine: u.uploader.id === user?.id,
      media: toMediaItem(u),
      upload: u,
      directUrl: null,
    }));

    const fromRooms: HubRow[] = roomFiles.files.map((f) => {
      const sourceType: UploadContextType =
        f.roomKind === 'channel' ? 'CHANNEL' : 'DIRECT';
      return {
        item: {
          id: f.id,
          filename: f.name,
          mimeType: f.mimeType,
          size: f.size,
          createdAt: new Date(f.timestamp).toISOString(),
          thumbnailUrl: f.thumbnailUrl ?? null,
          uploader: {
            id: f.senderId,
            name: f.senderName,
            avatarUrl: f.senderAvatarUrl ?? null,
          },
          source: {
            type: sourceType,
            label: f.roomName,
            href:
              sourceType === 'DIRECT' && slug
                ? `/w/${slug}/dms?room=${encodeURIComponent(f.roomId)}`
                : null,
          },
          manageable: false,
        },
        createdAtMs: f.timestamp,
        kind: kindOf(f.mimeType),
        sourceType,
        isMine: f.isMine,
        media: {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          category: getMediaType(f.mimeType, f.name),
          url: f.url,
          thumbnailUrl: f.thumbnailUrl,
        },
        upload: null,
        directUrl: f.url,
      };
    });

    return [...fromUploads, ...fromRooms];
  }, [uploads.items, roomFiles.files, user?.id, toMediaItem, slug]);

  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = allRows.filter((row) => {
      if (query && !row.item.filename.toLowerCase().includes(query)) {
        return false;
      }
      if (activeTab === 'created' && !row.isMine) return false;
      if (activeTab === 'shared' && row.isMine) return false;
      if (selectedKind !== 'all' && row.kind !== selectedKind) return false;
      if (selectedSource !== 'all' && row.sourceType !== selectedSource) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.item.filename.localeCompare(b.item.filename);
      }
      if (sortBy === 'size') return b.item.size - a.item.size;
      return b.createdAtMs - a.createdAtMs;
    });
  }, [allRows, searchQuery, activeTab, selectedKind, selectedSource, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveTab('all');
    setSelectedKind('all');
    setSelectedSource('all');
  };

  const isLoading =
    uploads.isLoading || (roomFiles.enabled && roomFiles.isLoading);

  const detailsUpload =
    (detailsId && uploads.items.find((u) => u.id === detailsId)) || null;

  const usagePct = usage.data
    ? getUsagePercentage(usage.data.usedBytes, usage.data.limitBytes)
    : 0;

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <FolderOpen
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                All Files
              </h2>
              <Badge variant="neutral" className="px-1.5 py-0 h-4.5 text-[11px]">
                {allRows.length} files
              </Badge>
            </div>

            {usage.data && usage.data.limitBytes > 0 ? (
              <div
                className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground"
                title={`${formatBytes(usage.data.usedBytes)} of ${formatBytes(
                  usage.data.limitBytes,
                )} used`}
              >
                <span className="h-4 w-px bg-border" />
                <Progress value={usagePct} className="h-1.5 w-24" />
                <span className={usage.data.nearLimit ? 'text-warning' : undefined}>
                  {formatBytes(usage.data.usedBytes)} /{' '}
                  {formatBytes(usage.data.limitBytes)}
                </span>
              </div>
            ) : null}
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

      <div
        ref={scrollRef}
        className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto"
      >
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
              {/* Source Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="gap-1.5 px-3 py-1.5 text-xs font-medium flex items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-accent"
                    aria-label="Filter by source"
                  >
                    <FolderOpen className="size-3.5 text-accent-violet" />
                    <span>
                      {SOURCE_FILTERS.find((s) => s.value === selectedSource)
                        ?.label ?? 'All sources'}
                    </span>
                    <ChevronDown className="size-3 text-subtle" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 text-xs">
                  <DropdownMenuLabel>Filter by source</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SOURCE_FILTERS.map((s) => (
                    <DropdownMenuItem
                      key={s.value}
                      onSelect={() => setSelectedSource(s.value)}
                    >
                      <span>{s.label}</span>
                      {selectedSource === s.value ? (
                        <Check className="size-3.5 ml-auto text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

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

          {isLoading ? (
            <div className="shadow-2xs overflow-hidden rounded-card border border-border bg-surface/60 p-4">
              <SkeletonList rows={6} withAvatar />
            </div>
          ) : uploads.isError ? (
            <div className="rounded-card border border-border bg-surface/60 p-8 text-center">
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
          ) : (
            <>
              <UploadList
                items={visibleRows.map((r) => r.item)}
                currentUserId={user?.id}
                showSource
                downloadingId={
                  download.isPending ? (download.variables?.id ?? null) : null
                }
                deletingId={remove.isPending ? (remove.variables ?? null) : null}
                onPreview={(_item, index) =>
                  openPreview(
                    visibleRows.map((r) => r.media),
                    index,
                  )
                }
                onOpenDetails={(item, index) => {
                  const row = visibleRows.find((r) => r.item.id === item.id);
                  if (row?.upload) setDetailsId(row.upload.id);
                  else
                    openPreview(
                      visibleRows.map((r) => r.media),
                      index,
                    );
                }}
                onDownload={(item) => {
                  const row = visibleRows.find((r) => r.item.id === item.id);
                  if (!row) return;
                  if (row.item.manageable) {
                    download.mutate({ id: item.id, filename: item.filename });
                  } else if (row.directUrl) {
                    window.open(row.directUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                onDelete={(item) => void confirmDelete(item.id, item.filename)}
                onNavigateSource={(href) => navigate(href)}
                scrollParentRef={scrollRef}
                empty={
                  <div className="rounded-card border border-border bg-surface/60 p-8 text-center">
                    <EmptyState
                      size="sm"
                      icon={<HardDrive />}
                      title={
                        allRows.length
                          ? 'No files match your filters'
                          : 'No files yet'
                      }
                      description={
                        allRows.length
                          ? 'Try adjusting the source, type, or owner filters.'
                          : 'Upload a file, or share one in a channel, DM, project, agent or app.'
                      }
                      action={
                        allRows.length ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={resetFilters}
                          >
                            Reset filters
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setIsUploadOpen(true)}
                          >
                            Upload a file
                          </Button>
                        )
                      }
                    />
                  </div>
                }
              />

              {/* Infinite-scroll sentinel — pages the Upload rows, not the
                  bounded Matrix set. */}
              <div ref={sentinelRef} className="h-8" aria-hidden />
              {uploads.isFetchingNextPage ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  Loading more…
                </p>
              ) : uploads.hasNextPage ? (
                <div className="text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void uploads.fetchNextPage()}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {/* Upload Dialog */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogContent className="sm:max-w-md text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold">
                  Upload files
                </DialogTitle>
              </DialogHeader>

              <Field
                label="Destination"
                htmlFor="upload-destination"
                hint="Where this file is filed. Everyone with access to that place can see it."
              >
                <AppSelect
                  value={destination}
                  onValueChange={setDestination}
                  options={destinationGroups}
                  searchable
                  loading={destsLoading}
                  searchPlaceholder="Search channels, projects, people…"
                  placeholder="Choose a destination"
                />
              </Field>

              <FileDropzone
                workspaceId={workspaceId}
                target={parseDestinationValue(destination) as UploadTarget}
                label="Add files to this workspace"
                onUploaded={() => void uploads.refetch()}
              />
            </DialogContent>
          </Dialog>

          <AssetDetailsDialog
            upload={detailsUpload}
            open={!!detailsUpload}
            onOpenChange={(o) => !o && setDetailsId(null)}
            workspaceId={workspaceId}
            workspaceSlug={slug}
            canManage
            onNavigateSource={(href) => navigate(href)}
          />

          {prompts.dialog}
        </div>
      </div>
    </div>
  );
}
