import { describe, expect, it } from 'vitest';
import { docContentToText, markdownToBlocks, markdownToDocContent, stripInlineMarkdown } from './doc-markdown.js';

const shape = (md: string) => markdownToBlocks(md).map(({ id: _id, ...rest }) => rest);

describe('markdownToBlocks', () => {
  it('turns a report into editor blocks', () => {
    expect(
      shape(
        [
          '# Daily report',
          '',
          '## Completed',
          '- **RCS-8** Update shipping rates copy',
          '- [x] Ship it',
          '1. First',
          '2. Second',
          '',
          'Work on the `payment` webhook',
          'continues tomorrow.',
          '---',
          '> Blocked by RCS-4',
        ].join('\n'),
      ),
    ).toEqual([
      { type: 'h1', content: 'Daily report' },
      { type: 'h2', content: 'Completed' },
      { type: 'bullet_list', content: 'RCS-8 Update shipping rates copy' },
      { type: 'checklist', content: 'Ship it', checked: true },
      { type: 'numbered_list', content: 'First' },
      { type: 'numbered_list', content: 'Second' },
      { type: 'paragraph', content: 'Work on the payment webhook continues tomorrow.' },
      { type: 'divider', content: '' },
      { type: 'quote', content: 'Blocked by RCS-4' },
    ]);
  });

  it('reads a line that is only bold as a section title', () => {
    expect(shape('**Summary**\nShipped RCS-8.\n**Blocked:**\n- RCS-7\n**RCS-4** is overdue')).toEqual([
      { type: 'h2', content: 'Summary' },
      { type: 'paragraph', content: 'Shipped RCS-8.' },
      { type: 'h2', content: 'Blocked' },
      { type: 'bullet_list', content: 'RCS-7' },
      { type: 'paragraph', content: 'RCS-4 is overdue' },
    ]);
  });

  it('keeps tables and code blocks', () => {
    expect(shape('| Task | Status |\n|---|---|\n| RCS-4 | todo |\n\n```ts\nconst a = 1;\n```')).toEqual([
      { type: 'table', content: '', headers: ['Task', 'Status'], rows: [['RCS-4', 'todo']] },
      { type: 'code', content: 'const a = 1;', language: 'ts' },
    ]);
  });

  it('strips inline marks but keeps link targets', () => {
    expect(stripInlineMarkdown('See [the doc](https://x.test/d) and _this_ ~~not~~ **now**')).toBe('See the doc (https://x.test/d) and this not now');
    expect(stripInlineMarkdown('snake_case_name stays')).toBe('snake_case_name stays');
  });
});

describe('docContentToText', () => {
  it('reads the editor envelope back as text', () => {
    const stored = markdownToDocContent('# Title\n\n- one\n- [ ] two\n\n1. a\n2. b');
    expect(docContentToText(stored)).toBe('# Title\n- one\n- [ ] two\n1. a\n2. b');
  });

  it('leaves plain text alone', () => {
    expect(docContentToText('Just notes {not json}')).toBe('Just notes {not json}');
    expect(docContentToText('{"other":"json"}')).toBe('{"other":"json"}');
  });
});
