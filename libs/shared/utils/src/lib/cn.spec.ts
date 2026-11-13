import { describe, expect, it } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
  it('treats the theme `text-message` size as a font size, not a colour', () => {
    // A colour next to it must not evict it…
    expect(cn('text-message', 'text-foreground')).toBe(
      'text-message text-foreground',
    );
    // …while another font size still overrides it.
    expect(cn('text-message', 'text-sm')).toBe('text-sm');
  });

  it.each(['meta', '2xs', '3xs', 'body-sm', 'body-lg', 'stat'])(
    'treats the theme `text-%s` size as a font size',
    (size) => {
      expect(cn(`text-${size}`, 'text-muted-foreground')).toBe(
        `text-${size} text-muted-foreground`,
      );
      expect(cn(`text-${size}`, 'text-xs')).toBe('text-xs');
    },
  );

  it('resolves semantic radii against the t-shirt scale', () => {
    expect(cn('rounded-lg', 'rounded-card')).toBe('rounded-card');
    expect(cn('rounded-dialog', 'rounded-3xl')).toBe('rounded-3xl');
  });
});
