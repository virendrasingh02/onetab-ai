import { describe, expect, it } from 'vitest';
import {
  countryFromLocale,
  formatNationalAsYouType,
  formatPhone,
  isValidPhone,
  listPhoneCountries,
  splitPhone,
  toE164,
} from './phone.js';

describe('phone helpers', () => {
  it('validates with a country code and normalises to E.164', () => {
    expect(isValidPhone('+91 98765 43210')).toBe(true);
    expect(toE164('+1 (415) 555-2671')).toBe('+14155552671');
    expect(isValidPhone('+1 555 0100')).toBe(false);
    expect(isValidPhone('9876543210')).toBe(false); // no country code
    expect(isValidPhone('')).toBe(false);
  });
  it('formats internationally and falls back to the raw legacy text', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('call me')).toBe('call me');
    expect(formatPhone(null)).toBe('');
  });
  it('formats as you type and splits a stored number', () => {
    expect(formatNationalAsYouType('US', '4155552671')).toBe('(415) 555-2671');
    expect(splitPhone('+919876543210')).toEqual({
      country: 'IN',
      national: '9876543210',
    });
    expect(splitPhone('junk')).toBeNull();
  });
  it('lists countries with flags and dial codes, and reads a locale region', () => {
    const india = listPhoneCountries('en').find((c) => c.code === 'IN');
    expect(india).toMatchObject({ name: 'India', dialCode: '91', flag: '🇮🇳' });
    expect(countryFromLocale('en-GB')).toBe('GB');
    expect(countryFromLocale('en')).toBe('US');
  });
});
