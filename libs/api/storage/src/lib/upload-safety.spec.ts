import { describe, expect, it } from 'vitest';
import {
  isActiveContent,
  normalizeMime,
  resolveServeHeaders,
  safeExtension,
} from './upload-safety';

describe('upload safety', () => {
  it('strips MIME parameters so charset tricks cannot dodge the block list', () => {
    expect(normalizeMime('Image/SVG+XML; charset=utf-8')).toBe('image/svg+xml');
    expect(isActiveContent('image/svg+xml; charset=utf-8')).toBe(true);
    expect(isActiveContent('text/html')).toBe(true);
    expect(isActiveContent('text/javascript')).toBe(true);
    expect(isActiveContent('image/png')).toBe(false);
  });

  it('treats a malformed MIME as opaque bytes', () => {
    expect(normalizeMime('not a mime\r\nX: y')).toBe('application/octet-stream');
  });

  it('never serves active content inline or under its own type', () => {
    expect(resolveServeHeaders('text/html', false)).toEqual({
      contentType: 'application/octet-stream',
      disposition: 'attachment',
    });
  });

  it('only inlines inert types, and honours download requests', () => {
    expect(resolveServeHeaders('image/png', false).disposition).toBe('inline');
    expect(resolveServeHeaders('image/png', true).disposition).toBe('attachment');
    expect(resolveServeHeaders('application/zip', false).disposition).toBe('attachment');
  });

  it('derives a traversal-proof storage extension', () => {
    expect(safeExtension('report.pdf')).toBe('.pdf');
    expect(safeExtension(['a.', '..', '..', 'x.txt'].join('\\'))).toBe('.txt');
    expect(safeExtension('evil.p/../../h')).toBe('');
    expect(safeExtension('noext')).toBe('');
  });
});
