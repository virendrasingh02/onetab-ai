import type { Workspace, WorkspaceSummary } from '@org/types';
import { IconPickerPopover, type IconPickerPopoverProps } from '@org/ui';
import type { ReactNode } from 'react';
import type { IconEditor } from './use-icon-editor.js';
import { useWorkspaceIcon } from './use-workspace-icon.js';

export interface IconPickerProps extends Pick<
  IconPickerPopoverProps,
  'trigger' | 'align' | 'allowUpload'
> {
  editor: IconEditor;
  /**
   * Hides the "Remove" action. Off by default — most icons are optional, and
   * the ones that are not say so here.
   */
  required?: boolean;
  /** Rendered under the trigger when a save fails. On by default. */
  showError?: boolean;
}

/**
 * The picker, bound to an editor.
 *
 * Every icon-change site in the app renders this one component, so a change to
 * how saving looks or feels is made once. The picker itself stays in `@org/ui`
 * and stays unaware of the API; this is the seam where the two meet.
 */
export function IconPicker({
  editor,
  required = false,
  showError = true,
  trigger,
  align,
  allowUpload,
}: IconPickerProps): ReactNode {
  return (
    <div className="gap-1 inline-flex flex-col">
      <IconPickerPopover
        icon={editor.icon}
        iconColor={editor.iconColor}
        onSelectIcon={editor.select}
        onRemoveIcon={required ? undefined : editor.clear}
        onUploadFile={editor.uploadFile}
        allowUpload={allowUpload}
        uploadError={editor.error}
        isPending={editor.isPending}
        disabled={!editor.canEdit}
        trigger={trigger}
        align={align}
      />
      {showError && editor.error ? (
        <p role="alert" className="max-w-56 text-[11px] text-destructive">
          {editor.error}
        </p>
      ) : null}
    </div>
  );
}

export interface WorkspaceIconPickerProps extends Omit<
  IconPickerProps,
  'editor'
> {
  workspace: Workspace | WorkspaceSummary | undefined;
}

/**
 * The workspace icon, editable, from anywhere.
 *
 * A component rather than a hook call plus a picker, because that pairing is
 * the whole of what most screens want — the switcher, the settings page and
 * the create wizard's preview all render exactly this.
 */
export function WorkspaceIconPicker({
  workspace,
  // Images for a workspace go through the logo control, which has storage and
  // cache-busting behind it — see `use-workspace-icon.ts`.
  allowUpload = false,
  ...props
}: WorkspaceIconPickerProps): ReactNode {
  const editor = useWorkspaceIcon(workspace);
  return <IconPicker editor={editor} allowUpload={allowUpload} {...props} />;
}
