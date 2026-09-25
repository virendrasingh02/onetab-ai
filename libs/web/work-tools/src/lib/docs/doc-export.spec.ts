import { describe, expect, it } from 'vitest';
import { docToMarkdown } from './doc-export.js';
import type { NotionBlock } from './doc-types.js';

const block = (type: NotionBlock['type'], content: string, extra: Partial<NotionBlock> = {}): NotionBlock => ({
  id: `${type}-${content}`,
  type,
  content,
  ...extra,
});

describe('docToMarkdown', () => {
  it('serialises headings, lists, checklists and code', () => {
    const md = docToMarkdown({
      title: 'Spec',
      blocks: [
        block('h2', 'Goals'),
        block('numbered_list', 'One'),
        block('numbered_list', 'Two'),
        block('paragraph', 'Break'),
        block('numbered_list', 'Restart'),
        block('checklist', 'Done', { checked: true }),
        block('checklist', 'Todo'),
        block('code', 'let a = 1;', { language: 'ts' }),
        block('divider', ''),
      ],
    });
    expect(md).toBe(
      [
        '# Spec',
        '## Goals',
        '1. One',
        '2. Two',
        'Break',
        '1. Restart',
        '- [x] Done',
        '- [ ] Todo',
        '```ts\nlet a = 1;\n```',
        '---',
      ].join('\n\n') + '\n',
    );
  });

  it('renders tables and escapes pipes', () => {
    const md = docToMarkdown({
      title: 'T',
      blocks: [block('table', '', { headers: ['A', 'B|C'], rows: [['1', '2']] })],
    });
    expect(md).toContain('| A | B\\|C |\n| --- | --- |\n| 1 | 2 |');
  });
});
