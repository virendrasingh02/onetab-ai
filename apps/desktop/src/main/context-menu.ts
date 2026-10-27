import type { MenuItemConstructorOptions } from 'electron';

/** The slice of Electron's `context-menu` params the menu looks at. */
export interface ContextMenuParams {
  linkURL: string;
  srcURL: string;
  mediaType: string;
  selectionText: string;
  isEditable: boolean;
  misspelledWord: string;
  dictionarySuggestions: string[];
  x: number;
  y: number;
}

export interface ContextMenuActions {
  openExternal: (url: string) => void;
  copyText: (text: string) => void;
  replaceMisspelling: (suggestion: string) => void;
  addToDictionary: (word: string) => void;
  copyImage: (x: number, y: number) => void;
  inspect: (x: number, y: number) => void;
}

const MAX_SUGGESTIONS = 5;
const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

/**
 * What a right-click offers. Spellcheck is switched on for the window, so the
 * red underline has to be actionable — without suggestions here it is a
 * decoration the user cannot do anything with.
 */
export function buildContextMenuTemplate(
  params: ContextMenuParams,
  actions: ContextMenuActions,
  isPackaged: boolean,
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];
  const section = (items: MenuItemConstructorOptions[]) => {
    if (items.length === 0) return;
    if (template.length > 0) template.push({ type: 'separator' });
    template.push(...items);
  };

  if (params.isEditable && params.misspelledWord) {
    const word = params.misspelledWord;
    const suggestions = params.dictionarySuggestions.slice(0, MAX_SUGGESTIONS);
    section([
      ...(suggestions.length > 0
        ? suggestions.map<MenuItemConstructorOptions>((suggestion) => ({
            label: suggestion,
            click: () => actions.replaceMisspelling(suggestion),
          }))
        : [{ label: 'No suggestions', enabled: false }]),
      { label: 'Add to dictionary', click: () => actions.addToDictionary(word) },
    ]);
  }

  if (params.linkURL && isWebUrl(params.linkURL)) {
    section([
      { label: 'Open link in browser', click: () => actions.openExternal(params.linkURL) },
      { label: 'Copy link address', click: () => actions.copyText(params.linkURL) },
    ]);
  }

  if (params.mediaType === 'image') {
    section([
      { label: 'Copy image', click: () => actions.copyImage(params.x, params.y) },
      ...(isWebUrl(params.srcURL)
        ? [
            {
              label: 'Open image in browser',
              click: () => actions.openExternal(params.srcURL),
            } satisfies MenuItemConstructorOptions,
          ]
        : []),
    ]);
  }

  if (params.isEditable) {
    section([
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ]);
  } else if (params.selectionText.trim().length > 0) {
    section([{ role: 'copy' }, { role: 'selectAll' }]);
  }

  if (!isPackaged) {
    section([{ label: 'Inspect element', click: () => actions.inspect(params.x, params.y) }]);
  }

  return template;
}
