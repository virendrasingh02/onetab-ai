import { isValidHexColor } from '@org/design-system';
import { Input } from '@org/ui';
import { useEffect, useRef, useState } from 'react';

/** Accepts `#abc`, `abc`, `#aabbcc`; returns lowercase `#rrggbb`, or null. */
export function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim();
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!isValidHexColor(prefixed)) return null;
  const hex = prefixed.toLowerCase();
  return hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
}

export interface HexInputProps {
  value: string;
  /** Called only with a valid `#rrggbb` value, so an invalid draft never reaches the theme or the API. */
  onCommit: (hex: string) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Text field for a hex colour. Keeps what the user is typing locally and only
 * commits complete, valid values — the API rejects anything else, so a
 * half-typed `#6` must never be written into the theme.
 */
export function HexInput({ value, onCommit, className, ...rest }: HexInputProps) {
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  const invalid = text.trim() !== '' && normalizeHex(text) === null;

  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex && hex !== value.toLowerCase()) onCommit(hex);
  };

  return (
    <Input
      value={text}
      spellCheck={false}
      maxLength={7}
      aria-invalid={invalid || undefined}
      aria-label={rest['aria-label']}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        // 6-digit values commit live; 3-digit shorthand waits for blur/Enter
        // so typing `#60c686` never passes through a different valid colour.
        if (/^#?[0-9a-fA-F]{6}$/.test(next.trim())) commit(next);
      }}
      onBlur={() => {
        focused.current = false;
        const hex = normalizeHex(text);
        if (hex) {
          commit(hex);
          setText(hex);
        } else {
          setText(value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`${className ?? ''} ${invalid ? 'border-destructive' : ''}`}
    />
  );
}
