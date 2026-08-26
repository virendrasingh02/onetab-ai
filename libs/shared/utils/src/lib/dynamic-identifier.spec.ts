import { describe, expect, it } from 'vitest';
import {
  formatTicketIdentifier,
  generateProjectIdentifier,
  isValidIdentifierPrefix,
} from './dynamic-identifier.js';

describe('generateProjectIdentifier', () => {
  it('handles multi-word project titles', () => {
    expect(generateProjectIdentifier('Website Redesign')).toBe('WER');
    expect(generateProjectIdentifier('Customer Support Portal')).toBe('CSP');
    expect(generateProjectIdentifier('AI Agent Platform')).toBe('AAP');
  });

  it('handles single-word project titles', () => {
    expect(generateProjectIdentifier('Finance')).toBe('FIN');
    expect(generateProjectIdentifier('Marketing')).toBe('MAR');
  });

  it('filters common stop words when appropriate', () => {
    expect(generateProjectIdentifier('Portal for the Mobile App')).toBe('PMA');
  });

  it('handles collisions by generating unique suffix', () => {
    const existing = ['WEB', 'WEB2', 'CSP'];
    expect(generateProjectIdentifier('Website', existing)).toBe('WEB3');
    expect(generateProjectIdentifier('Customer Support Portal', existing)).toBe('CSP2');
  });

  it('handles empty or special character titles', () => {
    expect(generateProjectIdentifier('---')).toBe('PRJ');
    expect(generateProjectIdentifier('')).toBe('PRJ');
  });
});

describe('isValidIdentifierPrefix', () => {
  it('validates 2-8 uppercase alphanumeric prefix strings', () => {
    expect(isValidIdentifierPrefix('WEB')).toBe(true);
    expect(isValidIdentifierPrefix('CSP12')).toBe(true);
    expect(isValidIdentifierPrefix('W')).toBe(false);
    expect(isValidIdentifierPrefix('TOOLONGPREFIX')).toBe(false);
    expect(isValidIdentifierPrefix('web')).toBe(false);
  });
});

describe('formatTicketIdentifier', () => {
  it('formats ticket identifiers correctly', () => {
    expect(formatTicketIdentifier('WEB', 104)).toBe('WEB-104');
    expect(formatTicketIdentifier(null, 104)).toBeNull();
    expect(formatTicketIdentifier('WEB', null)).toBeNull();
  });
});
