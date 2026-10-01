import { describe, expect, it } from 'vitest';
import { docContentToText } from './doc-text.js';

describe('docContentToText', () => {
  it('turns the editor envelope into light Markdown', () => {
    const content = JSON.stringify({
      kind: 'onetab.doc',
      v: 1,
      meta: {},
      blocks: [
        { id: 'a', type: 'h2', content: 'Summary' },
        { id: 'b', type: 'paragraph', content: 'Shipped the checkout fix.' },
        { id: 'c', type: 'checklist', content: 'Book venue', checked: true },
      ],
    });
    expect(docContentToText(content)).toBe('## Summary\nShipped the checkout fix.\n- [x] Book venue');
  });

  it('leaves plain text and foreign JSON alone', () => {
    expect(docContentToText('just notes')).toBe('just notes');
    expect(docContentToText('{"a":1}')).toBe('{"a":1}');
    expect(docContentToText('{broken')).toBe('{broken');
  });
});
