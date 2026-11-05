/**
 * Report reasons and block filtering. Platform-free so it is unit tested
 * without a device.
 */
export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE'
  | 'SEXUAL'
  | 'VIOLENCE'
  | 'SELF_HARM'
  | 'ILLEGAL'
  | 'MISINFORMATION'
  | 'OTHER';

export const REPORT_REASONS: ReadonlyArray<{
  value: ReportReason;
  label: string;
}> = [
  { value: 'SPAM', label: 'Spam or scam' },
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'HATE', label: 'Hate speech' },
  { value: 'SEXUAL', label: 'Sexual content' },
  { value: 'VIOLENCE', label: 'Violence or threats' },
  { value: 'SELF_HARM', label: 'Self-harm' },
  { value: 'ILLEGAL', label: 'Illegal content' },
  { value: 'MISINFORMATION', label: 'False or harmful information' },
  { value: 'OTHER', label: 'Something else' },
];

/**
 * Drops messages from blocked senders. The homeserver does this too through
 * `m.ignored_user_list`; this covers a timeline already on screen and a server
 * that could not be updated. Your own messages are never hidden.
 */
export function withoutBlockedSenders<T extends { sender: string }>(
  items: readonly T[],
  blockedMatrixIds: ReadonlySet<string>,
  ownUserId: string,
): T[] {
  if (blockedMatrixIds.size === 0) return [...items];
  return items.filter(
    (item) => item.sender === ownUserId || !blockedMatrixIds.has(item.sender),
  );
}

/** The version a person agreed to. Raising it asks everyone again. */
export const AI_CONSENT_VERSION = '1';

export function hasAiConsent(stored: string | null): boolean {
  return stored === AI_CONSENT_VERSION;
}
