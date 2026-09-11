import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment } from '@org/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentGrid, ImagePreview, VoiceMessage } from './attachments.js';

const { downloadMediaItem } = vi.hoisted(() => ({
  downloadMediaItem: vi.fn(async () => undefined),
}));
vi.mock('@org/media-preview', () => ({ downloadMediaItem }));

function baseAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    name: 'voice-message.weba',
    mimeType: 'audio/webm',
    url: 'https://cdn.example.com/voice-message.weba',
    duration: 4300, // ms — matches how `sendFile`'s voice option and the
    // MSC1767 mapper store it (see use-voice-recorder.ts / mappers.ts).
    ...overrides,
  };
}

beforeAll(() => {
  // jsdom has no real media pipeline — playback here only needs to not throw.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

describe('VoiceMessage', () => {
  it('shows the duration as mm:ss and starts paused', () => {
    render(<VoiceMessage attachment={baseAttachment()} />);
    expect(screen.getByText('0:04')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Play voice message' }),
    ).toBeInTheDocument();
  });

  it('toggles play/pause on click', async () => {
    const user = userEvent.setup();
    render(<VoiceMessage attachment={baseAttachment()} />);

    await user.click(screen.getByRole('button', { name: 'Play voice message' }));
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Pause voice message' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause voice message' }));
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('falls back to a flat 32-bar waveform when the sender sent none', () => {
    const { container } = render(
      <VoiceMessage attachment={baseAttachment({ waveform: undefined })} />,
    );
    expect(container.querySelectorAll('[role="img"] span')).toHaveLength(32);
  });

  it('renders exactly the sent waveform when present', () => {
    const { container } = render(
      <VoiceMessage
        attachment={baseAttachment({ waveform: [0.1, 0.5, 0.9, 0.2] })}
      />,
    );
    expect(container.querySelectorAll('[role="img"] span')).toHaveLength(4);
  });

  it('cycles playback speed 1× → 1.5× → 2× → 1× and applies it to the element', async () => {
    const user = userEvent.setup();
    const { container } = render(<VoiceMessage attachment={baseAttachment()} />);
    const speedButton = screen.getByRole('button', { name: /Playback speed/ });
    const audio = container.querySelector('audio') as HTMLAudioElement;

    expect(speedButton).toHaveTextContent('1×');

    await user.click(speedButton);
    expect(speedButton).toHaveTextContent('1.5×');
    expect(audio.playbackRate).toBe(1.5);

    await user.click(speedButton);
    expect(speedButton).toHaveTextContent('2×');
    expect(audio.playbackRate).toBe(2);

    await user.click(speedButton);
    expect(speedButton).toHaveTextContent('1×');
    expect(audio.playbackRate).toBe(1);
  });

  it('offers a download link to the resolved audio source', () => {
    render(<VoiceMessage attachment={baseAttachment({ name: 'clip.weba' })} />);
    const link = screen.getByRole('link', { name: 'Download voice message' });
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/voice-message.weba');
    expect(link).toHaveAttribute('download', 'clip.weba');
  });
});

describe('ImagePreview', () => {
  beforeEach(() => {
    downloadMediaItem.mockClear();
  });

  it('renders the original image, never the homeserver-generated thumbnail', () => {
    render(
      <ImagePreview
        attachment={baseAttachment({
          name: 'photo.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/photo-original.png',
          thumbnailUrl: 'https://cdn.example.com/photo-thumb-480.png',
        })}
      />,
    );

    expect(screen.getByAltText('photo.png')).toHaveAttribute(
      'src',
      'https://cdn.example.com/photo-original.png',
    );
  });

  it('shows the filename and size, and downloads on click without opening the lightbox', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <ImagePreview
        attachment={baseAttachment({
          name: 'photo.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/photo-original.png',
          size: 2_400_000,
        })}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText('2.3 MB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download photo.png' }));

    expect(downloadMediaItem).toHaveBeenCalledWith(
      'https://cdn.example.com/photo-original.png',
      'photo.png',
    );
    // The download button sits inside the "open" region — it must not also
    // open the lightbox.
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('AttachmentGrid', () => {
  beforeEach(() => {
    downloadMediaItem.mockClear();
  });

  function threeImages() {
    return [
      {
        attachment: baseAttachment({
          name: 'a.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/a.png',
          size: 1000,
        }),
        kind: 'image',
      },
      {
        attachment: baseAttachment({
          name: 'b.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/b.png',
          size: 2000,
        }),
        kind: 'image',
      },
      {
        attachment: baseAttachment({
          name: 'c.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/c.png',
          size: 3000,
        }),
        kind: 'image',
      },
    ];
  }

  it('shows each tile\'s filename and size, and downloads just that one on click', async () => {
    const user = userEvent.setup();
    const items = threeImages();
    render(<AttachmentGrid items={items} />);

    expect(screen.getByText('a.png')).toBeInTheDocument();
    expect(screen.getByText('1000 B')).toBeInTheDocument();
    expect(screen.getByText('b.png')).toBeInTheDocument();
    expect(screen.getByText('c.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download b.png' }));

    expect(downloadMediaItem).toHaveBeenCalledTimes(1);
    expect(downloadMediaItem).toHaveBeenCalledWith('https://cdn.example.com/b.png', 'b.png');
  });

  it('does not open the lightbox for the tile whose download button was clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const items = threeImages().map((item) => ({ ...item, onOpen }));
    render(<AttachmentGrid items={items} />);

    await user.click(screen.getByRole('button', { name: 'Download a.png' }));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('downloads every file in the burst, in order, from "download all"', async () => {
    const user = userEvent.setup();
    const items = threeImages();
    render(<AttachmentGrid items={items} />);

    await user.click(screen.getByRole('button', { name: 'Download all 3 files' }));

    expect(downloadMediaItem).toHaveBeenCalledTimes(3);
    expect(downloadMediaItem).toHaveBeenNthCalledWith(1, 'https://cdn.example.com/a.png', 'a.png');
    expect(downloadMediaItem).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/b.png', 'b.png');
    expect(downloadMediaItem).toHaveBeenNthCalledWith(3, 'https://cdn.example.com/c.png', 'c.png');
  });

  it('tiles images at full quality and videos at their poster thumbnail', () => {
    render(
      <AttachmentGrid
        items={[
          {
            attachment: baseAttachment({
              name: 'a.png',
              mimeType: 'image/png',
              url: 'https://cdn.example.com/a-original.png',
              thumbnailUrl: 'https://cdn.example.com/a-thumb.png',
            }),
            kind: 'image',
          },
          {
            attachment: baseAttachment({
              name: 'b.mp4',
              mimeType: 'video/mp4',
              url: 'https://cdn.example.com/b-original.mp4',
              thumbnailUrl: 'https://cdn.example.com/b-poster.png',
            }),
            kind: 'video',
          },
        ]}
      />,
    );

    expect(screen.getByAltText('a.png')).toHaveAttribute(
      'src',
      'https://cdn.example.com/a-original.png',
    );
    // A video tile can't play back the raw file as an <img> — it has to stay
    // on the sender's poster.
    expect(screen.getByAltText('b.mp4')).toHaveAttribute(
      'src',
      'https://cdn.example.com/b-poster.png',
    );
  });
});
