import type { UploadContextType } from '@org/types';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  UserAvatar,
} from '@org/ui';
import { cn, formatBytes, formatDateTime, formatRelative } from '@org/utils';
import {
  Bot,
  Blocks,
  Download,
  Eye,
  FileArchive,
  FileJson,
  FileText,
  FolderKanban,
  Hash,
  Image as ImageIcon,
  Info,
  MessageSquare,
  MoreVertical,
  SquareKanban,
  Table2,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Broad buckets over the allowed MIME types — the type filter reads in the
 * user's terms ("Images", "Spreadsheets") rather than raw MIME strings, and
 * grouping keeps the menu from growing a row per new allowed type.
 */
export type FileKind = 'image' | 'document' | 'spreadsheet' | 'archive' | 'data';

export const KIND_LABEL: Record<FileKind, string> = {
  image: 'Images',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  archive: 'Archives',
  data: 'Data',
};

export function kindOf(mimeType: string): FileKind {
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

/** Where a file came from, shown as a small badge in the "All Files" hub. */
export interface UploadListSource {
  type: UploadContextType;
  /** null when it could not be resolved (e.g. a group-DM room). */
  label: string | null;
  /**
   * App-relative path to the file's origin. When set (and `onNavigateSource` is
   * provided), the badge becomes a button that navigates there.
   */
  href?: string | null;
}

const SOURCE_META: Record<
  UploadContextType,
  { icon: typeof Hash; noun: string; className: string }
> = {
  WORKSPACE: {
    icon: FolderKanban,
    noun: 'Workspace',
    className: 'text-muted-foreground',
  },
  CHANNEL: { icon: Hash, noun: 'Channel', className: 'text-accent-blue' },
  DIRECT: {
    icon: MessageSquare,
    noun: 'Direct message',
    className: 'text-accent-green',
  },
  PROJECT: {
    icon: FolderKanban,
    noun: 'Project',
    className: 'text-accent-violet',
  },
  AGENT: { icon: Bot, noun: 'Agent', className: 'text-accent-cyan' },
  APP: { icon: Blocks, noun: 'App', className: 'text-accent-amber' },
  DOCUMENT: {
    icon: FileText,
    noun: 'Document',
    className: 'text-accent-blue',
  },
  ISSUE: { icon: SquareKanban, noun: 'Issue', className: 'text-accent-rose' },
};

function SourceBadge({
  source,
  onNavigate,
}: {
  source: UploadListSource;
  onNavigate?: (href: string) => void;
}) {
  const meta = SOURCE_META[source.type];
  const Icon = meta.icon;
  const clickable = !!source.href && !!onNavigate;

  const inner = (
    <>
      <Icon className={cn('size-3 shrink-0', meta.className)} aria-hidden />
      <span className="truncate">{source.label ?? meta.noun}</span>
    </>
  );

  if (clickable) {
    return (
      <Badge
        asChild
        variant="neutral"
        className="gap-1 px-1.5 py-0 h-4.5 text-[10px] font-medium max-w-[16ch] cursor-pointer transition-colors hover:bg-accent hover:text-foreground"
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate?.(source.href as string);
          }}
          title={`Open in ${source.label ?? meta.noun}`}
        >
          {inner}
        </button>
      </Badge>
    );
  }

  return (
    <Badge
      variant="neutral"
      className="gap-1 px-1.5 py-0 h-4.5 text-[10px] font-medium max-w-[16ch]"
    >
      {inner}
    </Badge>
  );
}

export interface UploadListItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  /** Bumped on rename / move — shown as "edited …" when it differs. */
  updatedAt?: string;
  uploader: {
    id: string;
    name: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  source?: UploadListSource | null;
  /**
   * false for files that only live in the chat timeline (Matrix media) — they
   * can be previewed and downloaded but not renamed or deleted from here.
   */
  manageable?: boolean;
}

export interface UploadListProps {
  items: UploadListItem[];
  currentUserId?: string;
  /** Show the origin badge (channel / DM / project / …). Off inside a surface. */
  showSource?: boolean;
  downloadingId?: string | null;
  deletingId?: string | null;
  onPreview: (item: UploadListItem, index: number) => void;
  onDownload: (item: UploadListItem) => void;
  onDelete?: (item: UploadListItem) => void;
  /** Opens the details panel. When set, a row's primary click opens it. */
  onOpenDetails?: (item: UploadListItem, index: number) => void;
  /** Navigate to a source's origin (`source.href`). Enables the source badge. */
  onNavigateSource?: (href: string) => void;
  className?: string;
  /** Rendered in place of the rows when `items` is empty. */
  empty?: ReactNode;
}

/**
 * The workspace file row, shared by the "All Files" hub, the project Files tab
 * and every conversation's Files & Media panel.
 */
