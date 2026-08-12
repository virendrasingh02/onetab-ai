import type {
  DocCategory,
  DocComment,
  DocStatus,
  NotionBlock,
} from './doc-types.js';

/**
 * What goes in `WorkDocument.content`.
 *
 * The editor is block-based and carries presentation state — a cover, an emoji,
 * a review status, a category, comments — none of which the documents table has
 * a column for. `content` is a 500 kB string, so the whole lot is serialised
 * into it as one JSON envelope. That keeps the docs screen fully server-backed
 * without a migration, at the cost of the metadata not being queryable; nothing
 * queries it.
 *
 * {@link decodeDocContent} accepts anything: a document written by some other
 * client, or a plain-text one, comes back as a single paragraph rather than an
 * error, so foreign content is shown and preserved rather than discarded.
 */

const ENVELOPE_KIND = 'onetab.doc';
const ENVELOPE_VERSION = 1;

export interface DocMeta {
  category?: DocCategory;
  status?: DocStatus;
  icon?: string;
  iconColor?: string;
  cover?: string;
  favorite?: boolean;
  pinned?: boolean;
}

export interface DocEnvelope {
  meta: DocMeta;
  blocks: NotionBlock[];
  comments: DocComment[];
}

interface StoredEnvelope extends DocEnvelope {
  kind: typeof ENVELOPE_KIND;
  v: number;
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredEnvelope>;
  return candidate.kind === ENVELOPE_KIND && Array.isArray(candidate.blocks);
}

/** A block id that is stable within a document but cheap to mint. */
export function blockId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `b_${random}`;
}

export function decodeDocContent(content: string): DocEnvelope {
  if (!content.trim()) {
    return { meta: {}, blocks: [], comments: [] };
  }

  try {
    const parsed: unknown = JSON.parse(content);
    if (isEnvelope(parsed)) {
      return {
        meta: parsed.meta ?? {},
        blocks: parsed.blocks,
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      };
    }
  } catch {
    // Not JSON at all — fall through and treat it as prose.
  }

  return {
    meta: {},
    blocks: [{ id: blockId(), type: 'paragraph', content }],
    comments: [],
  };
}

export function encodeDocContent(envelope: DocEnvelope): string {
  const stored: StoredEnvelope = {
    kind: ENVELOPE_KIND,
    v: ENVELOPE_VERSION,
    ...envelope,
  };
  return JSON.stringify(stored);
}

/** First words of a document's text, for the sidebar row. */
export function snippetFor(blocks: NotionBlock[]): string {
  const text = blocks
    .map((block) => block.content)
    .filter(Boolean)
    .join(' ')
    .slice(0, 90);
  return text ? `${text}…` : '';
}
