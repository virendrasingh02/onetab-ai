import { queryKeys, uploadApi, type UpdateUploadParams } from '@org/api-client';
import type {
  Upload,
  UploadContextType,
  UploadDestinations,
  UploadStorageUsage,
} from '@org/types';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  uploadRequestSchema,
} from '@org/validation';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UploadCandidate {
  id: string;
  file: File;
  /** Object URL for image previews; revoked on removal. */
  previewUrl?: string;
  error?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** Set once the transfer succeeds. */
  uploaded?: Upload;
}

/**
 * Where an upload is filed. Omitted / `WORKSPACE` means an unfiled workspace
 * upload; every other kind carries the id of the channel / project / agent /
 * app, or (for `DIRECT`) the peer user id or group-DM room id.
 */
export interface UploadTarget {
  type: UploadContextType;
  id?: string | null;
}

/** Stable string form of a target, for query keys. `undefined` -> every upload. */
export function uploadTargetKey(target?: UploadTarget): string {
  if (!target) return 'all';
  if (target.type === 'WORKSPACE') return 'WORKSPACE:';
  return `${target.type}:${target.id ?? ''}`;
}

function targetParams(target?: UploadTarget) {
  if (!target) return undefined;
  return { contextType: target.type, contextId: target.id ?? undefined };
}

function validate(file: File): string | undefined {
  const result = uploadRequestSchema.safeParse({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  });
  if (result.success) return undefined;
  return result.error.issues[0]?.message ?? 'This file cannot be uploaded.';
}

/** Stable identity for a picked file, so the same drop twice is a no-op. */
function candidateId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export interface UseFileUploadOptions {
  workspaceId: string | undefined;
  /** Attaches the upload to a channel / DM / project / agent / app. */
  target?: UploadTarget;
  onUploaded?: (upload: Upload) => void;
}

/**
 * Staging and transfer for file uploads.
 *
 * Files are validated with the same schema the API uses, so the rules cannot
 * drift between the two; the server re-checks regardless, since a client-side
 * limit is a courtesy rather than a control.
 */
export function useFileUpload({
  workspaceId,
  target,
  onUploaded,
}: UseFileUploadOptions) {
  const [files, setFiles] = useState<UploadCandidate[]>([]);
  const queryClient = useQueryClient();

  /*
   * In-flight transfers, so unmounting mid-upload cancels rather than leaving
   * the request to resolve into a component that no longer exists.
   */
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      for (const controller of inFlight.values()) controller.abort();
    };
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<UploadCandidate>) => {
      setFiles((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, ...changes } : entry,
        ),
      );
    },
    [],
  );

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next: UploadCandidate[] = Array.from(incoming).map((file) => {
      const error = validate(file);
      return {
        id: candidateId(file),
        file,
        previewUrl: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
        error,
        progress: 0,
        status: error ? 'error' : 'pending',
      };
    });

    setFiles((current) => {
      // De-duplicate by identity so dropping the same file twice is a no-op.
      const seen = new Set(current.map((entry) => entry.id));
      const added = next.filter((entry) => !seen.has(entry.id));
      // Previews for rejected duplicates would otherwise leak.
      for (const entry of next) {
        if (seen.has(entry.id) && entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      }
      return [...current, ...added];
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);

    setFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      // Leaking object URLs keeps the whole File alive in memory.
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();

    setFiles((current) => {
      for (const entry of current) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
      return [];
    });
  }, []);

  const uploadOne = useCallback(
    async (entry: UploadCandidate): Promise<Upload | undefined> => {
      if (!workspaceId || entry.error) return undefined;

      const controller = new AbortController();
      controllers.current.set(entry.id, controller);
      patch(entry.id, { status: 'uploading', progress: 0 });

      try {
        const uploaded = await uploadApi.upload(workspaceId, entry.file, {
          ...targetParams(target),
          signal: controller.signal,
          onProgress: (percent) => patch(entry.id, { progress: percent }),
        });
        patch(entry.id, { status: 'done', progress: 100, uploaded });
        onUploaded?.(uploaded);
        return uploaded;
      } catch (error) {
        patch(entry.id, {
          status: 'error',
          error:
            error instanceof Error ? error.message : 'The upload failed.',
        });
        return undefined;
      } finally {
        controllers.current.delete(entry.id);
      }
    },
    [workspaceId, target, patch, onUploaded],
  );

  const uploadAll = useMutation({
    mutationFn: async () => {
      const pending = files.filter((entry) => entry.status === 'pending');
      /*
       * Sequential rather than parallel: browsers cap concurrent connections
       * per host anyway, and one file at a time keeps the progress bars
       * meaningful instead of all crawling together.
       */
      const uploaded: Upload[] = [];
      for (const entry of pending) {
        const result = await uploadOne(entry);
        if (result) uploaded.push(result);
      }
      return uploaded;
    },
    onSuccess: () => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.uploads.all(workspaceId),
      });
    },
  });

  return {
    files,
    addFiles,
    removeFile,
    clear,
    uploadAll,
    hasErrors: files.some((entry) => entry.status === 'error'),
    hasPending: files.some((entry) => entry.status === 'pending'),
    isUploading: files.some((entry) => entry.status === 'uploading'),
    acceptAttribute: ALLOWED_UPLOAD_MIME_TYPES.join(','),
    maxBytes: MAX_UPLOAD_BYTES,
  };
}

