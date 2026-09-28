/**
 * Output guardrails an agent's builder graph can switch on.
 *
 * Deliberately pattern-based and conservative: this catches the personal data
 * that has a recognisable shape (emails, phone numbers, payment-card and
 * SSN-style numbers). It is not a classifier and does not claim to find names
 * or addresses — the builder labels it "PII redaction", not "privacy filter".
 */

import type { AgentPiiAction } from '@org/types';

export interface PiiFindings {
  email: number;
  phone: number;
  card: number;
  ssn: number;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
/** 13–19 digits, optionally grouped by spaces or dashes — then Luhn-checked. */
const CARD_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;
/** A run of digits and phone punctuation — kept only if it holds 10–15 digits. */
const PHONE_CANDIDATE = /\+?\(?\d[\d\s().-]{8,}\d/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Replaces recognisable personal data with labelled placeholders. */
export function redactPII(text: string): { text: string; findings: PiiFindings } {
  const findings: PiiFindings = { email: 0, phone: 0, card: 0, ssn: 0 };
  let out = text.replace(SSN, () => {
    findings.ssn++;
    return '[redacted SSN]';
  });
  out = out.replace(CARD_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) return match;
    findings.card++;
    return '[redacted card number]';
  });
  out = out.replace(EMAIL, () => {
    findings.email++;
    return '[redacted email]';
  });
  out = out.replace(PHONE_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return match;
    findings.phone++;
    return '[redacted phone]';
  });
  return { text: out, findings };
}

export function countFindings(findings: PiiFindings): number {
  return findings.email + findings.phone + findings.card + findings.ssn;
}

export const PII_BLOCKED_MESSAGE =
  "I can't share that answer: it contained personal data, and this agent's PII guardrail blocks it.";

/**
 * Applies the agent's PII policy to a finished answer. Returns the text to
 * deliver and, when the policy fired, a notice for the run trace.
 */
export function applyPiiGuardrail(
  text: string,
  action: AgentPiiAction | undefined,
): { text: string; notice?: string } {
  if (!action || !text) return { text };
  const { text: redacted, findings } = redactPII(text);
  const total = countFindings(findings);
  if (total === 0) return { text };
  const summary = Object.entries(findings)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${kind}`)
    .join(', ');
  if (action === 'block') {
    return { text: PII_BLOCKED_MESSAGE, notice: `PII guardrail blocked the answer (${summary}).` };
  }
  if (action === 'redact') {
    return { text: redacted, notice: `PII guardrail redacted ${summary}.` };
  }
  return { text, notice: `PII guardrail warning: the answer contains ${summary}.` };
}
