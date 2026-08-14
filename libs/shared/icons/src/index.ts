/**
 * Icon selection, end to end.
 *
 * The picker's markup lives in `@org/ui` and knows nothing about the API; the
 * endpoints live in `@org/api-client` and know nothing about React. This
 * library is where they meet, and it is the only place they do — so a screen
 * that wants an editable icon renders one component and a new entity that
 * wants one implements a single `IconSource`.
 */

export {
  IconPicker,
  ProjectIconPicker,
  WorkspaceIconPicker,
  type IconPickerProps,
  type ProjectIconPickerProps,
  type WorkspaceIconPickerProps,
} from './lib/icon-picker.js';

export {
  useIconEditor,
  type IconEditor,
  type IconSource,
} from './lib/use-icon-editor.js';

export { useLocalIcon, type LocalIconEditor } from './lib/use-local-icon.js';

export { useProjectIcon } from './lib/use-project-icon.js';

export { useWorkspaceIcon } from './lib/use-workspace-icon.js';

/**
 * Re-exported so a consumer needs one import to both edit an icon and draw one.
 * Rendering stays available from `@org/ui` for anything that only draws.
 */
export {
  ICON_COLOR_PRESETS,
  ICON_REGISTRY,
  IconRenderer,
  type IconRendererProps,
} from '@org/ui';
