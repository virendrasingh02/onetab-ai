import { describe, expect, it } from 'vitest';
import { applyPiiGuardrail, PII_BLOCKED_MESSAGE, redactPII } from './agent-guardrails.js';

describe('redactPII', () => {
  it('redacts emails, phone numbers, Luhn-valid cards and SSNs', () => {
    const { text, findings } = redactPII(
      'Mail ann@example.com or call +1 (415) 555-0100. Card 4111 1111 1111 1111, SSN 123-45-6789.',
    );
    expect(text).toBe(
      'Mail [redacted email] or call [redacted phone]. Card [redacted card number], SSN [redacted SSN].',
    );
    expect(findings).toEqual({ email: 1, phone: 1, card: 1, ssn: 1 });
  });

  it('leaves dates, order numbers and non-Luhn digit runs alone', () => {
    const input = 'Shipped 2026-09-28, order 12345678, ref 1234 5678 9012 3456.';
    expect(redactPII(input).text).toBe(input);
  });
});

describe('applyPiiGuardrail', () => {
  const answer = 'Reach Bob at bob@acme.io.';

  it('does nothing without a policy or without findings', () => {
    expect(applyPiiGuardrail(answer, undefined)).toEqual({ text: answer });
    expect(applyPiiGuardrail('All clear.', 'block')).toEqual({ text: 'All clear.' });
  });

  it('redacts, blocks or warns as configured', () => {
    expect(applyPiiGuardrail(answer, 'redact').text).toBe('Reach Bob at [redacted email].');
    expect(applyPiiGuardrail(answer, 'block').text).toBe(PII_BLOCKED_MESSAGE);
    const warned = applyPiiGuardrail(answer, 'warn');
    expect(warned.text).toBe(answer);
    expect(warned.notice).toMatch(/1 email/);
  });
});
