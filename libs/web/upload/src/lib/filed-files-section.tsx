import { useMediaPreview } from '@org/media-preview';
import {
  Button,
  EmptyState,
  SkeletonList,
  usePromptDialog,
} from '@org/ui';
import { HardDrive, Plus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AssetDetailsDialog } from './asset-details-dialog.js';
import { FileDropzone } from './file-dropzone.js';
import { UploadList, type UploadListItem } from './upload-list.js';
import { useUploadMediaAdapter } from './use-upload-preview.js';
import { useUploads, useUploadMutations, type UploadTarget } from './use-upload.js';

export interface FiledFilesSectionProps {
  workspaceId: string | undefined;
  /** Where files uploaded here are filed. */
  target: UploadTarget;
  /** Slug used to deep-link a file to its origin from the details panel. */
  workspaceSlug?: string;
  currentUserId?: string;
  /** Gates rename / move / delete. Defaults to true. */
  canManage?: boolean;
  /** Dropzone label. */
  uploadLabel?: string;
  /** Empty-state copy. */
  emptyDescription?: string;
  /** Navigate to a file's origin. */
  onNavigateSource?: (href: string) => void;
  className?: string;
}

/**
 * "Filed files" for one surface — a project, a card, a conversation: the upload
 * button, the list, the details panel, all scoped to `target`. The single
 * reusable block behind every per-surface file section.
 */
export function FiledFilesSection({
  workspaceId,
  target,
  workspaceSlug,
  currentUserId,
  canManage = true,
  uploadLabel = 'Add files',
  emptyDescription = 'Upload a file to keep it here.',
  onNavigateSource,
  className,
}: FiledFilesSectionProps) {
  const uploads = useUploads(workspaceId, target);
  const { remove, download } = useUploadMutations(workspaceId);
  const { toMediaItem } = useUploadMediaAdapter(workspaceId);
  const { openPreview } = useMediaPreview();
  const prompts = usePromptDialog();

  const [showDropzone, setShowDropzone] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsUpload =
    (detailsId && (uploads.data ?? []).find((u) => u.id === detailsId)) || null;

  const items = useMemo<UploadListItem[]>(
    () =>
      (uploads.data ?? []).map((file) => ({
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        uploader: file.uploader,
        manageable: canManage,
      })),
    [uploads.data, canManage],
  );

  const confirmDelete = async (item: UploadListItem) => {
    const ok = await prompts.confirmAction({
      title: `Delete “${item.filename}”?`,
      description: 'The file is removed for everyone with access. This cannot be undone.',
      confirmLabel: 'Delete file',
      destructive: true,
    });
    if (ok) remove.mutate(item.id);
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Files{items.length ? ` (${items.length})` : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs gap-1 px-1.5"
          disabled={!workspaceId}
          onClick={() => setShowDropzone((v) => !v)}
        >
          <Plus className="size-3.5" /> Upload
        </Button>
      </div>

      {showDropzone ? (
        <div className="mb-3 rounded-card border border-border bg-surface/60 p-3">
          <FileDropzone
            workspaceId={workspaceId}
            target={target}
            label={uploadLabel}
            onUploaded={() => void uploads.refetch()}
          />
        </div>
      ) : null}

      {uploads.isLoading ? (
        <SkeletonList rows={3} withAvatar />
      ) : uploads.isError ? (
        <EmptyState
          size="sm"
          icon={<TriangleAlert />}
          title="Could not load files"
          description="Something went wrong."
          action={
            <Button size="sm" variant="outline" onClick={() => void uploads.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <UploadList
          items={items}
          currentUserId={currentUserId}
          downloadingId={
            download.isPending ? (download.variables?.id ?? null) : null
          }
          deletingId={remove.isPending ? (remove.variables ?? null) : null}
          onPreview={(_item, index) =>
            openPreview((uploads.data ?? []).map(toMediaItem), index)
          }
          onOpenDetails={(item) => setDetailsId(item.id)}
          onDownload={(item) =>
            download.mutate({ id: item.id, filename: item.filename })
          }
          onDelete={canManage ? confirmDelete : undefined}
          empty={
            <EmptyState
              size="sm"
              icon={<HardDrive />}
              title="No files yet"
              description={emptyDescription}
              action={
                <Button size="sm" onClick={() => setShowDropzone(true)}>
                  Upload a file
                </Button>
              }
            />
          }
        />
      )}

      <AssetDetailsDialog
        upload={detailsUpload}
        open={!!detailsUpload}
        onOpenChange={(o) => !o && setDetailsId(null)}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        canManage={canManage}
        onNavigateSource={onNavigateSource}
      />

      {prompts.dialog}
    </div>
  );
}
