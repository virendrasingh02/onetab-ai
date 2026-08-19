import { cn } from '@org/utils';
import { CheckSquare, Square } from 'lucide-react';
import { Fragment, useMemo, type ReactNode } from 'react';

/**
 * Renders the markdown a message body carries.
 *
 * This is the read side of the composer: the editor serialises a rich document
 * to markdown on send, and this turns that markdown back into the same shapes.
 * The two have to agree, so anything the composer can produce — headings,
 * lists, task lists, quotes, code blocks, links, dividers, tables — is handled
 * here.
 *
 * Nothing is ever injected as HTML. Every piece of the message ends up as a
 * React text node or an element this file constructed, so a message body can
 * never introduce markup of its own.
 */

/** Links only survive as links if they go somewhere safe. */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^www\./i.test(url)) return `https://${url}`;
  return null;
}

const INLINE_PATTERN_SOURCE = [
    '(?<code>`[^`\\n]+`)',
    '(?<image>!\\[[^\\]]*\\]\\([^\\s)]+\\))',
    '(?<link>\\[[^\\]]*\\]\\([^\\s)]+\\))',
    '(?<bolditalic>\\*\\*\\*[^*\\n]+\\*\\*\\*)',
    '(?<bold>\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__)',
    '(?<italic>\\*[^*\\n]+\\*|_[^_\\n]+_)',
    '(?<strike>~~[^~\\n]+~~)',
    '(?<highlight>==[^=\\n]+==)',
    '(?<url>(?:https?://|www\\.)[^\\s<>()]+)',
    '(?<mention>@[A-Za-z0-9][A-Za-z0-9._-]*)',
    '(?<hashtag>#[A-Za-z][A-Za-z0-9_-]*)',
].join('|');

const GROUP_MENTIONS = new Set(['@here', '@channel', '@everyone']);

/** `snake_case` and `a*b` are not emphasis; real emphasis stands on a boundary. */
function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9]/.test(character);
}

/**
 * Display names of people who can be mentioned, longest first.
 *
 * Mentions are sent as plain `@Display Name`, and display names contain
 * spaces — so without knowing the roster, `@Ashish Shrivastav` would highlight
 * only the first word. Matching known names first, longest before shortest,
 * keeps the whole name inside one chip while unknown `@handles` still fall
 * back to the single-word form.
 */
type InlineOptions = { mentionNames: string[] };

const NO_MENTIONS: InlineOptions = { mentionNames: [] };

