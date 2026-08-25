import type { Attachment, GeneratedFile } from '@org/types';
import { attachmentToMediaItem, generatedFileToMediaItem } from './adapters.js';

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    name: 'photo.png',
    mimeType: 'image/png',
    url: 'https://example.test/media/photo.png',
    ...overrides,
  };
}

describe('attachmentToMediaItem', () => {
  it('carries through the resolved fields', () => {
    const attachment = makeAttachment({
      size: 1024,
      thumbnailUrl: 'https://example.test/media/photo-thumb.png',
      width: 800,
      height: 600,
    });

    const item = attachmentToMediaItem(attachment, 'image');

    expect(item).toMatchObject({
      id: attachment.url,
      name: 'photo.png',
      mimeType: 'image/png',
      category: 'image',
      size: 1024,
      url: attachment.url,
      thumbnailUrl: attachment.thumbnailUrl,
      width: 800,
      height: 600,
    });
  });

  it('maps a voice message kind to the audio category', () => {
    const attachment = makeAttachment({
      name: 'voice.ogg',
      mimeType: 'audio/ogg',
      waveform: [0.1, 0.5, 0.2],
      duration: 12,
    });

    const item = attachmentToMediaItem(attachment, 'voice');

    expect(item.category).toBe('audio');
    expect(item.waveform).toEqual([0.1, 0.5, 0.2]);
    expect(item.duration).toBe(12);
  });

  it('falls back to MIME-based detection when kind is absent or a plain file', () => {
    const attachment = makeAttachment({
      name: 'report.pdf',
      mimeType: 'application/pdf',
    });

    expect(attachmentToMediaItem(attachment, 'file').category).toBe('pdf');
    expect(attachmentToMediaItem(attachment).category).toBe('pdf');
  });
});

describe('generatedFileToMediaItem', () => {
  it('carries through url-based files', () => {
    const file: GeneratedFile = {
      id: 'file-1',
      name: 'export.csv',
      url: 'https://example.test/generated/export.csv',
      mimeType: 'text/csv',
      size: 512,
    };

    const item = generatedFileToMediaItem(file);

    expect(item).toMatchObject({
      id: 'file-1',
      name: 'export.csv',
      category: 'text',
      url: file.url,
      size: 512,
    });
    expect(item.inlineText).toBeUndefined();
  });

  it('renders a code snippet inline, without needing a network fetch', () => {
    const file: GeneratedFile = {
      name: 'main.ts',
      url: 'https://example.test/generated/main.ts',
      mimeType: 'text/plain',
      codeSnippet: {
        language: 'typescript',
        code: 'export const x = 1;',
      },
    };

    const item = generatedFileToMediaItem(file);

    expect(item.category).toBe('text');
    expect(item.inlineText).toBe('export const x = 1;');
    expect(item.language).toBe('typescript');
    expect(item.isDiff).toBeUndefined();
  });

  it('flags diff snippets', () => {
    const file: GeneratedFile = {
      name: 'patch.diff',
      url: 'https://example.test/generated/patch.diff',
      mimeType: 'text/plain',
      codeSnippet: { language: 'diff', code: '+added\n-removed', isDiff: true },
    };

    expect(generatedFileToMediaItem(file).isDiff).toBe(true);
  });

  it('falls back to an index-based id when the file has none', () => {
    const file: GeneratedFile = {
      name: 'output.png',
      url: 'https://example.test/generated/output.png',
      mimeType: 'image/png',
    };

    expect(generatedFileToMediaItem(file, 3).id).toBe(`${file.url}-3`);
  });
});
