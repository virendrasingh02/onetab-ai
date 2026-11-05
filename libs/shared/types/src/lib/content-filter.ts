/**
 * The objectionable-content filter behind App Store guideline 1.2.
 *
 * Deliberately narrow. This is a workplace product, so ordinary swearing passes
 * and only severe content is stopped: hate slurs, sexual content involving
 * children, and direct threats or urging self-harm. Anything subtler is what
 * Report is for. Every addition needs a matching case in the spec, including
 * the innocent words it must not catch.
 *
 * Platform-free and dependency-free: the API, the web composer, the Matrix
 * client and the mobile app all run this same code.
 */
export type ContentFilterCategory = 'hate' | 'child_safety' | 'violence';

export type ContentFilterResult =
  { allowed: true } | { allowed: false; category: ContentFilterCategory };

export const CONTENT_BLOCKED_CODE = 'CONTENT_BLOCKED';

export const CONTENT_BLOCKED_MESSAGE =
  "This can't be posted because it may break our content rules. Edit it and try again.";

/** Above the 500k document limit, so a long doc cannot hide text at the end. */
const MAX_SCANNED_LENGTH = 600_000;

const LOOKALIKES: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '7': 't',
};

/**
 * Slurs: matched as whole words, so `snigger` never trips them. Words with a
 * common innocent use (`a chink in the armor`, `spic and span`) stay out.
 */
const HATE_TERMS = [
  'nigger',
  'nigga',
  'faggot',
  'kike',
  'wetback',
  'tranny',
  'raghead',
  'towelhead',
  'paki',
];

const CHILD_SAFETY_PHRASES = [
  'child porn',
  'child pornography',
  'kiddie porn',
  'kiddy porn',
  'underage porn',
  'preteen porn',
  'pedo porn',
  'sex with a child',
  'sex with children',
  'sex with a minor',
  'sex with minors',
];

/** First-person and direct only: `kill the process` is a normal day at work. */
const VIOLENCE_PHRASES = [
  'kill yourself',
  'go kill yourself',
  'kys',
  'i will kill you',
  'ill kill you',
  'im going to kill you',
  'im gonna kill you',
  'i am going to kill you',
  'i am gonna kill you',
  'i will rape you',
  'im going to rape you',
  'im gonna rape you',
  'i hope you die',
  'hope you get raped',
  'i will shoot up',
  'im going to shoot up',
  'im gonna shoot up',
  'i will bomb the',
  'im going to bomb the',
];

/**
 * `kill` → `k+[._*-]*i+[._*-]*l+[._*-]*l+`: stretched letters and the
 * punctuation people put between them. Spaces only match between words.
 * Each letter class is disjoint from the separators, so this cannot backtrack
 * catastrophically on hostile input.
 */
function stretchWord(word: string): string {
  return [...word].map((letter) => `${letter}+`).join('[._*-]*');
}

function compile(terms: readonly string[], plural: boolean): RegExp {
  const alternatives = terms
    .map((term) => term.split(' ').map(stretchWord).join('[^a-z0-9]+'))
    .join('|');
  const suffix = plural ? 's*' : '';
  return new RegExp(`(?<![a-z0-9])(?:${alternatives})${suffix}(?![a-z0-9])`);
}

const RULES: ReadonlyArray<{
  category: ContentFilterCategory;
  pattern: RegExp;
}> = [
  { category: 'child_safety', pattern: compile(CHILD_SAFETY_PHRASES, false) },
  { category: 'hate', pattern: compile(HATE_TERMS, true) },
  { category: 'violence', pattern: compile(VIOLENCE_PHRASES, false) },
];

/** Lowercase, no accents or apostrophes, lookalike characters undone. */
function normalize(text: string): string {
  return text
    .slice(0, MAX_SCANNED_LENGTH)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u200b-\u200d\u2060\ufeff]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[013457!@$]/g, (char) => LOOKALIKES[char] ?? char);
}

/** `n i g g e r` → `nigger`: only runs of three or more lone letters. */
function joinSpacedLetters(text: string): string {
  return text.replace(/(?<![a-z0-9])[a-z](?: [a-z]){2,}(?![a-z0-9])/g, (run) =>
    run.replace(/ /g, ''),
  );
}

export function checkContent(
  text: string | null | undefined,
): ContentFilterResult {
  if (!text) return { allowed: true };
  const normalized = normalize(text);
  const joined = joinSpacedLetters(normalized);
  for (const { category, pattern } of RULES) {
    if (pattern.test(normalized) || pattern.test(joined)) {
      return { allowed: false, category };
    }
  }
  return { allowed: true };
}

/** For a form with several fields: the first problem found, if any. */
export function checkAllContent(
  ...texts: Array<string | null | undefined>
): ContentFilterResult {
  for (const text of texts) {
    const result = checkContent(text);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}
