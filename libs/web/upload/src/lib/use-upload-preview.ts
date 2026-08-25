import { uploadApi } from '@org/api-client';
import { getMediaType, type MediaItem } from '@org/media-preview';
import type { Upload } from '@org/types';
import { useCallback } from 'react';

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
    (upload: Pick<Upload, 'id' | 'filename' | 'mimeType' | 'size'>): MediaItem => ({
      id: upload.id,
      name: upload.filename,
      mimeType: upload.mimeType,
      size: upload.size,
      category: getMediaType(upload.mimeType, upload.filename),
      resolveUrl: async () => {
        if (!workspaceId) throw new Error('No workspace selected.');
        const blob = await uploadApi.download(workspaceId, upload.id);
        return URL.createObjectURL(blob);
      },
    }),
    [workspaceId],
  );

  return { toMediaItem };
}