function renderInline(
  text: string,
  keyPrefix: string,
  options: InlineOptions = NO_MENTIONS,
  depth = 0,
): ReactNode[] {
  if (!text) return [];
  if (depth > 4) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // A fresh matcher per call: emphasis recurses into its own contents, and a
  // shared /g/ regex would have its scan position reset by the inner pass.
  const pattern = new RegExp(INLINE_PATTERN_SOURCE, 'g');

  while ((match = pattern.exec(text)) !== null) {
    const groups = match.groups ?? {};
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    // Emphasis marked with underscores only counts between word boundaries,
    // so identifiers like `user_id_field` stay intact.
    if (
      (groups['italic'] || groups['bold']) &&
      token.startsWith('_') &&
      (isWordCharacter(text[match.index - 1]) ||
        isWordCharacter(text[match.index + token.length]))
    ) {
      continue;
    }

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    lastIndex = match.index + token.length;

    if (groups['code']) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs text-info-text"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (groups['image']) {
      const parsed = /^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(token);
      const source = parsed ? safeUrl(parsed[2]) : null;
      nodes.push(
        source ? (
          <img
            key={key}
            src={source}
            alt={parsed?.[1] || 'Attached image'}
            loading="lazy"
            className="my-1 block max-h-72 max-w-full rounded-lg border border-border"
          />
        ) : (
          <Fragment key={key}>{token}</Fragment>
        ),
      );
    } else if (groups['link']) {
      const parsed = /^\[([^\]]*)\]\(([^\s)]+)\)$/.exec(token);
      const href = parsed ? safeUrl(parsed[2]) : null;
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-text underline underline-offset-2 hover:text-primary"
          >
            {parsed?.[1] || href}
          </a>
        ) : (
          <Fragment key={key}>{token}</Fragment>
        ),
      );
    } else if (groups['bolditalic']) {
      nodes.push(
        <strong key={key} className="font-bold italic text-foreground">
          {renderInline(token.slice(3, -3), key, options, depth + 1)}
        </strong>,
      );
    } else if (groups['bold']) {
      nodes.push(
        <strong key={key} className="font-bold text-foreground">
          {renderInline(token.slice(2, -2), key, options, depth + 1)}
        </strong>,
      );
    } else if (groups['italic']) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), key, options, depth + 1)}
        </em>,
      );
    } else if (groups['strike']) {
      nodes.push(
        <span key={key} className="text-muted-foreground line-through">
          {renderInline(token.slice(2, -2), key, options, depth + 1)}
        </span>,
      );
    } else if (groups['highlight']) {
      nodes.push(
        <mark key={key} className="rounded bg-warning/25 px-0.5 text-foreground">
          {renderInline(token.slice(2, -2), key, options, depth + 1)}
        </mark>,
      );
    } else if (groups['url']) {
      const href = safeUrl(token);
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="break-all text-primary-text underline underline-offset-2 hover:text-primary"
          >
            {token}
          </a>
        ) : (
          <Fragment key={key}>{token}</Fragment>
        ),
      );
    } else if (groups['mention']) {
      // Prefer a known display name over the word-shaped fallback, so a
      // mention that spans a space stays a single chip.
      const rest = text.slice(match.index + 1);
      const known = options.mentionNames.find((name) =>
        rest.toLowerCase().startsWith(name.toLowerCase()),
      );
      const mention = known ? `@${rest.slice(0, known.length)}` : token;
      if (known) {
        lastIndex = match.index + mention.length;
        pattern.lastIndex = lastIndex;
      }

      const isGroupMention = GROUP_MENTIONS.has(mention.toLowerCase());
      nodes.push(
        <span
          key={key}
          data-mention={mention.slice(1)}
          className={cn(
            'inline-flex items-center rounded px-1 font-semibold',
            isGroupMention
              ? 'border border-warning/40 bg-warning/20 text-foreground'
              : 'border border-primary/40 bg-primary/20 text-primary-text',
          )}
        >
          {mention}
        </span>,
      );
    } else if (groups['hashtag']) {
      nodes.push(
        <span key={key} className="rounded bg-info/15 px-1 font-semibold text-info-text">
          {token}
        </span>,
      );
    }
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-2 mb-1 text-lg font-bold leading-tight text-foreground',
  2: 'mt-2 mb-1 text-base font-bold leading-tight text-foreground',
  3: 'mt-1.5 mb-1 text-sm font-bold leading-tight text-foreground',
  4: 'mt-1.5 mb-1 text-sm font-semibold text-foreground',
  5: 'mt-1 mb-0.5 text-xs font-semibold text-foreground',
  6: 'mt-1 mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
};

const TASK_PATTERN = /^(?:[-*+]\s+)?\[([ xX])\]\s+(.*)$/;
const BULLET_PATTERN = /^[-*+•]\s+(.*)$/;
const ORDERED_PATTERN = /^(\d+)[.)]\s+(.*)$/;
const QUOTE_PATTERN = /^>\s?(.*)$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const RULE_PATTERN = /^(?:---+|\*\*\*+|___+)$/;
const TABLE_ROW_PATTERN = /^\|(.+)\|$/;
const TABLE_DIVIDER_PATTERN = /^\|(?:\s*:?-+:?\s*\|)+$/;

function splitTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Turns markdown into elements, one block at a time.
 *
 * The parser is line-oriented rather than a full CommonMark implementation:
 * chat messages are short, and every construct the composer can emit is a
 * line-level one. Anything it does not recognise falls through as a paragraph,
 * which is what makes unknown markdown degrade to readable text.
 */
