/**
 * Slack-style blank-line compaction, shared by the composer (on send) and the
 * message renderer (for everything already in the timeline).
 *
 * A burst of Shift+Enters should read as "a pause", not open a screen-tall
 * gap. Each run of blank lines is halved, rounded up, and capped:
 * 1 → 1, 2 → 1, 3 → 2, 6 → 3, 20 → 3.
 */
export const MAX_BLANK_LINES = 3;

export function compactBlankLineCount(count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.ceil(count / 2), MAX_BLANK_LINES);
}

const FENCE_PATTERN = /^\s*```/;

/**
 * Compacts every run of blank (or whitespace-only) lines in a markdown body.
 * Fenced code blocks are left untouched — blank lines there are content.
 */
export function compactBlankLines(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inFence = false;
  let blankRun = 0;

  const flushBlankRun = () => {
    for (let i = 0; i < compactBlankLineCount(blankRun); i += 1) out.push('');
    blankRun = 0;
  };

  for (const line of lines) {
    if (!inFence && line.trim() === '') {
      blankRun += 1;
      continue;
    }
    flushBlankRun();
    if (FENCE_PATTERN.test(line)) inFence = !inFence;
    out.push(line);
  }
  flushBlankRun();

  return out.join('\n');
}
