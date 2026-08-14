import type { IconSelection } from '@org/types';
import { ICON_DEFAULT_COLOR } from '@org/validation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * What an entity has to offer for its icon to be editable.
 *
 * This is the whole extension point. Anything that can answer "here is my
 * current icon" and "here is how to persist a new one" becomes editable by the
 * shared picker — a workspace field, a value inside a document body, a row in a
 * list. Nothing below this line knows what a workspace is.
 */
export interface IconSource {
  icon: string | null | undefined;
  iconColor: string | null | undefined;

  /**
   * Persists the selection. Awaited when it returns a promise, so the editor
   * can hold its optimistic value until the write actually lands and put it
   * back if the write fails.
   */
  save: (selection: IconSelection) => void | Promise<unknown>;

  /**
   * Optional: hands a file to the entity's own upload route, resolving to the
   * URL to store. Without it the picker inlines the image as a `data:` URI.
   */
  upload?: (file: File) => Promise<string>;

  /** Blocks editing — the viewer lacks the role, or the entity is read-only. */
  canEdit?: boolean;

  /** A save this editor started is still in flight upstream. */
  isSaving?: boolean;
}

export interface IconEditor {
  /** What to render right now: the optimistic choice, else the stored one. */
  icon: string | undefined;
  iconColor: string | undefined;

  select: (icon: string, iconColor?: string) => void;
  /** Clears the icon; render sites fall back to their own default. */
  clear: () => void;
  /** Present only when the source can take a file. */
  uploadFile?: (file: File) => void;

  isPending: boolean;
  /** Message from the last failed save or upload, cleared by the next attempt. */
  error: string | null;
  canEdit: boolean;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'That icon could not be saved. Please try again.';
}

/**
 * The one place icon changes are applied, whatever the entity.
 *
 * It owns the parts every call site would otherwise rewrite: show the new icon
 * immediately, keep showing it until the write settles rather than letting a
 * stale refetch flicker the old one back, put the old one back and explain why
 * if the write fails, and refuse overlapping writes.
 *
 * Wrap it in a per-entity hook (see `use-workspace-icon.ts`) so screens name
 * the entity and nothing else.
 */
export function useIconEditor(source: IconSource): IconEditor {
  const [optimistic, setOptimistic] = useState<IconSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Guards against a second save starting before the first settles: the later
  // response could otherwise be the older selection.
  const inFlight = useRef(false);

  const commit = useCallback(
    async (selection: IconSelection) => {
      if (inFlight.current || source.canEdit === false) return;
      inFlight.current = true;

      setOptimistic(selection);
      setError(null);
      setIsSaving(true);

      try {
        await source.save(selection);
      } catch (cause) {
        // Dropping the optimistic value re-reveals the stored one, so the UI
        // and the server agree again the moment the failure is reported.
        setOptimistic(null);
        setError(messageOf(cause));
      } finally {
        inFlight.current = false;
        setIsSaving(false);
      }
    },
    [source],
  );

  const select = useCallback(
    (icon: string, iconColor?: string) => {
      void commit({
        icon,
        // A colour is only meaningful alongside a registry icon, but carrying
        // the last one forward keeps the swatch stable while browsing icons.
        iconColor: iconColor ?? source.iconColor ?? ICON_DEFAULT_COLOR,
      });
    },
    [commit, source.iconColor],
  );

  const clear = useCallback(() => {
    void commit({ icon: null, iconColor: null });
  }, [commit]);

  const upload = source.upload;
  const uploadFile = useCallback(
    (file: File) => {
      if (!upload || inFlight.current || source.canEdit === false) return;
      inFlight.current = true;

      setError(null);
      setIsSaving(true);

      void (async () => {
        try {
          const url = await upload(file);
          setOptimistic({ icon: url, iconColor: null });
          await source.save({ icon: url, iconColor: null });
        } catch (cause) {
          setOptimistic(null);
          setError(messageOf(cause));
        } finally {
          inFlight.current = false;
          setIsSaving(false);
        }
      })();
    },
    [source, upload],
  );

  /*
   * The optimistic selection outranks the source until the source catches up.
   *
   * Releasing it only once they agree is what keeps a refetch that lands
   * mid-save from flickering the previous icon back; releasing it at all is
   * what lets a later change from elsewhere — another tab, another screen —
   * still show through.
   */
  useEffect(() => {
    if (optimistic === null || isSaving) return;
    if ((optimistic.icon ?? null) === (source.icon ?? null))
      setOptimistic(null);
  }, [isSaving, optimistic, source.icon]);

  const shown = optimistic ?? {
    icon: source.icon,
    iconColor: source.iconColor,
  };

  return {
    icon: shown.icon ?? undefined,
    iconColor: shown.iconColor ?? undefined,
    select,
    clear,
    uploadFile: upload ? uploadFile : undefined,
    isPending: isSaving || source.isSaving === true,
    error,
    canEdit: source.canEdit !== false,
  };
}