function renderBlocks(markdown: string, options: InlineOptions): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    // Fenced code block — taken first, so nothing inside it is interpreted.
    const fence = /^```(\w+)?\s*$/.exec(trimmed);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence
      blocks.push(
        <pre
          key={`code-${index}`}
          className="my-1.5 overflow-x-auto rounded-lg border border-border bg-surface-inset p-2.5"
        >
          <code className="font-mono text-xs text-success-text">
            {body.join('\n')}
          </code>
        </pre>,
      );
      continue;
    }

    if (RULE_PATTERN.test(trimmed)) {
      blocks.push(<hr key={`hr-${index}`} className="my-2 border-border" />);
      index += 1;
      continue;
    }

    const heading = HEADING_PATTERN.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as 'h1';
      blocks.push(
        <Tag key={`h-${index}`} className={HEADING_CLASS[level]}>
          {renderInline(heading[2], `h-${index}`, options)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    // Table: a header row, a delimiter row, then body rows.
    if (
      TABLE_ROW_PATTERN.test(trimmed) &&
      index + 1 < lines.length &&
      TABLE_DIVIDER_PATTERN.test(lines[index + 1].trim())
    ) {
      const header = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW_PATTERN.test(lines[index].trim())) {
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-1.5 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th
                    key={cellIndex}
                    className="border border-border bg-surface-inset px-2 py-1 text-left font-semibold text-foreground"
                  >
                    {renderInline(cell, `th-${index}-${cellIndex}`, options)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border border-border px-2 py-1 align-top"
                    >
                      {renderInline(cell, `td-${index}-${rowIndex}-${cellIndex}`, options)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Task list — checked before bullets, which would otherwise claim `- [ ]`.
    if (TASK_PATTERN.test(trimmed)) {
      const items: { checked: boolean; text: string }[] = [];
      while (index < lines.length) {
        const task = TASK_PATTERN.exec(lines[index].trim());
        if (!task) break;
        items.push({ checked: task[1].toLowerCase() === 'x', text: task[2] });
        index += 1;
      }
      blocks.push(
        <ul key={`tasks-${index}`} className="my-1 space-y-0.5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex items-start gap-2">
              {item.checked ? (
                <CheckSquare className="mt-0.5 size-3.5 shrink-0 text-success-text" />
              ) : (
                <Square className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span
                className={cn(item.checked && 'text-muted-foreground line-through')}
              >
                {renderInline(item.text, `task-${index}-${itemIndex}`, options)}
              </span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (BULLET_PATTERN.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const bullet = BULLET_PATTERN.exec(lines[index].trim());
        if (!bullet || TASK_PATTERN.test(lines[index].trim())) break;
        items.push(bullet[1]);
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ul-${index}-${itemIndex}`, options)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (ORDERED_PATTERN.test(trimmed)) {
      const start = Number(ORDERED_PATTERN.exec(trimmed)?.[1] ?? 1);
      const items: string[] = [];
      while (index < lines.length) {
        const ordered = ORDERED_PATTERN.exec(lines[index].trim());
        if (!ordered) break;
        items.push(ordered[2]);
        index += 1;
      }
      blocks.push(
        <ol
          key={`ol-${index}`}
          start={start}
          className="my-1 list-decimal space-y-0.5 pl-5"
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ol-${index}-${itemIndex}`, options)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (QUOTE_PATTERN.test(trimmed)) {
      const quoted: string[] = [];
      while (index < lines.length) {
        const quote = QUOTE_PATTERN.exec(lines[index].trim());
        if (!quote) break;
        quoted.push(quote[1]);
        index += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className="my-1 rounded-r border-l-4 border-primary bg-surface-inset/60 py-1 pl-3 italic"
        >
          {quoted.map((quotedLine, lineIndex) => (
            <p key={lineIndex}>{renderInline(quotedLine, `q-${index}-${lineIndex}`, options)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Paragraph: consecutive plain lines, with their line breaks kept.
    const paragraph: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (
        !candidate ||
        RULE_PATTERN.test(candidate) ||
        HEADING_PATTERN.test(candidate) ||
        BULLET_PATTERN.test(candidate) ||
        ORDERED_PATTERN.test(candidate) ||
        QUOTE_PATTERN.test(candidate) ||
        TASK_PATTERN.test(candidate) ||
        /^```/.test(candidate)
      ) {
        break;
      }
      paragraph.push(candidate);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`} className="whitespace-pre-wrap break-words">
        {paragraph.map((paragraphLine, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 ? <br /> : null}
            {renderInline(paragraphLine, `p-${index}-${lineIndex}`, options)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return blocks;
}

export interface MarkdownMessageProps {
  text: string;
  /**
   * Display names that should render as mention chips even when they contain
   * spaces. Usually the conversation's roster.
   */
  mentionNames?: string[];
  className?: string;
}

export function MarkdownMessage({
  text,
  mentionNames,
  className,
}: MarkdownMessageProps) {
  const options = useMemo<InlineOptions>(
    () => ({
      // Longest first, so "@Ana Ruiz" wins over a colleague simply called "Ana".
      mentionNames: [...(mentionNames ?? [])].sort((a, b) => b.length - a.length),
    }),
    [mentionNames],
  );

  return (
    <div
      className={cn(
        'space-y-1 text-sm leading-relaxed text-foreground break-words',
        className,
      )}
    >
      {renderBlocks(text, options)}
    </div>
  );
}
