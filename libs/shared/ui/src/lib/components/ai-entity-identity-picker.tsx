import { cn } from '@org/utils';
import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import {
  AI_ENTITY_COLORS,
  AI_ENTITY_ICONS,
  AiEntityAvatar,
  DEFAULT_AI_ENTITY_COLOR,
  DEFAULT_AI_ENTITY_ICON,
  formatAiEntityIconAvatar,
  parseAiEntityAvatar,
  type AiEntityKind,
} from './ai-entity-avatar.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { SegmentedControl } from './segmented-control.js';
import { toast } from './toaster.js';

type Source = 'icon' | 'upload' | 'url';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface AiEntityIdentityPickerProps {
  /** Used for the preview's alt text and its name-derived fallback tint. */
  name: string;
  kind?: AiEntityKind;
  /** The entity's `avatarUrl` — a photo URL or `icon:<icon>[:<color>]`. */
  value: string | null | undefined;
  onChange: (avatarUrl: string) => void;
  /** Heading for the block; defaults to "Icon & colour". */
  label?: string;
  className?: string;
}

/**
 * Picks an AI entity's identity — a built-in icon on a colour, or a photo —
 * and writes it back as one `avatarUrl` string. The same picker is used when
 * creating or editing an agent or a coworker, so every surface offers the
 * same icons and colours and the result looks the same everywhere.
 */
export function AiEntityIdentityPicker({ name, kind = 'agent', value, onChange, label = 'Icon & colour', className }: AiEntityIdentityPickerProps) {
  const uploadId = useId();
  const parsed = parseAiEntityAvatar(value);
  const [source, setSource] = useState<Source>(() =>
    parsed.type === 'photo' ? (parsed.src.startsWith('data:') ? 'upload' : 'url') : 'icon',
  );
  // Remember the last icon + colour so switching to a photo and back doesn't lose them.
  const [lastIcon, setLastIcon] = useState(parsed.type === 'icon' ? parsed.icon : DEFAULT_AI_ENTITY_ICON);
  const [lastColor, setLastColor] = useState(parsed.type === 'icon' && parsed.color ? parsed.color : DEFAULT_AI_ENTITY_COLOR);
  const photo = parsed.type === 'photo' ? parsed.src : '';
  const iconSelected = parsed.type !== 'photo';

  const pickIcon = (icon: string, color = lastColor) => {
    setLastIcon(icon);
    setLastColor(color);
    onChange(formatAiEntityIconAvatar(icon, color));
  };

  const switchSource = (next: Source) => {
    setSource(next);
    if (next === 'icon' && !iconSelected) pickIcon(lastIcon);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file (PNG, JPG, SVG or WebP).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Avatar image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && onChange(reader.result);
    reader.onerror = () => toast.error('Couldn’t read that image.');
    reader.readAsDataURL(file);
  };

  return (
    <div role="group" aria-label={label} className={cn('space-y-3 rounded-xl border border-border bg-background p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <SegmentedControl
          aria-label="Avatar source"
          size="sm"
          value={source}
          onChange={switchSource}
          options={[
            { value: 'icon', label: 'Icon' },
            { value: 'upload', label: 'Upload' },
            { value: 'url', label: 'Image URL' },
          ]}
        />
      </div>

      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <AiEntityAvatar name={name || 'AI'} kind={kind} avatarUrl={value} size="lg" />
          <span className="text-2xs text-muted-foreground">Preview</span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {source === 'icon' ? (
            <div role="radiogroup" aria-label="Icon" className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-1.5">
              {AI_ENTITY_ICONS.map((item) => {
                const selected = iconSelected && parsed.type === 'icon' && parsed.icon === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => pickIcon(item.id)}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </button>
                );
              })}
            </div>
          ) : source === 'upload' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input id={uploadId} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              <label
                htmlFor={uploadId}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring"
              >
                <Upload className="size-3.5" aria-hidden />
                Choose image…
              </label>
              <span className="text-2xs text-muted-foreground">PNG, JPG, SVG or WebP, up to 2 MB.</span>
              {photo ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => pickIcon(lastIcon)}>
                  Use an icon instead
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                type="url"
                value={photo.startsWith('data:') ? '' : photo}
                onChange={(e) => (e.target.value.trim() ? onChange(e.target.value.trim()) : pickIcon(lastIcon))}
                placeholder="https://example.com/avatar.png"
                aria-label="Avatar image URL"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-2xs font-medium text-muted-foreground">
              Colour{iconSelected ? '' : ' (used when showing an icon)'}
            </span>
            <div role="radiogroup" aria-label="Colour" className="flex flex-wrap items-center gap-1.5">
              {AI_ENTITY_COLORS.map((c) => {
                // An icon saved without a colour takes its tint from the name, so nothing reads as picked.
                const selected = iconSelected ? parsed.type === 'icon' && parsed.color === c.id : lastColor === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => (iconSelected ? pickIcon(lastIcon, c.id) : setLastColor(c.id))}
                    className={cn(
                      'size-5 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      c.swatch,
                      selected ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100',
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
