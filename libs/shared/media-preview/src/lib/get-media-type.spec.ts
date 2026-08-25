import { canRenderPreview, getMediaType } from './get-media-type.js';

describe('getMediaType', () => {
  it('classifies by MIME type first', () => {
    expect(getMediaType('image/png')).toBe('image');
    expect(getMediaType('image/svg+xml')).toBe('image');
    expect(getMediaType('video/mp4')).toBe('video');
    expect(getMediaType('audio/mpeg')).toBe('audio');
    expect(getMediaType('application/pdf')).toBe('pdf');
    expect(getMediaType('text/plain')).toBe('text');
    expect(getMediaType('application/json')).toBe('text');
    expect(getMediaType('text/csv')).toBe('text');
  });

  it('classifies office documents by MIME type', () => {
    expect(
      getMediaType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('office');
    expect(getMediaType('application/msword')).toBe('office');
    expect(
      getMediaType(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe('office');
  });

  it('classifies archives by MIME type', () => {
    expect(getMediaType('application/zip')).toBe('archive');
  });

  it('falls back to the file extension when the MIME type is missing or generic', () => {
    expect(getMediaType(undefined, 'report.pdf')).toBe('pdf');
    expect(getMediaType('', 'notes.md')).toBe('text');
    // 'application/octet-stream' tells us nothing, so the extension wins —
    // and .zip has one, unlike an unrecognised extension.
    expect(getMediaType('application/octet-stream', 'archive.zip')).toBe(
      'archive',
    );
    expect(getMediaType(undefined, 'photo.heic')).toBe('unknown');
    expect(getMediaType(undefined, 'deck.pptx')).toBe('office');
    expect(getMediaType(undefined, 'clip.mp4')).toBe('video');
    expect(getMediaType(undefined, 'song.mp3')).toBe('audio');
    expect(getMediaType(undefined, 'photo.png')).toBe('image');
  });

  it('returns unknown when nothing matches', () => {
    expect(getMediaType('application/octet-stream')).toBe('unknown');
    expect(getMediaType(undefined, undefined)).toBe('unknown');
    expect(getMediaType(undefined, 'noextension')).toBe('unknown');
  });
});

describe('canRenderPreview', () => {
  it('is true only for categories with a real viewer', () => {
    expect(canRenderPreview('image')).toBe(true);
    expect(canRenderPreview('video')).toBe(true);
    expect(canRenderPreview('audio')).toBe(true);
    expect(canRenderPreview('pdf')).toBe(true);
    expect(canRenderPreview('text')).toBe(true);
  });

  it('is false for office and unknown, which always fall back to download', () => {
    expect(canRenderPreview('office')).toBe(false);
    expect(canRenderPreview('unknown')).toBe(false);
    expect(canRenderPreview('archive')).toBe(false);
  });
});
