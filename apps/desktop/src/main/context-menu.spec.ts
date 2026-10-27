import { describe, expect, it, vi } from 'vitest';
import {
  buildContextMenuTemplate,
  type ContextMenuActions,
  type ContextMenuParams,
} from './context-menu.js';

const params = (overrides: Partial<ContextMenuParams> = {}): ContextMenuParams => ({
  linkURL: '',
  srcURL: '',
  mediaType: 'none',
  selectionText: '',
  isEditable: false,
  misspelledWord: '',
  dictionarySuggestions: [],
  x: 10,
  y: 20,
  ...overrides,
});

const actions = (): ContextMenuActions => ({
  openExternal: vi.fn(),
  copyText: vi.fn(),
  replaceMisspelling: vi.fn(),
  addToDictionary: vi.fn(),
  copyImage: vi.fn(),
  inspect: vi.fn(),
});

const labels = (template: ReturnType<typeof buildContextMenuTemplate>) =>
  template.map((item) => item.label ?? item.role ?? item.type);

describe('buildContextMenuTemplate', () => {
  it('is empty on plain content in a packaged build', () => {
    expect(buildContextMenuTemplate(params(), actions(), true)).toEqual([]);
  });

  it('offers spelling suggestions first, capped, plus add-to-dictionary', () => {
    const a = actions();
    const template = buildContextMenuTemplate(
      params({
        isEditable: true,
        misspelledWord: 'recieve',
        dictionarySuggestions: ['receive', 'relieve', 'recede', 'reserve', 'revive', 'retrieve'],
      }),
      a,
      true,
    );
    expect(labels(template).slice(0, 7)).toEqual([
      'receive',
      'relieve',
      'recede',
      'reserve',
      'revive',
      'Add to dictionary',
      'separator',
    ]);

    template[0].click?.({} as never, undefined, {} as never);
    expect(a.replaceMisspelling).toHaveBeenCalledWith('receive');
    template[5].click?.({} as never, undefined, {} as never);
    expect(a.addToDictionary).toHaveBeenCalledWith('recieve');
  });

  it('says so when the dictionary has no suggestion, instead of an empty gap', () => {
    const template = buildContextMenuTemplate(
      params({ isEditable: true, misspelledWord: 'zzxq' }),
      actions(),
      true,
    );
    expect(template[0]).toMatchObject({ label: 'No suggestions', enabled: false });
  });

  it('does not offer spelling fixes outside an editable field', () => {
    const template = buildContextMenuTemplate(params({ misspelledWord: 'recieve' }), actions(), true);
    expect(labels(template)).not.toContain('Add to dictionary');
  });

  it('offers link actions only for web links', () => {
    expect(
      labels(buildContextMenuTemplate(params({ linkURL: 'https://example.com' }), actions(), true)),
    ).toEqual(['Open link in browser', 'Copy link address']);
    expect(
      buildContextMenuTemplate(params({ linkURL: 'file:///etc/passwd' }), actions(), true),
    ).toEqual([]);
  });

  it('copies an image, and opens it externally only when it has a web address', () => {
    const blob = buildContextMenuTemplate(
      params({ mediaType: 'image', srcURL: 'blob:http://localhost:4200/abc' }),
      actions(),
      true,
    );
    expect(labels(blob)).toEqual(['Copy image']);

    const web = buildContextMenuTemplate(
      params({ mediaType: 'image', srcURL: 'https://cdn.example.com/a.png' }),
      actions(),
      true,
    );
    expect(labels(web)).toEqual(['Copy image', 'Open image in browser']);
  });

  it('keeps copy/select-all for selected text and the full edit set for fields', () => {
    expect(
      labels(buildContextMenuTemplate(params({ selectionText: 'hi' }), actions(), true)),
    ).toEqual(['copy', 'selectAll']);
    expect(labels(buildContextMenuTemplate(params({ isEditable: true }), actions(), true))).toContain(
      'paste',
    );
  });

  it('adds Inspect element only outside a packaged build', () => {
    expect(labels(buildContextMenuTemplate(params(), actions(), false))).toEqual(['Inspect element']);
  });
});
