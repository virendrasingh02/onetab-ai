const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  '_ga',
]);

export interface DetectedLink {
  url: string;
  normalizedUrl: string;
  index: number;
}

/**
 * Normalizes a URL by:
 * - Lowercasing scheme and domain
 * - Removing URL fragments (#...)
 * - Removing default ports (:80, :443)
 * - Removing tracking query parameters (utm_*, fbclid, etc.)
 * - Removing trailing slash on root
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = '';

    const toDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) {
      parsed.searchParams.delete(key);
    }

    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    let href = parsed.toString();
    if (href.endsWith('/') && parsed.pathname === '/' && !parsed.search) {
      href = href.slice(0, -1);
    }

    return href;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Robust URL detection regex that matches valid HTTP/HTTPS URLs while
 * respecting markdown link syntax and punctuation boundaries.
 */
const URL_REGEX =
  /(?:https?:\/\/)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d{1,5})?(?:[/?#][^\s<>"'()]*[^\s<>"'().,;:!?])?/gi;

/**
 * Strips unwanted trailing punctuation often caught by greedier matching.
 */
function trimTrailingPunctuation(url: string): string {
  let cleaned = url;
  while (/[.,;:!?)]$/.test(cleaned)) {
    // If ending with ')' and there's no matching '(' in the URL, trim it
    if (cleaned.endsWith(')')) {
      const openCount = (cleaned.match(/\(/g) || []).length;
      const closeCount = (cleaned.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        cleaned = cleaned.slice(0, -1);
        continue;
      }
    } else {
      cleaned = cleaned.slice(0, -1);
      continue;
    }
    break;
  }
  return cleaned;
}

export interface DetectLinksOptions {
  maxLinks?: number;
}

/**
 * Extracts and normalizes valid HTTP/HTTPS URLs from text.
 * Filters duplicate URLs and respects the maxLinks limit (default: 5).
 */
export function detectLinks(
  text: string,
  options: DetectLinksOptions = {},
): DetectedLink[] {
  if (!text || typeof text !== 'string') return [];

  const maxLinks = options.maxLinks ?? 5;
  const matches: DetectedLink[] = [];
  const seenNormalized = new Set<string>();

  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    const rawMatch = match[0];
    const cleaned = trimTrailingPunctuation(rawMatch);

    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }

      const normalized = normalizeUrl(cleaned);
      if (seenNormalized.has(normalized)) {
        continue;
      }

      seenNormalized.add(normalized);
      matches.push({
        url: cleaned,
        normalizedUrl: normalized,
        index: match.index,
      });

      if (matches.length >= maxLinks) {
        break;
      }
    } catch {
      // Invalid URL according to WHATWG URL standard, skip
    }
  }

  return matches;
}
