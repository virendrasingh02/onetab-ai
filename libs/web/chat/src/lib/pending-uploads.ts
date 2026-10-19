import type { OneTabMatrixClient } from '@org/matrix-client';
import { useMemo } from 'react';
import { create } from 'zustand';

export type PendingUploadFileStatus = 'uploading' | 'uploaded' | 'failed';

export interface PendingUploadFile {
  file: File;
  name: string;
  mimeType: string;
  size: number;
  /** Local object URL for an instant image/video preview while it uploads. */
  previewUrl?: string;
  /** 0..100. */
  progress: number;
  status: PendingUploadFileStatus;
}

/**
 * One in-flight multi-file (or single-file) upload, shown in the timeline as
 * the sender's own message with live tiles until its events land. It lives
 * in memory only — the real message replaces it once sent.
 */
export interface PendingUpload {
  id: string;
  /** Stamped on every event of the current attempt; a retry gets a new one. */
  batchId: string;
  roomId: string;
  threadRootId?: string;
  createdAt: number;
  /** `sending`: every upload finished and the events are going out. */
  status: 'uploading' | 'sending' | 'failed';
  files: PendingUploadFile[];
  error?: string;
}

interface PendingUploadsState {
  uploads: PendingUpload[];
  add: (upload: PendingUpload) => void;
  patch: (
    id: string,
    patch: Partial<Pick<PendingUpload, 'status' | 'error' | 'batchId'>>,
  ) => void;
  patchFile: (id: string, index: number, patch: Partial<PendingUploadFile>) => void;
  remove: (id: string) => void;
}

function revokePreviews(upload: PendingUpload | undefined) {
  for (const file of upload?.files ?? []) {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
  }
}

export const usePendingUploadsStore = create<PendingUploadsState>((set, get) => ({
  uploads: [],
  add: (upload) => set((state) => ({ uploads: [...state.uploads, upload] })),
  patch: (id, patch) =>
    set((state) => ({
      uploads: state.uploads.map((upload) =>
        upload.id === id ? { ...upload, ...patch } : upload,
      ),
    })),
  patchFile: (id, index, patch) =>
    set((state) => ({
      uploads: state.uploads.map((upload) =>
        upload.id === id
          ? {
              ...upload,
              files: upload.files.map((file, i) =>
                i === index ? { ...file, ...patch } : file,
              ),
            }
          : upload,
      ),
    })),
  remove: (id) => {
    revokePreviews(get().uploads.find((upload) => upload.id === id));
    set((state) => ({
      uploads: state.uploads.filter((upload) => upload.id !== id),
    }));
  },
}));

/** The pending uploads for one room's timeline (`threadRootId` omitted) or one thread. */
export function usePendingUploads(
  roomId: string | null | undefined,
  threadRootId?: string,
): PendingUpload[] {
  // Select the stable array and filter outside — see `useMentionNotices`.
  const uploads = usePendingUploadsStore((state) => state.uploads);
  return useMemo(
    () =>
      roomId
        ? uploads.filter(
            (upload) =>
              upload.roomId === roomId && upload.threadRootId === threadRootId,
          )
        : [],
    [uploads, roomId, threadRootId],
  );
}

/**
 * Batch ids still going out in a room. Their echoed events stay hidden until
 * the upload clears, so the pending row turns into the real message in one
 * step instead of the grid filling in file by file beside it.
 */
export function usePendingBatchIds(roomId: string | null | undefined): Set<string> {
  const uploads = usePendingUploadsStore((state) => state.uploads);
  return useMemo(
    () =>
      new Set(
        uploads
          .filter((upload) => upload.roomId === roomId && upload.status !== 'failed')
          .map((upload) => upload.batchId),
      ),
    [uploads, roomId],
  );
}

let sequence = 0;

function newBatchId() {
  return `b.${Date.now()}.${++sequence}.${Math.random().toString(36).slice(2, 8)}`;
}