export function UploadList({
  items,
  currentUserId,
  showSource = false,
  downloadingId,
  deletingId,
  onPreview,
  onDownload,
  onDelete,
  onOpenDetails,
  onNavigateSource,
  className,
  empty,
}: UploadListProps) {
  if (items.length === 0 && empty !== undefined) return <>{empty}</>;

  return (
    <div
      className={cn(
        'shadow-2xs divide-y divide-border/60 overflow-hidden rounded-card border border-border bg-surface/60',
        className,
      )}
    >
      {items.map((item, index) => (
        <UploadRow
          key={item.id}
          item={item}
          index={index}
          isOwner={item.uploader.id === currentUserId}
          showSource={showSource}
          isDownloading={downloadingId === item.id}
          isDeleting={deletingId === item.id}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
          onOpenDetails={onOpenDetails}
          onNavigateSource={onNavigateSource}
        />
      ))}
    </div>
  );
}

function UploadRow({
  item,
  index,
  isOwner,
  showSource,
  isDownloading,
  isDeleting,
  onPreview,
  onDownload,
  onDelete,
  onOpenDetails,
  onNavigateSource,
}: {
  item: UploadListItem;
  index: number;
  isOwner: boolean;
  showSource: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  onPreview: (item: UploadListItem, index: number) => void;
  onDownload: (item: UploadListItem) => void;
  onDelete?: (item: UploadListItem) => void;
  onOpenDetails?: (item: UploadListItem, index: number) => void;
  onNavigateSource?: (href: string) => void;
}) {
  const uploaderName = item.uploader.displayName ?? item.uploader.name;
  const canDelete = item.manageable !== false && !!onDelete;
  const primary = onOpenDetails ?? onPreview;
  const edited =
    item.updatedAt &&
    Math.abs(Date.parse(item.updatedAt) - Date.parse(item.createdAt)) > 60_000;

  return (
    <div
      className={cn(
        'group gap-3 p-3 sm:px-4 flex items-center justify-between transition-colors hover:bg-accent/40',
        isDeleting && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={() => primary(item, index)}
        aria-label={`${onOpenDetails ? 'Details for' : 'Preview'} ${item.filename}`}
        className="gap-3 min-w-0 flex flex-1 items-center text-left focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none rounded-md"
      >
        <FileTypeBadge mimeType={item.mimeType} />

        <div className="min-w-0 flex-1">
          <div className="gap-1.5 flex items-center">
            <h3 className="text-xs sm:text-sm font-medium truncate text-foreground">
              {item.filename}
            </h3>
            {showSource && item.source ? (
              <SourceBadge
                source={item.source}
                onNavigate={onNavigateSource}
              />
            ) : null}
          </div>
          <div className="gap-1.5 mt-0.5 flex items-center truncate text-[11px] text-muted-foreground">
            <span className="truncate">
              {isOwner ? `${uploaderName} (you)` : uploaderName}
            </span>
            <span>·</span>
            <span className="truncate" title={formatDateTime(item.createdAt)}>
              {formatRelative(item.createdAt)}
            </span>
            <span>·</span>
            <span>{formatBytes(item.size)}</span>
            {edited ? (
              <>
                <span>·</span>
                <span title={formatDateTime(item.updatedAt as string)}>
                  edited {formatRelative(item.updatedAt as string)}
                </span>
              </>
            ) : null}
            {item.manageable === false ? (
              <>
                <span>·</span>
                <span className="text-subtle">in chat</span>
              </>
            ) : null}
          </div>
        </div>
      </button>

      <div className="gap-2 sm:gap-3 flex shrink-0 items-center">
        <UserAvatar
          name={uploaderName}
          src={item.uploader.avatarUrl}
          seed={item.uploader.id}
          size="xs"
          className="sm:block hidden ring-2 ring-background"
        />

        <Hint label="Preview">
          <button
            onClick={() => onPreview(item, index)}
            aria-label={`Preview ${item.filename}`}
            className="size-7 hidden sm:flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground"
          >
            <Eye className="size-3.5" />
          </button>
        </Hint>

        <Hint label="Download file">
          <button
            onClick={() => onDownload(item)}
            disabled={isDownloading}
            aria-label={`Download ${item.filename}`}
            className="size-7 flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" />
          </button>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="size-7 flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`More options for ${item.filename}`}
            >
              <MoreVertical className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            {onOpenDetails ? (
              <DropdownMenuItem onSelect={() => onOpenDetails(item, index)}>
                <Info className="size-3.5 mr-2" />
                <span>Details</span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => onPreview(item, index)}>
              <Eye className="size-3.5 mr-2" />
              <span>Preview</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDownload(item)}>
              <Download className="size-3.5 mr-2" />
              <span>Download</span>
            </DropdownMenuItem>
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete?.(item)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5 mr-2" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
