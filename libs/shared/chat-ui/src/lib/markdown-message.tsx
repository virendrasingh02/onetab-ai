import { useAuthenticatedMediaSrc } from '@org/hooks';
import { CodeBlock, useRightPanelStore, type RightPanelProfile } from '@org/ui';
import { toPlatformUserId } from '@org/types';
import { cn } from '@org/utils';
import { CheckSquare, ChevronDown, ChevronUp, ChevronsUpDown, Link2, Square } from 'lucide-react';
import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';

import { compactBlankLineCount } from './blank-lines.js';
import { useMentionAliases } from './mention-aliases.js';

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
  if (/^meet\.google\.com\//i.test(url)) return `https://${url}`;
  return null;
}

/** A markdown image can reference Matrix's authenticated media (e.g. a link
 * an app/agent posted); resolve it the same way `AvatarImage` does. Its own
 * component because the node list below is built imperatively, not mapped —
 * there's nowhere else to call the hook from. */
function MarkdownImage({ src, alt }: { src: string; alt: string }) {
  const resolvedSrc = useAuthenticatedMediaSrc(src);
  return (
    <img
      src={resolvedSrc ?? undefined}
      alt={alt}
      loading="lazy"
      className="my-1 block max-h-72 max-w-full rounded-lg border border-border"
    />
  );
}

const INLINE_PATTERN_SOURCE = [
    // A backslash-escaped punctuation mark is that mark, literally. Text pasted
    // from other markdown tools arrives like `ERR\_CONNECTION\_REFUSED`.
    '(?<escape>\\\\[\\\\`*_{}\\[\\]()#+\\-.!|~=<>@])',
    '(?<code>`[^`\\n]+`)',
    '(?<image>!\\[[^\\]]*\\]\\([^\\s)]+\\))',
    // The target may be empty (`[label]()`) — pastes carry those too.
    '(?<link>\\[[^\\]]*\\]\\([^\\s)]*\\))',
    '(?<bolditalic>\\*\\*\\*[^*\\n]+\\*\\*\\*)',
    '(?<bold>\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__)',
    '(?<italic>\\*[^*\\n]+\\*|_[^_\\n]+_)',
    '(?<strike>~~[^~\\n]+~~)',
    '(?<highlight>==[^=\\n]+==)',
    '(?<url>(?:https?://|www\\.|meet\\.google\\.com/)[^\\s<>()]+)',
    '(?<mention>@[A-Za-z0-9][A-Za-z0-9._-]*)',
    '(?<hashtag>#[A-Za-z][A-Za-z0-9_-]*)',
].join('|');

const GROUP_MENTIONS = new Set(['@here', '@channel', '@everyone']);

const DEFAULT_FALLBACK_MENTIONS = [
  'here',
  'channel',
  'everyone',
  'Scheduler',
  'Tracker',
  'scheduler',
  'tracker',
  'Code Reviewer & Security Sentinel',
  'Onetab Copilot',
  'copilot',
  'codereview',
  'triage',
  'standup',
  'docs',
  'data',
  'github-app',
  'linear-bot',
  'sentry-bot',
];

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
type InlineOptions = {
  mentionNames: string[];
  onMentionClick?: (mention: string) => void;
  /**
   * Maps a typed `@handle` to the person's current display name (no `@`), so a
   * chip written as `@Virendra` renders as `@Virendra Singh` and opens the
   * right profile. Undefined when the handle matches nobody on the roster.
   */
  resolveMention?: (handle: string) => string | undefined;
  /** Rendering a link's label: nested links/mentions/tags stay plain text. */
  inLink?: boolean;
};

function linkLabelOptions(options: InlineOptions): InlineOptions {
  return { ...options, inLink: true };
}

/**
 * Inline tokens (links, mentions, hashtags) share one geometry so they sit in
 * the sentence like text: same font size as the message, same weight, same
 * radius, no vertical padding to push the line height around. `inline` rather
 * than `inline-flex` keeps them on the text baseline and lets long links wrap;
 * `box-decoration-clone` keeps the tint on every wrapped fragment.
 */
const CHIP_BASE_CLASS =
  'rounded-[0.3em] px-[0.3em] py-px font-medium box-decoration-clone align-baseline transition-colors';

const LINK_CHIP_CLASS = cn(
  CHIP_BASE_CLASS,
  'bg-info/10 text-info-text no-underline [overflow-wrap:anywhere] [&_strong]:text-inherit [&_span]:text-inherit',
  'hover:bg-info/20 hover:no-underline',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info',
);

/** Sized in `em` so it scales with the message text instead of a fixed px. */
const CHIP_ICON_CLASS = 'mr-[0.25em] inline-block size-[0.95em] -translate-y-px align-middle';

