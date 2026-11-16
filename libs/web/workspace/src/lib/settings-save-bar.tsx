import { Button, toast } from '@org/ui';
import { useEffect, useRef, useState } from 'react';
import {
  discardDirtySettings,
  saveDirtySettings,
  useSettingsDirtyCount,
} from './settings-dirty.store.js';

/**
 * The single save surface for every settings section. Forms register their
 * dirty state, save and reset through `useRegisterSettingsDirty`; this bar
 * appears only while something is unsaved and commits (or discards) all of it
 * at once. Ctrl/Cmd+S saves from anywhere on the page.
 */
export function SettingsSaveBar() {
  const dirtyCount = useSettingsDirtyCount();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const visible = dirtyCount > 0 || saving;

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { failed, remaining } = await saveDirtySettings();
      if (remaining > 0 && !failed) {
        toast.error('Some changes need attention — check the highlighted fields.');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (dirtyCount === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirtyCount]);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky -bottom-6 md:-bottom-10 z-20 -mx-6 -mb-6 md:-mx-10 md:-mb-10 mt-auto px-6 md:px-10 py-3 border-t border-border bg-background shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.08)] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full bg-warning shrink-0" aria-hidden />
          <p className="text-sm font-medium text-foreground truncate" aria-live="polite">
            {saving ? 'Saving changes…' : 'You have unsaved changes'}
          </p>
          <kbd className="hidden md:inline text-2xs text-muted-foreground font-mono border border-border rounded px-1.5 py-0.5">
            Ctrl S
          </kbd>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={discardDirtySettings}
            disabled={saving}
          >
            Discard
          </Button>
          <Button type="button" size="sm" loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
