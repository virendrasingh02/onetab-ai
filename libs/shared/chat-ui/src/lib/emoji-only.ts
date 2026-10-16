const EMOJI_GRAPHEME = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * Number of emoji in a message made of nothing but emoji (and whitespace),
 * or 0 when the message contains any other text. Each grapheme cluster
 * counts once, so ZWJ sequences (👨‍👩‍👧), skin tones and flags are one emoji.
 */
export function countEmojiOnly(text: string, max = 32): number {
  const trimmed = text.trim();
  if (!trimmed || !segmenter || trimmed.length > max * 16) return 0;
  let count = 0;
  for (const { segment } of segmenter.segment(trimmed)) {
    if (/^\s+$/u.test(segment)) continue;
    if (!EMOJI_GRAPHEME.test(segment)) return 0;
    if (++count > max) return 0;
  }
  return count;
}
