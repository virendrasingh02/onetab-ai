import {
  countryFromLocale,
  formatNationalAsYouType,
  listPhoneCountries,
  parsePhone,
  splitPhone,
  type PhoneCountry,
} from '@org/utils';
import { cn } from '@org/utils';
import { useMemo, useState } from 'react';
import { Combobox, type ComboboxOption } from './combobox.js';
import { Input } from './input.js';

export interface PhoneInputProps {
  /** E.164 value (`+919876543210`) or an empty string. */
  value: string;
  /** Emits E.164 while the number is complete and valid, otherwise the best partial (`+91 987…`) or `''`. */
  onChange: (value: string) => void;
  /** Country preselected when `value` carries none; defaults to the browser locale's region. */
  defaultCountry?: PhoneCountry;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Phone number field with a searchable country picker and an as-you-type
 * national formatter. The dial code shows as a prefix inside the field, and
 * the value is always reported with its country code (E.164) so it is
 * unambiguous wherever it is stored.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  id,
  disabled,
  invalid,
  className,
  'aria-label': ariaLabel = 'Phone number',
}: PhoneInputProps) {
  const countries = useMemo(
    () =>
      listPhoneCountries(
        typeof navigator === 'undefined' ? undefined : navigator.language,
      ),
    [],
  );
  const initial = splitPhone(value);
  const [country, setCountry] = useState<PhoneCountry>(
    initial?.country ??
      defaultCountry ??
      countryFromLocale(
        typeof navigator === 'undefined' ? undefined : navigator.language,
      ),
  );
  // What the user typed, kept as digits so reformatting never fights the caret.
  const [national, setNational] = useState(initial?.national ?? '');

  const options = useMemo<ComboboxOption[]>(
    () =>
      countries.map((c) => ({
        value: c.code,
        label: c.name,
        // Flag emoji render as bare letters on Windows, so the dial code leads instead.
        description: `+${c.dialCode}`,
      })),
    [countries],
  );
  const dialCode = countries.find((c) => c.code === country)?.dialCode ?? '';

  const emit = (nextCountry: PhoneCountry, digits: string) => {
    if (!digits) return onChange('');
    const candidate = `+${countries.find((c) => c.code === nextCountry)?.dialCode ?? ''}${digits}`;
    onChange(parsePhone(candidate)?.number ?? candidate);
  };

  return (
    <div className={cn('gap-2 flex w-full items-center', className)}>
      <Combobox
        aria-label="Country"
        className="w-44 shrink-0"
        popoverWidth={300}
        searchPlaceholder="Search country or code…"
        options={options}
        value={country}
        disabled={disabled}
        onChange={(next) => {
          const code = next as PhoneCountry;
          if (!code) return;
          setCountry(code);
          emit(code, national);
        }}
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        invalid={invalid}
        disabled={disabled}
        prefix={<span className="tabular-nums">+{dialCode}</span>}
        value={formatNationalAsYouType(country, national)}
        placeholder="Phone number"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
          setNational(digits);
          emit(country, digits);
        }}
      />
    </div>
  );
}
