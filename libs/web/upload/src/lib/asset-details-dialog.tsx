import { resolveMediaUrl } from '@org/api-client';
import { useMediaPreview } from '@org/media-preview';
import type { Upload } from '@org/types';
import {
  AppSelect,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  UserAvatar,
  usePromptDialog,
} from '@org/ui';
import { cn, formatBytes, formatDateTime, formatRelative } from '@org/utils';
import {
  Check,
  Download,
  ExternalLink,
  Eye,
  History,
  Pencil,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  destinationValue,
  parseDestinationValue,
  useDestinationOptions,
} from './destination-options.js';
import { uploadSourceHref } from './source-href.js';
import { kindOf } from './upload-list.js';
import { useUploadMediaAdapter } from './use-upload-preview.js';
import { useUploadMutations, useUploadVersions } from './use-upload.js';

export interface AssetDetailsDialogProps {
  upload: Upload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  /** Current workspace slug — used to deep-link to the file's origin. */
  workspaceSlug?: string;
  /** Gates rename / move / delete. */
  canManage?: boolean;
  /** Router navigation, e.g. `useNavigate()` from react-router. */
  onNavigateSource?: (href: string) => void;
  onDeleted?: () => void;
}

/**
 * The asset details panel — preview, full metadata, and permission-aware
 * rename / move / download / delete. Shared by the Files hub and every
 * per-surface file list.
 */