const MENTION_CHIP_CLASS = cn(
  CHIP_BASE_CLASS,
  'cursor-pointer bg-primary/15 text-primary-text',
  'hover:bg-primary/25',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
);

const GROUP_MENTION_CHIP_CLASS = cn(CHIP_BASE_CLASS, 'bg-warning/20 text-foreground');

const HASHTAG_CHIP_CLASS = cn(CHIP_BASE_CLASS, 'bg-info/10 text-info-text');

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

    if (
      options.inLink &&
      (groups['link'] || groups['url'] || groups['mention'] || groups['hashtag'])
    ) {
      // An anchor can't hold another anchor or a clickable chip.
      nodes.push(token);
    } else if (groups['escape']) {
      nodes.push(token.slice(1));
    } else if (groups['code']) {
      nodes.push(
        <CodeBlock
          key={key}
          variant="inline"
          code={token.slice(1, -1)}
        />,
      );
    } else if (groups['image']) {
      const parsed = /^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(token);
      const source = parsed ? safeUrl(parsed[2]) : null;
      nodes.push(
        source ? (
          <MarkdownImage
            key={key}
            src={source}
            alt={parsed?.[1] || 'Attached image'}
          />
        ) : (
          <Fragment key={key}>{token}</Fragment>
        ),
      );
    } else if (groups['link']) {
      const parsed = /^\[([^\]]*)\]\(([^\s)]*)\)$/.exec(token);
      const href = parsed ? safeUrl(parsed[2]) : null;
      const label = parsed?.[1] ?? '';
      const display = label || (href ? href.replace(/^https?:\/\//i, '') : '');
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={LINK_CHIP_CLASS}
          >
            <Link2 className={CHIP_ICON_CLASS} aria-hidden="true" />
            {label ? renderInline(label, key, linkLabelOptions(options), depth + 1) : display}
          </a>
        ) : (
          // Nowhere safe to go (empty, relative, `javascript:`…): keep the
          // words, drop the link syntax.
          <Fragment key={key}>
            {label ? renderInline(label, key, options, depth + 1) : token}
          </Fragment>
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
        <mark key={key} className="rounded-md bg-warning/25 px-0.5 text-foreground">
          {renderInline(token.slice(2, -2), key, options, depth + 1)}
        </mark>,
      );
    } else if (groups['url']) {
      let cleanToken = token;
      let trailingPunct = '';
      const punctMatch = /[.,;:!?)]+$/.exec(token);
      if (punctMatch && !token.endsWith(')')) {
        trailingPunct = punctMatch[0];
        cleanToken = token.slice(0, -trailingPunct.length);
      }
      const href = safeUrl(cleanToken);
      const display = cleanToken.replace(/^https?:\/\//i, '');
      nodes.push(
        href ? (
          <Fragment key={key}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className={LINK_CHIP_CLASS}
            >
              <Link2 className={CHIP_ICON_CLASS} aria-hidden="true" />
              {display}
            </a>
            {trailingPunct}
          </Fragment>
        ) : (
          <Fragment key={key}>{token}</Fragment>
        ),
      );
    } else if (groups['mention']) {
      // Prefer a known display name over the word-shaped fallback, so a
      // mention that spans a space stays a single chip.
      const rest = text.slice(match.index + 1);
      const known = options.mentionNames.find((name) => {
        if (!rest.toLowerCase().startsWith(name.toLowerCase())) return false;
        if (name.length < token.length - 1) return false;
        const nextChar = rest[name.length];
        return !isWordCharacter(nextChar);
      });
      const typed = known ? `@${rest.slice(0, known.length)}` : token;
      if (known) {
        lastIndex = match.index + typed.length;
        pattern.lastIndex = lastIndex;
      }
      const resolved = options.resolveMention?.(typed.slice(1));
      const mention = resolved ? `@${resolved}` : typed;

      const isGroupMention = GROUP_MENTIONS.has(mention.toLowerCase());
      nodes.push(
        isGroupMention ? (
          <span
            key={key}
            data-mention={mention.slice(1)}
            className={GROUP_MENTION_CHIP_CLASS}
          >
            {mention}
          </span>
        ) : (
          <span
            key={key}
            role="button"
            tabIndex={0}
            data-mention={mention.slice(1)}
            onClick={(e) => {
              e.stopPropagation();
              options.onMentionClick?.(mention);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                options.onMentionClick?.(mention);
              }
            }}
            title={`View profile for ${mention}`}
            className={MENTION_CHIP_CLASS}
          >
            {mention}
          </span>
        ),
      );
    } else if (groups['hashtag']) {
      nodes.push(
        <span key={key} className={HASHTAG_CHIP_CLASS}>
          {token}
        </span>,
      );
    }
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Every heading level renders at the message size — weight carries the
 * structure, not size. Otherwise a web page pasted into chat (its title
 * arrives as `# …`) shouts over everything around it.
 */
