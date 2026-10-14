import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';
import { create } from 'zustand';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog.js';
import { Input } from './input.js';
import { Label } from './primitives.js';

export interface ConfirmOptions {
  /** Short question, e.g. `Delete “Q3 Roadmap”?`. */
  title: ReactNode;
  /** One line of context — what happens, and whether it can be undone. */
  description?: ReactNode;
  /** Extra content between the description and the buttons (a list, a warning). */
  body?: ReactNode;
  /** Confirm button text. Defaults to `Delete` when destructive, else `Confirm`. */
  confirmLabel?: string;
  /** Cancel button text. Defaults to `Cancel`. */
  cancelLabel?: string;
  /** Red confirm button + irreversible framing. Default `false`. Implies `tone: 'danger'`. */
  destructive?: boolean;
  /**
   * Visual weight. `danger` = red trash icon (irreversible); `warning` = amber
   * icon for risky-but-recoverable actions (publish, archive, pause);
   * `default` = neutral question icon. Defaults to `danger` when `destructive`.
   */
  tone?: 'default' | 'warning' | 'danger';
  /**
   * When set, the confirm button stays disabled until the user types this exact
   * string. Reserve for high blast-radius actions (delete workspace / channel).
   */
  requireText?: string;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  settle: (confirmed: boolean) => void;
}

interface ConfirmStore {
  current: ConfirmRequest | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

let requestCounter = 0;

const useConfirmStore = create<ConfirmStore>()((set, get) => ({
  current: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      // Only one confirm at a time — a second request supersedes the first,
      // which must settle so its awaiter is never left hanging.
      const existing = get().current;
      existing?.settle(false);
      set({ current: { ...options, id: ++requestCounter, settle: resolve } });
    }),
  settle: (confirmed) => {
    const existing = get().current;
    if (!existing) return;
    existing.settle(confirmed);
    set({ current: null });
  },
}));

/**
 * Imperative confirmation dialog — the destructive-action counterpart to
 * `toast`. Call it from anywhere (event handlers, stores, plain async
 * functions):
 *
 * ```ts
 * if (await confirm({ title: 'Delete “Roadmap”?', destructive: true })) {
 *   deleteDoc.mutate(id);
 * }
 * ```
 *
 * Resolves `true` only when the user presses the confirm button; `false` on
 * Cancel, Escape, an overlay click, or when a newer confirm supersedes it.
 *
 * Requires `<ConfirmRoot />` mounted once near the app root (it sits beside the
 * `<Toaster />` in each app's providers).
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(options);
}

/** Hook form for call sites that prefer it. Returns the same `confirm`. */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useConfirmStore((s) => s.open);
}

/**
 * Single host for every `confirm()` call in the app. Renders nothing until a
 * request comes in. Mount once, near `<Toaster />`.
 */
export function ConfirmRoot() {
  const current = useConfirmStore((s) => s.current);
  const settle = useConfirmStore((s) => s.settle);
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  // Clear the type-to-confirm field whenever a fresh request opens.
  const activeId = current?.id ?? null;
  useEffect(() => {
    setTyped('');
  }, [activeId]);

  const requireText = current?.requireText?.trim();
  const gateUnmet = !!requireText && typed.trim() !== requireText;

  const onOpenChange = (open: boolean) => {
    if (!open) settle(false);
  };

  const tone = current?.tone ?? (current?.destructive ? 'danger' : 'default');
  const ToneIcon = tone === 'danger' ? Trash2 : tone === 'warning' ? AlertTriangle : HelpCircle;
  const toneClass =
    tone === 'danger'
      ? 'bg-destructive/10 text-destructive'
      : tone === 'warning'
        ? 'bg-warning/15 text-warning'
        : 'bg-primary/10 text-primary';

  const description =
    current?.description ??
    (current?.destructive
      ? "This can't be undone."
      : 'Do you want to continue?');

  return (
    <AlertDialog open={current !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          // With a type-to-confirm gate, land the caret in the field rather
          // than on Radix's default (the Cancel button).
          if (requireText) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${toneClass}`}
            >
              <ToneIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 gap-1.5 flex flex-col">
              <AlertDialogTitle>{current?.title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {current?.body}

        {requireText ? (
          <div className="gap-1.5 flex flex-col">
            <Label htmlFor={fieldId} className="text-xs font-normal text-muted-foreground">
              Type{' '}
              <span className="font-semibold text-foreground">{requireText}</span>{' '}
              to confirm
            </Label>
            <Input
              id={fieldId}
              ref={inputRef}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !gateUnmet) {
                  event.preventDefault();
                  settle(true);
                }
              }}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {current?.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={current?.destructive ? 'destructive' : 'primary'}
            disabled={gateUnmet}
            onClick={() => settle(true)}
          >
            {current?.confirmLabel ??
              (current?.destructive ? 'Delete' : 'Confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
