import type { Upload as UploadEntity } from '@org/types';
import { Button, Progress } from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import { Check, FileText, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useFileUpload, type UploadTarget } from './use-upload.js';

export interface FileDropzoneProps {
  workspaceId: string | undefined;
  /** Files the uploads under a channel / DM / project / agent / app. */
  target?: UploadTarget;
  className?: string;
  label?: string;
  onUploaded?: (upload: UploadEntity) => void;
}

/**
 * Drag-and-drop file picker.
 *
 * Keyboard users get a real `<input type="file">` behind the surface rather
 * than a click-only div, so the control is operable without a pointer.
 */
export function FileDropzone({
  workspaceId,
  target,
  className,
  label = 'Attach files',
  onUploaded,
}: FileDropzoneProps) {
  const {
    files,
    addFiles,
    removeFile,
    clear,
    uploadAll,
    hasPending,
    isUploading,
    acceptAttribute,
    maxBytes,
  } = useFileUpload({ workspaceId, target, onUploaded });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          'gap-2 px-6 py-8 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors',
          dragging
            ? 'border-primary bg-accent'
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
        )}
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          Drag and drop, or click to browse — up to {formatBytes(maxBytes, 0)}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttribute}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            // Reset so selecting the same file again still fires onChange.
            event.target.value = '';
          }}
        />
      </label>

      {files.length > 0 ? (
        <>
          <ul className="mt-3 space-y-2">
            {files.map((entry) => (
              <li
                key={entry.id}
                className="gap-3 px-3 py-2 flex items-center rounded-md border"
              >
                {entry.previewUrl ? (
                  <img
                    src={entry.previewUrl}
                    alt=""
                    className="size-9 rounded shrink-0 object-cover"
                  />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{entry.file.name}</p>
                  <p
                    className={cn(
                      'text-xs',
                      entry.status === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {entry.error ?? formatBytes(entry.file.size)}
                  </p>
                  {entry.status === 'uploading' ? (
                    <Progress
                      value={entry.progress}
                      className="mt-1.5 h-1"
                      aria-label={`Uploading ${entry.file.name}`}
                    />
                  ) : null}
                </div>

                {entry.status === 'done' ? (
                  <Check
                    className="size-4 shrink-0 text-success"
                    aria-label="Uploaded"
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${entry.file.name}`}
                    onClick={() => removeFile(entry.id)}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 gap-2 flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={clear} disabled={isUploading}>
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => uploadAll.mutate()}
              disabled={!hasPending || isUploading || !workspaceId}
            >
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
