import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import { Input } from './input.js';
import { Label } from './primitives.js';

interface TextRequest {
  kind: 'text';
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

interface ConfirmRequest {
  kind: 'confirm';
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

type Request = TextRequest | ConfirmRequest;

export interface PromptDialog {
  /** Render this once inside the component that owns the hook. */
  dialog: ReactNode;
  /** Resolves with the trimmed value, or `null` if dismissed. */
  promptText: (request: Omit<TextRequest, 'kind'>) => Promise<string | null>;
  /** Resolves `true` only if the user confirmed. */
  confirmAction: (request: Omit<ConfirmRequest, 'kind'>) => Promise<boolean>;
}

/**
 * Promise-based replacement for `window.prompt` / `window.confirm`.
 *
 * The sidebar and the docs editor drove every rename, delete and create through
 * those native dialogs. They cannot be themed, they block the main thread, they
 * are suppressed outright in some cross-origin contexts — and Electron removed
 * `prompt()` altogether, so in the desktop build those call sites threw or
 * silently returned nothing. This keeps the same `await`-shaped call sites while
 * rendering a real Radix dialog with focus trapping and Escape handling.
 *
 * Lives in `@org/ui` rather than in a feature library so both the sidebar and
 * the document editor can reach it — `@org/web-layout` already depends on
 * `@org/web-work-tools`, so the reverse import would be a cycle.
 */
export function usePromptDialog(): PromptDialog {
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState('');
  const resolveRef = useRef<((result: string | null | boolean) => void) | null>(
    null,
  );
  const fieldId = useId();

  const settle = useCallback((result: string | null | boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setRequest(null);
    setValue('');
  }, []);

  const promptText = useCallback((spec: Omit<TextRequest, 'kind'>) => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve as (result: string | null | boolean) => void;
      setValue(spec.defaultValue ?? '');
      setRequest({ ...spec, kind: 'text' });
    });
  }, []);

  const confirmAction = useCallback((spec: Omit<ConfirmRequest, 'kind'>) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve as (result: string | null | boolean) => void;
      setRequest({ ...spec, kind: 'confirm' });
    });
  }, []);

  const isText = request?.kind === 'text';
  const trimmed = value.trim();

  const dialog = (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        /* Escape, overlay click and the close button all land here — a
           dismissal must settle the promise or the caller waits forever. */
        if (!open) settle(isText ? null : false);
      }}
    >
      <DialogContent className="max-w-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isText) {
              if (!trimmed) return;
              settle(trimmed);
            } else {
              settle(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            {request?.description ? (
              <DialogDescription>{request.description}</DialogDescription>
            ) : null}
          </DialogHeader>

          {request?.kind === 'text' ? (
            <div className="space-y-1.5 px-5 py-2">
              <Label htmlFor={fieldId} className="text-xs">
                {request.label}
              </Label>
              <Input
                id={fieldId}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={request.placeholder}
                autoFocus
                /* Native prompt() selected the existing text; keep that. */
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => settle(isText ? null : false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={
                request?.kind === 'confirm' && request.destructive
                  ? 'destructive'
                  : 'primary'
              }
              disabled={isText && !trimmed}
            >
              {request?.confirmLabel ?? (isText ? 'Save' : 'Confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { dialog, promptText, confirmAction };
}
