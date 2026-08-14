import type { IconSelection } from '@org/types';
import { useMemo, useState } from 'react';
import { useIconEditor, type IconEditor } from './use-icon-editor.js';

export interface LocalIconEditor extends IconEditor {
  /** The current choice, ready to send with whatever request creates the entity. */
  selection: IconSelection;
}

/**
 * An editor for an entity that does not exist yet.
 *
 * The create-workspace wizard is the case: there is nothing to `PATCH` until
 * the workspace has been created, so the choice is held here and posted with
 * the creation itself. The picker cannot tell the difference — which is the
 * point, since it means the wizard and the settings screen render the same
 * component.
 */
export function useLocalIcon(
  initial: Partial<IconSelection> = {},
): LocalIconEditor {
  const [selection, setSelection] = useState<IconSelection>({
    icon: initial.icon ?? null,
    iconColor: initial.iconColor ?? null,
  });

  const editor = useIconEditor(
    useMemo(
      () => ({
        icon: selection.icon,
        iconColor: selection.iconColor,
        save: setSelection,
      }),
      [selection.icon, selection.iconColor],
    ),
  );

  return { ...editor, selection };
}
