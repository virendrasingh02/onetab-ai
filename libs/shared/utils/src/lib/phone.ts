import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';

export type PhoneCountry = CountryCode;

export interface PhoneCountryOption {
  code: PhoneCountry;
  name: string;
  /** Calling code without the `+`, e.g. `91`. */
  dialCode: string;
  flag: string;
}

/** Regional-indicator flag emoji for an ISO 3166-1 alpha-2 code. */
export const countryFlag = (code: string): string =>
  String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)),
  );

let cachedCountries: PhoneCountryOption[] | undefined;

/** Every country libphonenumber knows, named in the viewer's language, A→Z. */
export function listPhoneCountries(locale?: string): PhoneCountryOption[] {
  if (cachedCountries) return cachedCountries;
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames(locale ? [locale] : undefined, {
      type: 'region',
    });
  } catch {
    names = undefined;
  }
  cachedCountries = getCountries()
    .map((code) => ({
      code,
      name: names?.of(code) ?? code,
      dialCode: getCountryCallingCode(code),
      flag: countryFlag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedCountries;
}

/** Best-guess country for a locale like `en-IN`; `fallback` when it carries no region. */
export function countryFromLocale(
  locale: string | undefined,
  fallback: PhoneCountry = 'US',
): PhoneCountry {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return region && getCountries().includes(region as PhoneCountry)
    ? (region as PhoneCountry)
    : fallback;
}

/** Parse an E.164 (or `+`-prefixed) number; null when it is not a valid number. */
export function parsePhone(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value);
  return parsed?.isValid() ? parsed : null;
}

export const isValidPhone = (value: string | null | undefined): boolean =>
  parsePhone(value) !== null;

/** Canonical storage form, `+919876543210`; null when invalid. */
export const toE164 = (value: string | null | undefined): string | null =>
  parsePhone(value)?.number ?? null;

/** `+91 98765 43210` — or the raw text when it is not a parseable number (legacy values). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  return parsePhone(value)?.formatInternational() ?? value;
}

/** Digits typed in `country`, formatted as the user types (`98765 43210`). */
export function formatNationalAsYouType(
  country: PhoneCountry,
  digits: string,
): string {
  return new AsYouType(country).input(digits);
}

/** Split a stored E.164 into its country and the national number. */
export function splitPhone(
  value: string | null | undefined,
): { country: PhoneCountry; national: string } | null {
  const parsed = parsePhone(value);
  return parsed?.country
    ? { country: parsed.country, national: parsed.nationalNumber }
    : null;
}
