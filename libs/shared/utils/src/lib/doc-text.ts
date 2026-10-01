/**
 * The Docs editor stores `WorkDocument.content` as a JSON envelope of blocks
 * (`libs/web/work-tools/src/lib/docs/doc-content.ts`). Anything that shows or
 * reasons over a doc's text — search snippets, agents reading a doc — needs it
 * as text, not as the JSON.
 */

const ENVELOPE_KIND = 'onetab.doc';

interface DocTextBlock {
  type: string;
  content: string;
  checked?: boolean;
  headers?: string[];
  rows?: string[][];
}

/**
 * A doc's stored content as readable text: the editor's envelope back into
 * light Markdown, anything else (a plain-text doc) unchanged.
 */
export function docContentToText(content: string): string {
  if (!content.trimStart().startsWith('{')) return content;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  const env = parsed as { kind?: unknown; blocks?: unknown };
  if (env.kind !== ENVELOPE_KIND || !Array.isArray(env.blocks)) return content;
  let n = 0;
  return (env.blocks as Partial<DocTextBlock>[])
    .map((b) => {
      const text = String(b.content ?? '');
      if (b.type !== 'numbered_list') n = 0;
      switch (b.type) {
        case 'h1':
          return `# ${text}`;
        case 'h2':
          return `## ${text}`;
        case 'h3':
          return `### ${text}`;
        case 'bullet_list':
          return `- ${text}`;
        case 'numbered_list':
          return `${++n}. ${text}`;
        case 'checklist':
          return `- [${b.checked ? 'x' : ' '}] ${text}`;
        case 'quote':
          return `> ${text}`;
        case 'code':
          return `\`\`\`\n${text}\n\`\`\``;
        case 'divider':
          return '---';
        case 'table': {
          const headers = b.headers ?? [];
          const rows = (b.rows ?? []).map((r) => `| ${r.join(' | ')} |`);
          return headers.length
            ? [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows].join('\n')
            : rows.join('\n');
        }
        default:
          return text;
      }
    })
    .filter((line) => line.trim())
    .join('\n');
}
