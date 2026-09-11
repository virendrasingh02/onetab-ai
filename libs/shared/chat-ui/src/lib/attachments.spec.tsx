import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment } from '@org/types';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { VoiceMessage } from './attachments.js';

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