/**
 * A flat list of files for a workspace, scoped to `target` (or all of them).
 *
 * For a bounded surface — a project tab, a conversation panel — where one page
 * is plenty. The Files hub uses {@link useInfiniteUploads} instead.
 */
export function useUploads(
  workspaceId: string | undefined,
  target?: UploadTarget,
) {
  return useQuery({
    queryKey: queryKeys.uploads.list(workspaceId ?? '', uploadTargetKey(target)),
    queryFn: () =>
      uploadApi.list(workspaceId as string, targetParams(target), { limit: 200 }),
    enabled: !!workspaceId,
    staleTime: 30_000,
    select: (page) => page.items,
  });
}

/** Keyset-paginated files for the Files hub — one page per scroll. */
export function useInfiniteUploads(
  workspaceId: string | undefined,
  target?: UploadTarget,
  pageSize = 50,
) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.uploads.infinite(
      workspaceId ?? '',
      uploadTargetKey(target),
    ),
    queryFn: ({ pageParam }) =>
      uploadApi.list(workspaceId as string, targetParams(target), {
        cursor: pageParam as string | undefined,
        limit: pageSize,
      }),
    enabled: !!workspaceId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  return { ...query, items };
}

/** Channels / projects / agents / apps / people offered by the upload dialog. */
export function useUploadDestinations(workspaceId: string | undefined) {
  return useQuery<UploadDestinations>({
    queryKey: queryKeys.uploads.destinations(workspaceId ?? ''),
    queryFn: () => uploadApi.listDestinations(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
}

/** Workspace storage consumption + the plan cap, for the hub meter. */
export function useUploadStorageUsage(workspaceId: string | undefined) {
  return useQuery<UploadStorageUsage>({
    queryKey: queryKeys.uploads.usage(workspaceId ?? ''),
    queryFn: () => uploadApi.storageUsage(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function useUploadMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.uploads.all(workspaceId ?? ''),
    });

  const remove = useMutation({
    mutationFn: (uploadId: string) =>
      uploadApi.remove(workspaceId as string, uploadId),
    onSuccess: invalidate,
  });

  /** Rename and/or move — the details panel's editable fields. */
  const update = useMutation({
    mutationFn: ({
      uploadId,
      patch,
    }: {
      uploadId: string;
      patch: UpdateUploadParams;
    }) => uploadApi.update(workspaceId as string, uploadId, patch),
    onSuccess: invalidate,
  });

  /**
   * Downloads through axios rather than a bare `href`.
   *
   * The access token lives in memory, so a plain link would arrive at the
   * content route unauthenticated and 401.
   */
  const download = useMutation({
    mutationFn: async (upload: Pick<Upload, 'id' | 'filename'>) => {
      const blob = await uploadApi.download(workspaceId as string, upload.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = upload.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return upload.id;
    },
  });

  return { remove, update, download };
}
