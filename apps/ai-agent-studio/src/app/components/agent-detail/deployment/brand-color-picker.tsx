import { Input, Label } from '@org/ui';
import { cn } from '@org/utils';
import { Check, Pipette } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cleanColor } from './widget-config.js';

const PRESETS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Lime', hex: '#65a30d' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Purple', hex: '#9333ea' },
  { name: 'Slate', hex: '#334155' },
  { name: 'Black', hex: '#0f172a' },
];

/** `#abc` → `#aabbcc`, lower-cased; undefined if not a hex colour. */
export function normalizeHex(value: string): string | undefined {
  const raw = value.trim();
  const clean = cleanColor(raw.startsWith('#') ? raw : `#${raw}`);
  if (!clean) return undefined;
  const hex = clean.slice(1).toLowerCase();
  return `#${hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex}`;
}

/** WCAG contrast of white text on the colour (launcher, send button, avatar). */
function contrastWithWhite(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (lum + 0.05);
}

/**
 * Brand colour: a preset palette, a custom swatch backed by the system colour
 * picker, and a hex field. Any valid hex is accepted, so a brand's exact colour
 * never has to be one of the presets.
 */
export function BrandColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const current = normalizeHex(value);
  const isPreset = !!current && PRESETS.some((p) => p.hex === current);
  const isCustom = !!current && !isPreset;

  // The hex field keeps what is typed until it is a colour, so editing is never fought.
  const [text, setText] = useState(value);
  useEffect(() => {
    if (normalizeHex(text) !== current) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commitText = (next: string) => {
    setText(next);
    const hex = normalizeHex(next);
    onChange(hex ?? next);
  };

  const lowContrast = !!current && contrastWithWhite(current) < 3;

  return (
    <div className="space-y-2.5">
      <Label htmlFor={`${id}-hex`}>Brand colour</Label>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Brand colour">
        {PRESETS.map((c) => {
          const active = current === c.hex;
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              title={`${c.name} ${c.hex}`}
              onClick={() => commitText(c.hex)}
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-white shadow-xs ring-1 ring-inset ring-black/10 transition-transform dark:ring-white/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background dark:ring-foreground' : 'hover:scale-110',
              )}
              style={{ backgroundColor: c.hex }}
            >
              {active ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </button>
          );
        })}

        {/* Custom: the system colour picker, showing the colour once one is chosen. */}
        <label
          title="Custom colour"
          className={cn(
            'relative flex size-7 cursor-pointer items-center justify-center rounded-full text-white shadow-xs transition-transform focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
            isCustom ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110',
          )}
          style={{
            background: isCustom
              ? current
              : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
          }}
        >
          {isCustom ? <Check className="size-3.5" strokeWidth={3} /> : <Pipette className="size-3.5 drop-shadow" />}
          <input
            type="color"
            aria-label="Pick a custom colour"
            value={current ?? '#6366f1'}
            onChange={(e) => commitText(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
          />
        </label>
      </div>

      <Input
        id={`${id}-hex`}
        value={text}
        onChange={(e) => commitText(e.target.value)}
        onBlur={() => current && setText(current)}
        aria-invalid={!current}
        spellCheck={false}
        maxLength={7}
        wrapperClassName="w-40"
        className="font-mono text-xs uppercase"
        prefix={<span className="size-4 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20" style={{ background: current ?? 'transparent' }} />}
      />

      {!current ? (
        <p className="text-[11px] text-destructive">Use a hex colour like #6366F1.</p>
      ) : lowContrast ? (
        <p className="text-[11px] text-warning">This colour is light, so white text and icons on it (launcher, send button) may be hard to read.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Pick a preset, choose any colour with the picker, or paste your brand’s hex code.</p>
      )}
    </div>
  );
}