const HEADING_CLASS = 'mt-1.5 font-bold text-foreground';

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
  let blankRun = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      blankRun += 1;
      index += 1;
      continue;
    }

    // Blank lines between blocks are a deliberate pause: draw each one as a
    // half-line break (Slack-style), compacted by the same rule the composer
    // applies on send, so older uncompacted messages don't open tall gaps.
    // Leading and trailing blanks draw nothing.
    if (blankRun > 0) {
      const count = compactBlankLineCount(blankRun);
      // A single blank line is just a paragraph break, which the block spacing
      // already draws; only extra blanks add a spacer on top of it.
      if (blocks.length > 0 && count > 1) {
        blocks.push(
          <div
            key={`blank-${index}`}
            aria-hidden
            className="msg-blank-line mt-0!"
            style={{ height: `${(count - 1) * 0.5}lh` }}
          />,
        );
      }
      blankRun = 0;
    }

    // Fenced code block — handles optional language, filename metadata, and unclosed streaming blocks.
    const fence = /^```([A-Za-z0-9_#+.-]+)?(?:\s+(?:filename=|title=)?["']?([^"'\n]+)["']?)?\s*$/.exec(trimmed);
    if (fence) {
      let rawLang = fence[1] || '';
      let filename = fence[2] || undefined;
      if (rawLang.includes(':')) {
        const parts = rawLang.split(':');
        rawLang = parts[0];
        if (!filename && parts[1]) filename = parts[1];
      }
      const body: string[] = [];
      index += 1;
      let closed = false;
      while (index < lines.length) {
        if (/^```\s*$/.test(lines[index].trim())) {
          closed = true;
          break;
        }
        body.push(lines[index]);
        index += 1;
      }
      if (closed) {
        index += 1; // closing fence
      }
      blocks.push(
        <CodeBlock
          key={`code-${index}`}
          code={body.join('\n')}
          language={rawLang || undefined}
          filename={filename}
        />,
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
        <Tag key={`h-${index}`} className={HEADING_CLASS}>
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
        <MarkdownTable
          key={`table-${index}`}
          header={header}
          rows={rows}
          renderCell={(cell, id) => renderInline(cell, `${id}-${index}`, options)}
        />,
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
                <CheckSquare className="mt-1 size-3.5 shrink-0 text-success-text" />
              ) : (
                <Square className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
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
  onMentionClick?: (mention: string) => void;
  mentionProfiles?: Record<string, RightPanelProfile>;
  /**
   * People the author mentioned, by id (`label` = text typed after the `@`).
   * Lets a chip follow the person's current name even after a rename.
   */
  mentionRefs?: { userId: string; label: string }[];
}

