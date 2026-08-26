const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'of',
  'in',
  'on',
  'at',
  'to',
  'with',
  'by',
  'from',
  'is',
  'it',
]);

/**
 * Generates an uppercase identifier prefix (e.g., 'WEB', 'CSP', 'AAP')
 * from a project name, ensuring uniqueness within the provided prefix set.
 */
export function generateProjectIdentifier(
  projectTitle: string,
  existingPrefixes: string[] | Set<string> = [],
): string {
  const existing =
    existingPrefixes instanceof Set
      ? existingPrefixes
      : new Set(existingPrefixes.map((p) => p.toUpperCase()));

  const normalized = (projectTitle || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Split into alphanumeric tokens
  const words = normalized
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  let stem: string;

  if (words.length === 0) {
    stem = 'PRJ';
  } else if (words.length === 1) {
    const single = words[0].toUpperCase();
    stem = single.length >= 3 ? single.slice(0, 3) : single.padEnd(2, 'P');
  } else {
    // Multi-word: filter out stop words if enough meaningful words remain
    const meaningfulWords = words.filter(
      (w) => !STOP_WORDS.has(w.toLowerCase()),
    );
    const candidateWords =
      meaningfulWords.length >= 2 ? meaningfulWords : words;

    if (candidateWords.length >= 2 && candidateWords.length <= 4) {
      stem = candidateWords.map((w) => w[0]).join('').toUpperCase();
      // If 2 letters, consider taking 3 if first word is long enough
      if (stem.length === 2 && candidateWords[0].length >= 2) {
        stem = (candidateWords[0].slice(0, 2) + candidateWords[1][0]).toUpperCase();
      }
    } else if (candidateWords.length > 4) {
      stem = candidateWords.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
    } else {
      stem = candidateWords[0].slice(0, 3).toUpperCase();
    }
  }

  // Ensure stem is 2 to 6 alphanumeric uppercase characters
  stem = stem.replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (!stem) stem = 'PRJ';

  // Collision resolution
  if (!existing.has(stem)) {
    return stem;
  }

  for (let counter = 2; ; counter += 1) {
    const candidate = `${stem}${counter}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
}

/**
 * Validates whether a custom prefix is formatted properly (2-8 uppercase alphanumeric chars).
 */
export function isValidIdentifierPrefix(prefix: string): boolean {
  return /^[A-Z0-9]{2,8}$/.test(prefix.trim());
}

/**
 * Formats a ticket identifier from prefix and sequence number.
 * e.g. formatTicketIdentifier('WEB', 104) -> 'WEB-104'
 */
export function formatTicketIdentifier(
  prefix: string | null | undefined,
  ticketNumber: number | null | undefined,
): string | null {
  if (!prefix || ticketNumber == null) return null;
  return `${prefix.toUpperCase()}-${ticketNumber}`;
}
