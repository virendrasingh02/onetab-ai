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
});
