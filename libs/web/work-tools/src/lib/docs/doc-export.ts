import type { DocItem, NotionBlock } from './doc-types.js';

/** One block as Markdown. Numbered lists restart per run via `index`. */
function blockToMarkdown(block: NotionBlock, index: number): string {
  const text = block.content ?? '';
  switch (block.type) {
    case 'h1':
      return `# ${text}`;
    case 'h2':
      return `## ${text}`;
    case 'h3':
      return `### ${text}`;
    case 'bullet_list':
      return `- ${text}`;
    case 'numbered_list':
      return `${index}. ${text}`;
    case 'checklist':
      return `- [${block.checked ? 'x' : ' '}] ${text}`;
    case 'toggle':
      return `<details><summary>${text}</summary></details>`;
    case 'quote':
      return text
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'callout':
      return `> ${block.icon ? `${block.icon} ` : ''}${text}`;
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${text}\n\`\`\``;
    case 'divider':
      return '---';
    case 'table': {
      const headers = block.headers ?? [];
      const rows = block.rows ?? [];
      if (headers.length === 0) return '';
      const cell = (value: string) => value.replace(/\|/g, '\\|');
      return [
        `| ${headers.map(cell).join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
      ].join('\n');
    }
    case 'ai_prompt':
      // The prompt is scaffolding for the editor, not document content.
      return text;
    default:
      return text;
  }
}

/** A document as portable Markdown — title first, then its blocks in order. */
export function docToMarkdown(doc: Pick<DocItem, 'title' | 'blocks'>): string {
  const parts: string[] = [`# ${doc.title}`];
  let listIndex = 0;
  for (const block of doc.blocks) {
    listIndex = block.type === 'numbered_list' ? listIndex + 1 : 0;
    const md = blockToMarkdown(block, listIndex);
    if (md) parts.push(md);
  }
  return `${parts.join('\n\n')}\n`;
}

/** Saves a document as `<title>.md` in the browser. */
export function downloadDocAsMarkdown(doc: Pick<DocItem, 'title' | 'blocks'>): void {
  const blob = new Blob([docToMarkdown(doc)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${doc.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document'}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
