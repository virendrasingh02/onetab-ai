import { uploadApi } from '@org/api-client';
import { getMediaType, type MediaItem } from '@org/media-preview';
import type { Upload } from '@org/types';
import { toPresenceStatus } from '@org/ui';
import { useCallback } from 'react';

/**
 * What the preview adapter needs from an `Upload`. `id`/`filename`/`mimeType`/
 * `size` are always there; `uploader`/`createdAt` only come with the full row
 * (the file manager has it, workspace search's lean result does not).
 */
type UploadPreviewInput = Pick<
  Upload,
  'id' | 'filename' | 'mimeType' | 'size'
> &
  Partial<Pick<Upload, 'uploader' | 'createdAt'>>;

/**
 * Adapts an `Upload` entity (file manager, file search) into a `MediaItem`
 * for the shared preview. `Upload` has no direct `url` — the content route
 * requires the bearer token that lives in memory, so `resolveUrl` fetches it
 * the same authenticated way `useUploadMutations`'s `download` mutation does,
 * just returning an object URL instead of forcing a save-to-disk.
 *
 * This lives here rather than in `@org/media-preview` because that library
 * is `type:ui`/`scope:shared` and cannot depend on `@org/api-client`.
 */
export function useUploadMediaAdapter(workspaceId: string | undefined) {
  const toMediaItem = useCallback(
    (upload: UploadPreviewInput): MediaItem => {
      const uploader = upload.uploader;
      return {
        id: upload.id,
        name: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        category: getMediaType(upload.mimeType, upload.filename),
        senderId: uploader?.id,
        senderName: uploader?.name,
        senderAvatarUrl: uploader?.avatarUrl ?? undefined,
        senderPresence: uploader
          ? toPresenceStatus(uploader.presence)
          : undefined,
        senderStatusEmoji: uploader?.statusEmoji ?? undefined,
        senderStatusText: uploader?.statusText ?? undefined,
        timestamp: upload.createdAt,
        resolveUrl: async () => {
          if (!workspaceId) throw new Error('No workspace selected.');
          const blob = await uploadApi.download(workspaceId, upload.id);
          return URL.createObjectURL(blob);
        },
      };
    },
    [workspaceId],
  );

  return { toMediaItem };
}