function previewable(file: File) {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

/**
 * Uploads files as one message, tracking it in {@link usePendingUploadsStore}
 * so the timeline shows each file uploading in place. Clears on success; on
 * a failure it stays, marked failed, so the user can retry or dismiss it.
 */
export async function uploadFiles(
  client: Pick<OneTabMatrixClient, 'sendFiles'>,
  roomId: string,
  files: File[],
  options: { threadRootId?: string } = {},
): Promise<void> {
  if (files.length === 0) return;
  const store = usePendingUploadsStore.getState();
  const id = newBatchId();

  store.add({
    id,
    batchId: id,
    roomId,
    threadRootId: options.threadRootId,
    createdAt: Date.now(),
    status: 'uploading',
    files: files.map((file) => ({
      file,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      previewUrl: previewable(file) ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'uploading',
    })),
  });

  await runUpload(client, id);
}

/** Retries the files of a failed upload that never made it. */
export async function retryUpload(
  client: Pick<OneTabMatrixClient, 'sendFiles'>,
  id: string,
): Promise<void> {
  const store = usePendingUploadsStore.getState();
  const upload = store.uploads.find((item) => item.id === id);
  if (!upload) return;
  // Uploaded-and-sent files already left; only the failed ones go again.
  // A fresh batch id: files that did send already form their own message.
  store.patch(id, { status: 'uploading', error: undefined, batchId: newBatchId() });
  upload.files.forEach((file, index) => {
    if (file.status === 'failed') {
      store.patchFile(id, index, { status: 'uploading', progress: 0 });
    }
  });
  await runUpload(client, id);
}

async function runUpload(
  client: Pick<OneTabMatrixClient, 'sendFiles'>,
  id: string,
): Promise<void> {
  const store = usePendingUploadsStore.getState();
  const upload = store.uploads.find((item) => item.id === id);
  if (!upload) return;

  // Indexes into `upload.files` of the files going out on this attempt.
  const indexes = upload.files.flatMap((file, index) =>
    file.status === 'uploading' ? [index] : [],
  );
  const files = indexes.map((index) => upload.files[index].file);

  try {
    let uploadedCount = 0;
    const { failed } = await client.sendFiles(upload.roomId, files, {
      threadRootId: upload.threadRootId,
      batchId: usePendingUploadsStore
        .getState()
        .uploads.find((item) => item.id === id)?.batchId,
      onFileProgress: (i, percent) =>
        store.patchFile(id, indexes[i], { progress: percent }),
      onFileUploaded: (i, ok) => {
        store.patchFile(id, indexes[i], {
          status: ok ? 'uploaded' : 'failed',
          progress: ok ? 100 : 0,
        });
        uploadedCount += 1;
        if (uploadedCount === files.length) store.patch(id, { status: 'sending' });
      },
    });

    if (failed.length === 0) {
      store.remove(id);
      return;
    }
    // Sent files are now real messages — keep only the failed ones here.
    const failedFiles = new Set(failed.map((i) => indexes[i]));
    const current = usePendingUploadsStore.getState().uploads.find((u) => u.id === id);
    if (!current) return;
    for (const [index, file] of current.files.entries()) {
      if (!failedFiles.has(index) && file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    }
    usePendingUploadsStore.setState((state) => ({
      uploads: state.uploads.map((u) =>
        u.id === id
          ? {
              ...u,
              status: 'failed',
              error:
                failed.length === 1
                  ? `${u.files[indexes[failed[0]]].name} could not be uploaded.`
                  : `${failed.length} files could not be uploaded.`,
              files: u.files.filter((_, index) => failedFiles.has(index)),
            }
          : u,
      ),
    }));
  } catch (err) {
    // Sending the events failed — the uploads cannot be told apart from
    // sent ones here, so the whole upload is offered for retry.
    usePendingUploadsStore.setState((state) => ({
      uploads: state.uploads.map((u) =>
        u.id === id
          ? {
              ...u,
              status: 'failed',
              error: err instanceof Error ? err.message : 'Could not send the files.',
              files: u.files.map((file) => ({ ...file, status: 'failed', progress: 0 })),
            }
          : u,
      ),
    }));
  }
}
