import { randomUUID } from 'node:crypto';

/**
 * Agents write Markdown; the Docs editor stores a JSON envelope of blocks in
 * `WorkDocument.content` (`libs/web/work-tools/src/lib/docs/doc-content.ts`).
 * A Markdown string saved as-is opens as one paragraph with the `#`s and `**`s
 * showing, so a doc an agent creates is converted to blocks here, and a doc an
 * agent reads is turned back into plain text.
 */

const ENVELOPE_KIND = 'onetab.doc';
const ENVELOPE_VERSION = 1;

type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet_list' | 'numbered_list' | 'checklist' | 'code' | 'quote' | 'divider' | 'table';

export interface DocBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  language?: string;
  headers?: string[];
  rows?: string[][];
}

const blockId = () => `b_${randomUUID().slice(0, 8)}`;

/** Editor blocks are plain text: drop emphasis and code marks, keep link targets. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => (label === url ? url : `${label} (${url})`))
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^_\w])_(?!\s)([^_]+?)_(?!\w)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => stripInlineMarkdown(c.trim()));

export function markdownToBlocks(markdown: string): DocBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: DocBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const text = stripInlineMarkdown(paragraph.join(' '));
    if (text) blocks.push({ id: blockId(), type: 'paragraph', content: text });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    const fence = /^(```|~~~)\s*([\w+-]*)/.exec(trimmed);
    if (fence) {
      flush();
      const body: string[] = [];
      while (++i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) body.push(lines[i]!);
      blocks.push({ id: blockId(), type: 'code', content: body.join('\n'), ...(fence[2] ? { language: fence[2] } : {}) });
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flush();
      blocks.push({ id: blockId(), type: 'divider', content: '' });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const level = Math.min(heading[1]!.length, 3);
      blocks.push({ id: blockId(), type: `h${level}` as BlockType, content: stripInlineMarkdown(heading[2]!.replace(/\s+#+\s*$/, '')) });
      continue;
    }
    // Models often write section titles as a line that is only bold ("**Summary**").
    const boldTitle = /^(\*\*|__)(?!\s)([^*_]+?)\1:?$/.exec(trimmed);
    if (boldTitle) {
      flush();
      blocks.push({ id: blockId(), type: 'h2', content: boldTitle[2]!.trim().replace(/:$/, '') });
      continue;
    }
    // A table: a header row, then a |---|---| separator.
    if (trimmed.startsWith('|') && /^\|?\s*:?-{2,}/.test(lines[i + 1]?.trim() ?? '')) {
      flush();
      const headers = tableCells(trimmed);
      const rows: string[][] = [];
      i += 1;
      while (i + 1 < lines.length && lines[i + 1]!.trim().startsWith('|')) rows.push(tableCells(lines[++i]!));
      blocks.push({ id: blockId(), type: 'table', content: '', headers, rows });
      continue;
    }
    const check = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);
    if (check) {
      flush();
      blocks.push({ id: blockId(), type: 'checklist', content: stripInlineMarkdown(check[2]!), checked: check[1] !== ' ' });
      continue;
    }
    const bullet = /^[-*+•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flush();
      blocks.push({ id: blockId(), type: 'bullet_list', content: stripInlineMarkdown(bullet[1]!) });
      continue;
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flush();
      blocks.push({ id: blockId(), type: 'numbered_list', content: stripInlineMarkdown(numbered[1]!) });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flush();
      blocks.push({ id: blockId(), type: 'quote', content: stripInlineMarkdown(quote[1]!) });
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

/** Markdown as the Docs editor's stored content. */
export function markdownToDocContent(markdown: string): string {
  return JSON.stringify({ kind: ENVELOPE_KIND, v: ENVELOPE_VERSION, meta: {}, blocks: markdownToBlocks(markdown), comments: [] });
}

/** Lives in @org/utils, so search snippets and agents read a doc the same way. */
export { docContentToText } from '@org/utils';
