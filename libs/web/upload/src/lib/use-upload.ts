import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  uploadRequestSchema,
} from '@org/validation';
import { useCallback, useState } from 'react';

export interface UploadCandidate {
  id: string;
  file: File;
  /** Object URL for image previews; revoked on removal. */
  previewUrl?: string;
  error?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
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

/**
 * Client-side staging for file uploads.
 *
 * Phase 2 covers selection, validation and preview; the transfer itself is
 * wired once the storage driver exists behind `POST /uploads`. Files are
 * validated with the same schema the API uses, so the rules cannot drift.
 */
export function useFileUpload() {
  const [files, setFiles] = useState<UploadCandidate[]>([]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next: UploadCandidate[] = Array.from(incoming).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
      error: validate(file),
      progress: 0,
      status: validate(file) ? 'error' : 'pending',
    }));

    setFiles((current) => {
      // De-duplicate by identity so dropping the same file twice is a no-op.
      const seen = new Set(current.map((entry) => entry.id));
      return [...current, ...next.filter((entry) => !seen.has(entry.id))];
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      // Leaking object URLs keeps the whole File alive in memory.
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setFiles((current) => {
      for (const entry of current) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
      return [];
    });
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    clear,
    hasErrors: files.some((entry) => entry.status === 'error'),
    acceptAttribute: ALLOWED_UPLOAD_MIME_TYPES.join(','),
    maxBytes: MAX_UPLOAD_BYTES,
  };
}
