/**
 * Normalizes rich clipboard HTML (Google Docs, Word, Notion, web pages) down
 * to the handful of tags the composer understands, before it's handed to
 * Lexical's `$generateNodesFromDOM`. Kept apart from the editor so it can be
 * exercised against real clipboard payloads in isolation.
 */

/** Tags the sanitizer keeps. Anything else is unwrapped — its text survives,
 *  the wrapper doesn't — which is what flattens layout `<div>`s, `<span>`s,
 *  `<font>` tags and table markup (`table/tr/td/…` aren't here) alike. */
const PASTE_ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'a',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'br',
]);

/** Never kept, never unwrapped — dropped along with their contents. */
const PASTE_DROPPED_TAGS = new Set([
  'script',
  'style',
  'meta',
  'link',
  'head',
  'title',
  'iframe',
  'object',
  'embed',
  'noscript',
  'img',
  'svg',
  'video',
  'audio',
]);

/** Font stacks that mean "this is code" — Google Docs has no inline-code
 *  mark, so people fake one with a monospace font (often coloured too). */
const MONOSPACE_FONT =
  /mono|courier|consolas|menlo|monaco|source code|fira code/i;

/** Only http(s)/mailto survive on a pasted `<a href>` — anything else
 *  (`javascript:`, `data:`, …) is a script-injection vector, not a link. */
function isSafePasteHref(href: string): boolean {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) return true; // relative URL
  return /^(https?|mailto):/i.test(href);
}

function isBoldWeight(weight: string): boolean {
  return (
    weight === 'bold' ||
    weight === 'bolder' ||
    (/^\d+$/.test(weight) && Number(weight) >= 600)
  );
}

/**
 * True when an emphasis tag's own inline style switches that emphasis back
 * off. Google Docs wraps its *entire* clipboard payload in
 * `<b style="font-weight:normal" id="docs-internal-guid-…">` — keeping that
 * `<b>` once its style is stripped would bold every word of the paste.
 */
function cancelsOwnEmphasis(element: HTMLElement, tag: string): boolean {
  const style = element.style;
  if (tag === 'b' || tag === 'strong') {
    return style.fontWeight !== '' && !isBoldWeight(style.fontWeight);
  }
  if (tag === 'i' || tag === 'em') {
    return style.fontStyle === 'normal';
  }
  const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`;
  if (tag === 'u' || tag === 's' || tag === 'strike' || tag === 'del') {
    return /\bnone\b/.test(decoration);
  }
  return false;
}

/**
 * Google Docs, Word and Notion encode bold/italic/underline/strikethrough as
 * inline `style` (`font-weight:700`, not `<b>`) rather than semantic tags —
 * so before attributes get stripped below, real emphasis is promoted into a
 * `<strong>/<em>/<u>/<s>` wrapper that survives, and a monospace run becomes
 * inline `<code>`. Everything else in `style` (color, font-size, margins,
 * line-height, background) is purely decorative and is simply dropped with
 * the rest of the attributes.
 */
function wrapPasteSemanticStyle(doc: Document, element: HTMLElement): void {
  const style = element.style;
  const isBold = isBoldWeight(style.fontWeight);
  const isItalic = style.fontStyle === 'italic';
  const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`;
  const isUnderline = decoration.includes('underline');
  const isStrike = decoration.includes('line-through');

  const tag = element.tagName.toLowerCase();
  // Only inline runs: a monospace `<p>`/`<li>` is a styled block, and inside
  // `<pre>`/`<code>` the text is already code.
  const isInlineCode =
    tag === 'span' &&
    MONOSPACE_FONT.test(style.fontFamily) &&
    !element.closest('pre, code') &&
    (element.textContent ?? '').trim() !== '';

  let target = element;
  const wrap = (wrapperTag: string) => {
    const wrapper = doc.createElement(wrapperTag);
    while (target.firstChild) wrapper.appendChild(target.firstChild);
    target.appendChild(wrapper);
    target = wrapper;
  };

  if (isBold && tag !== 'strong' && tag !== 'b') wrap('strong');
  if (isItalic && tag !== 'em' && tag !== 'i') wrap('em');
  if (isUnderline && tag !== 'u') wrap('u');
  if (isStrike && tag !== 's' && tag !== 'strike' && tag !== 'del') wrap('s');
  if (isInlineCode) wrap('code');
}

/**
 * Recursively strips pasted HTML down to what the composer actually
 * understands: promotes real inline-style emphasis into semantic tags (see
 * above), strips every attribute except `href` on links (and only a safe
 * one), and unwraps — keeping the text, dropping the wrapper — anything
 * outside {@link PASTE_ALLOWED_TAGS}, plus emphasis tags whose own style
 * cancels them. What's left maps directly onto nodes already registered in
 * the editor; nothing new to register.
 */
export function sanitizePasteDom(doc: Document, node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      node.removeChild(child);
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;

    const tag = child.tagName.toLowerCase();
    if (PASTE_DROPPED_TAGS.has(tag)) {
      node.removeChild(child);
      continue;
    }

    // Read before the style goes: once attributes are stripped a
    // `<b style="font-weight:normal">` is indistinguishable from real bold.
    const unwrap =
      !PASTE_ALLOWED_TAGS.has(tag) || cancelsOwnEmphasis(child, tag);

    wrapPasteSemanticStyle(doc, child);
    // Recurse first so nested disallowed content is already cleaned up
    // whether this element ends up kept or unwrapped.
    sanitizePasteDom(doc, child);

    if (unwrap) {
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      node.removeChild(child);
      continue;
    }

    const href = tag === 'a' ? child.getAttribute('href') : null;
    for (const attr of Array.from(child.attributes))
      child.removeAttribute(attr.name);
    if (href && isSafePasteHref(href)) child.setAttribute('href', href);
  }
}