export function MarkdownMessage({
  text,
  mentionNames,
  className,
  onMentionClick,
  mentionProfiles,
  mentionRefs,
}: MarkdownMessageProps) {
  const openProfile = useRightPanelStore((s) => s.openProfile);
  const aliases = useMentionAliases();

  const handleMentionClick = useCallback(
    (rawMention: string) => {
      if (onMentionClick) {
        onMentionClick(rawMention);
        return;
      }
      const clean = rawMention.replace(/^@/, '').trim();
      const lower = clean.toLowerCase();
      if (mentionProfiles && mentionProfiles[lower]) {
        openProfile(mentionProfiles[lower]);
        return;
      }
      const isCoworkerOrAgent = [
        'scheduler',
        'tracker',
        'onetab copilot',
        'copilot',
        'code reviewer & security sentinel',
        'onetab ai',
      ].includes(lower);

      openProfile({
        userId: isCoworkerOrAgent ? `coworker-${lower}` : `user-${lower}`,
        name: clean,
        entityKind: isCoworkerOrAgent ? 'coworker' : 'user',
      });
    },
    [onMentionClick, mentionProfiles, openProfile],
  );

  const options = useMemo<InlineOptions>(() => {
    const rawNames = [
      ...DEFAULT_FALLBACK_MENTIONS,
      ...(mentionNames ?? []),
      // Former names, so a multi-word `@Old Name` stays one chip.
      ...aliases.map((a) => a.alias),
    ];
    const cleaned = Array.from(
      new Set(
        rawNames
          .filter(Boolean)
          .map((n) => n.trim().replace(/^@/, ''))
          .filter((n) => n.length > 0),
      ),
    );
    // Longest first, so "@Ana Ruiz" wins over a colleague simply called "Ana".
    cleaned.sort((a, b) => b.length - a.length);

    // Live roster people (not agents/apps), so a short handle follows renames
    // and the full current name instead of freezing the typed text.
    const people = Object.values(mentionProfiles ?? {})
      .filter((p) => p.entityKind === 'user' && p.name)
      .map((p) => p.name.trim());
    const byId = new Map<string, string>();
    for (const p of Object.values(mentionProfiles ?? {})) {
      if (p.entityKind === 'user' && p.name) {
        byId.set(toPlatformUserId(p.userId), p.name.trim());
      }
    }
    const refByLabel = new Map<string, string>();
    for (const ref of mentionRefs ?? []) {
      refByLabel.set(ref.label.trim().toLowerCase(), toPlatformUserId(ref.userId));
    }
    const aliasToId = new Map<string, string>();
    for (const a of aliases) {
      aliasToId.set(a.alias.trim().toLowerCase(), toPlatformUserId(a.userId));
    }
    const resolveMention = people.length
      ? (handle: string): string | undefined => {
          const h = handle.trim().toLowerCase();
          if (!h) return undefined;
          // The author's pick is an id, so it survives the person's renames.
          const refId = refByLabel.get(h);
          const current = refId ? byId.get(refId) : undefined;
          if (current) return current;
          // A name this person used to go by (renamed since the message).
          const aliasId = aliasToId.get(h);
          const fromAlias = aliasId ? byId.get(aliasId) : undefined;
          if (fromAlias) return fromAlias;
          const exact = people.find((n) => n.toLowerCase() === h);
          if (exact) return exact;
          // `@Virendra` → "Virendra Singh", only when exactly one person fits.
          const partial = Array.from(
            new Set(people.filter((n) => n.toLowerCase().startsWith(`${h} `))),
          );
          return partial.length === 1 ? partial[0] : undefined;
        }
      : undefined;

    return {
      mentionNames: cleaned,
      onMentionClick: handleMentionClick,
      resolveMention,
    };
  }, [mentionNames, mentionProfiles, mentionRefs, aliases, handleMentionClick]);

  return (
    <div
      className={cn(
        'space-y-1 text-message text-foreground break-words',
        className,
      )}
    >
      {renderBlocks(text, options)}
    </div>
  );
}

/** Rows shown before a long table collapses behind "Show all". */
const TABLE_COLLAPSED_ROWS = 10;

function compareCells(a: string, b: string): number {
  const na = Number(a.replace(/[,$%\s]/g, ''));
  const nb = Number(b.replace(/[,$%\s]/g, ''));
  if (a.trim() !== '' && b.trim() !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Chat table: rounded card, sticky header, row hover, sortable columns, and
 * for long tables a collapsed view with a row count + "Show all" toggle.
 * Wide tables scroll horizontally inside the card instead of squeezing cells.
 */
function MarkdownTable({
  header,
  rows,
  renderCell,
}: {
  header: string[];
  rows: string[][];
  renderCell: (cell: string, id: string) => ReactNode;
}) {
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareCells(a[sort.col] ?? '', b[sort.col] ?? ''));
  }, [rows, sort]);

  const collapsible = sorted.length > TABLE_COLLAPSED_ROWS;
  const visible = collapsible && !expanded ? sorted.slice(0, TABLE_COLLAPSED_ROWS) : sorted;

  const toggleSort = (col: number) =>
    setSort((prev) =>
      !prev || prev.col !== col
        ? { col, dir: 'asc' }
        : prev.dir === 'asc'
          ? { col, dir: 'desc' }
          : null,
    );

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-surface">
      <div className={cn('overflow-auto', expanded && 'max-h-[28rem]')}>
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-inset">
              {header.map((cell, col) => {
                const active = sort?.col === col;
                const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
                return (
                  <th
                    key={col}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="border-b border-border p-0 text-left"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="group/th flex w-full items-center gap-1 whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {renderCell(cell, `th-${col}`)}
                      <Icon
                        className={cn(
                          'size-3 shrink-0',
                          active ? 'text-primary' : 'opacity-0 group-hover/th:opacity-60',
                        )}
                        aria-hidden
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-foreground/[0.035]"
              >
                {header.map((_, col) => (
                  <td
                    key={col}
                    className="max-w-[28rem] px-3 py-2 align-top text-foreground [overflow-wrap:anywhere]"
                  >
                    {renderCell(row[col] ?? '', `td-${rowIndex}-${col}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {collapsible && (
        <div className="flex items-center justify-between border-t border-border bg-surface-inset px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {expanded ? `${sorted.length} rows` : `Showing ${visible.length} of ${sorted.length} rows`}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-semibold text-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Show all'}
          </button>
        </div>
      )}
    </div>
  );
}
