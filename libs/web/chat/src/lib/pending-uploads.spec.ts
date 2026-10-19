import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  retryUpload,
  uploadFiles,
  usePendingUploadsStore,
} from './pending-uploads.js';

type SendFilesOptions = {
  batchId?: string;
  threadRootId?: string;
  onFileProgress?: (index: number, percent: number) => void;
  onFileUploaded?: (index: number, ok: boolean) => void;
};

function file(name: string, type = 'image/png') {
  return new File(['x'], name, { type });
}

beforeEach(() => {
  usePendingUploadsStore.setState({ uploads: [] });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('uploadFiles', () => {
  it('shows the upload while it runs and clears it once sent', async () => {
    let seen: ReturnType<typeof usePendingUploadsStore.getState>['uploads'] = [];
    const client = {
      sendFiles: vi.fn(async (_room: string, files: File[], options: SendFilesOptions) => {
        options.onFileProgress?.(0, 50);
        seen = usePendingUploadsStore.getState().uploads;
        files.forEach((_, i) => options.onFileUploaded?.(i, true));
        return { failed: [] };
      }),
    };

    await uploadFiles(client, '!room', [file('a.png'), file('b.pdf', 'application/pdf')]);

    expect(seen).toHaveLength(1);
    expect(seen[0].files[0]).toMatchObject({ progress: 50, previewUrl: 'blob:preview' });
    expect(seen[0].files[1].previewUrl).toBeUndefined();
    // The batch id on the events is the one the pending row hides behind.
    expect(client.sendFiles.mock.calls[0][2].batchId).toBe(seen[0].batchId);
    expect(usePendingUploadsStore.getState().uploads).toEqual([]);
  });

  it('keeps only the failed files, and a retry sends them under a new batch id', async () => {
    const client = {
      sendFiles: vi.fn(async (_room: string, _files: File[], _options: SendFilesOptions) => ({
        failed: [1],
      })),
    };

    await uploadFiles(client, '!room', [file('a.png'), file('b.png'), file('c.png')]);

    const [failed] = usePendingUploadsStore.getState().uploads;
    expect(failed.status).toBe('failed');
    expect(failed.files.map((f) => f.name)).toEqual(['b.png']);

    const firstBatch = client.sendFiles.mock.calls[0][2].batchId;
    client.sendFiles.mockResolvedValueOnce({ failed: [] });
    await retryUpload(client, failed.id);

    const retry = client.sendFiles.mock.calls[1];
    expect((retry[1] as File[]).map((f) => f.name)).toEqual(['b.png']);
    expect(retry[2].batchId).not.toBe(firstBatch);
    expect(usePendingUploadsStore.getState().uploads).toEqual([]);
  });

  it('marks the whole upload failed when sending the message fails', async () => {
    const client = {
      sendFiles: vi.fn(async () => {
        throw new Error('Network down');
      }),
    };

    await uploadFiles(client, '!room', [file('a.png'), file('b.png')], {
      threadRootId: '$root',
    });

    const [upload] = usePendingUploadsStore.getState().uploads;
    expect(upload).toMatchObject({ status: 'failed', error: 'Network down', threadRootId: '$root' });
    expect(upload.files.every((f) => f.status === 'failed')).toBe(true);
  });
});