export function AssetDetailsDialog({
  upload,
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
  canManage = false,
  onNavigateSource,
  onDeleted,
}: AssetDetailsDialogProps) {
  const { remove, update, replaceVersion, download } =
    useUploadMutations(workspaceId);
  const { toMediaItem } = useUploadMediaAdapter(workspaceId);
  const { openPreview } = useMediaPreview();
  const prompts = usePromptDialog();
  const { groups, isLoading: destsLoading } = useDestinationOptions(workspaceId);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const versions = useUploadVersions(
    workspaceId,
    showHistory && upload ? upload.id : undefined,
  );

  useEffect(() => {
    setRenaming(false);
    setShowHistory(false);
    setName(upload?.filename ?? '');
  }, [upload?.id, upload?.filename]);

  if (!upload) return null;

  const uploaderName = upload.uploader.displayName ?? upload.uploader.name;
  const context = upload.context;
  const sourceHref = uploadSourceHref(workspaceSlug, context);
  const createdChanged =
    Math.abs(Date.parse(upload.updatedAt) - Date.parse(upload.createdAt)) >
    60_000;
  const thumb =
    upload.thumbnailUrl ? resolveMediaUrl(upload.thumbnailUrl) : undefined;

  const saveName = () => {
    const next = name.trim();
    if (!next || next === upload.filename) {
      setRenaming(false);
      return;
    }
    update.mutate(
      { uploadId: upload.id, patch: { filename: next } },
      { onSuccess: () => setRenaming(false) },
    );
  };

  const move = (value: string) => {
    const target = parseDestinationValue(value);
    update.mutate({
      uploadId: upload.id,
      patch: {
        contextType: target.type,
        contextId: target.type === 'WORKSPACE' ? null : (target.id ?? null),
      },
    });
  };

  const confirmDelete = async () => {
    const ok = await prompts.confirmAction({
      title: `Delete “${upload.filename}”?`,
      description:
        'The file is removed for everyone with access. This cannot be undone.',
      confirmLabel: 'Delete file',
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(upload.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            File details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {thumb ? (
            <button
              type="button"
              aria-label={`Preview ${upload.filename}`}
              onClick={() => openPreview([toMediaItem(upload)], 0)}
              className="block w-full overflow-hidden rounded-lg border border-border bg-surface-inset"
            >
              <img
                src={thumb}
                alt=""
                className="max-h-48 w-full object-contain"
              />
            </button>
          ) : null}

          {/* Name */}
          <div className="gap-2 flex items-start justify-between">
            {renaming ? (
              <div className="gap-1.5 flex flex-1 items-center">
                <Input
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setRenaming(false);
                  }}
                  className="h-7 text-xs"
                />
                <Button
                  size="icon-sm"
                  onClick={saveName}
                  disabled={update.isPending}
                  aria-label="Save name"
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setRenaming(false)}
                  aria-label="Cancel rename"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="min-w-0 gap-1.5 flex items-center">
                <h3 className="text-sm font-medium break-all text-foreground">
                  {upload.filename}
                </h3>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setRenaming(true)}
                    className="size-6 shrink-0 flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Rename file"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Metadata */}
          <dl className="gap-x-4 gap-y-2 grid grid-cols-[auto_1fr] text-[11px]">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="text-foreground">
              {upload.mimeType}{' '}
              <span className="text-muted-foreground">
                ({kindOf(upload.mimeType)})
              </span>
            </dd>

            <dt className="text-muted-foreground">Size</dt>
            <dd className="text-foreground">{formatBytes(upload.size)}</dd>

            <dt className="text-muted-foreground">Version</dt>
            <dd className="gap-2 flex items-center text-foreground">
              <span>v{upload.version}</span>
              {upload.hasVersions ? (
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="gap-1 inline-flex items-center text-primary hover:underline"
                >
                  <History className="size-3" />
                  <span>{showHistory ? 'Hide history' : 'History'}</span>
                </button>
              ) : null}
            </dd>

            <dt className="text-muted-foreground">Owner</dt>
            <dd className="gap-1.5 flex items-center text-foreground">
              <UserAvatar
                name={uploaderName}
                src={upload.uploader.avatarUrl}
                seed={upload.uploader.id}
                size="xs"
              />
              <span>{uploaderName}</span>
            </dd>

            <dt className="text-muted-foreground">Added</dt>
            <dd className="text-foreground" title={formatDateTime(upload.createdAt)}>
              {formatRelative(upload.createdAt)}
            </dd>

            {createdChanged ? (
              <>
                <dt className="text-muted-foreground">Updated</dt>
                <dd
                  className="text-foreground"
                  title={formatDateTime(upload.updatedAt)}
                >
                  {formatRelative(upload.updatedAt)}
                </dd>
              </>
            ) : null}

            <dt className="text-muted-foreground">Source</dt>
            <dd className="text-foreground">
              {context && context.type !== 'WORKSPACE' ? (
                sourceHref && onNavigateSource ? (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateSource(sourceHref);
                      onOpenChange(false);
                    }}
                    className="gap-1 inline-flex items-center rounded text-primary hover:underline"
                  >
                    <span>{context.label ?? context.type}</span>
                    <ExternalLink className="size-3" />
                  </button>
                ) : (
                  <span>
                    {context.label ?? context.type}
                    {context.label ? null : (
                      <span className="text-muted-foreground">
                        {' '}
                        (original location unavailable)
                      </span>
                    )}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">Workspace</span>
              )}
            </dd>
          </dl>

          {/* Version history */}
          {showHistory ? (
            <div className="rounded-md border border-border bg-surface-inset/40 p-2 space-y-1 max-h-40 overflow-y-auto">
              {versions.isLoading ? (
                <p className="text-[11px] text-muted-foreground px-1">Loading…</p>
              ) : (
                (versions.data ?? []).map((v) => (
                  <div
                    key={v.id}
                    className="gap-2 px-1 py-0.5 flex items-center justify-between text-[11px]"
                  >
                    <span className="text-foreground">
                      v{v.version}
                      {v.id === upload.id ? (
                        <span className="text-muted-foreground"> · current</span>
                      ) : null}
                    </span>
                    <span
                      className="text-muted-foreground"
                      title={formatDateTime(v.createdAt)}
                    >
                      {formatRelative(v.createdAt)} ·{' '}
                      {formatBytes(v.size)}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {/* Move */}
          {canManage ? (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Move to
              </span>
              <AppSelect
                value={destinationValue({
                  type: upload.contextType,
                  id: upload.contextId,
                })}
                onValueChange={move}
                options={groups}
                searchable
                loading={destsLoading || update.isPending}
                searchPlaceholder="Search destinations…"
                placeholder="Choose a destination"
              />
            </div>
          ) : null}

          {/* Actions */}
          <div className="gap-2 pt-1 flex flex-wrap items-center border-t border-border/60">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => openPreview([toMediaItem(upload)], 0)}
            >
              <Eye className="size-3.5" /> Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              disabled={download.isPending}
              onClick={() =>
                download.mutate({ id: upload.id, filename: upload.filename })
              }
            >
              <Download className="size-3.5" /> Download
            </Button>
            {canManage ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={replaceVersion.isPending}
                  onClick={() => replaceInputRef.current?.click()}
                >
                  <UploadIcon className="size-3.5" />
                  {replaceVersion.isPending ? 'Uploading…' : 'New version'}
                </Button>
                <input
                  ref={replaceInputRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) {
                      replaceVersion.mutate({ uploadId: upload.id, file });
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-7 gap-1.5 text-xs text-destructive hover:text-destructive',
                  )}
                  disabled={remove.isPending}
                  onClick={confirmDelete}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {prompts.dialog}
      </DialogContent>
    </Dialog>
  );
}
