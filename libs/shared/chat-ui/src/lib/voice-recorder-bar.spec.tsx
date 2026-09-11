import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recorderState: {
  status: 'idle' | 'requesting' | 'recording' | 'paused' | 'processing' | 'error' | 'unsupported';
  supported: boolean;
  canPause: boolean;
  durationMs: number;
  liveLevel: number;
  liveWaveform: number[];
  error: string | null;
  errorMessage: string | null;
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} = {
  status: 'recording',
  supported: true,
  canPause: true,
  durationMs: 1500,
  liveLevel: 0.4,
  liveWaveform: [0.2, 0.6, 0.4],
  error: null,
  errorMessage: null,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  stop: vi.fn(),
};

vi.mock('@org/hooks', () => ({
  useVoiceRecorder: () => recorderState,
}));

// jsdom has no real media pipeline; the preview `<audio>` just needs play()
// not to throw.
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();

  recorderState.status = 'recording';
  recorderState.canPause = true;
  recorderState.error = null;
  recorderState.errorMessage = null;
  recorderState.start.mockClear();
  recorderState.pause.mockClear();
  recorderState.resume.mockClear();
  recorderState.cancel.mockClear();
  recorderState.stop.mockReset();
});

import { VoiceRecorderBar } from './voice-recorder-bar.js';

const fakeRecording = {
  blob: new Blob(['fake-audio'], { type: 'audio/webm' }),
  mimeType: 'audio/webm',
  durationMs: 3200,
  waveform: [0.1, 0.5, 0.9],
};

describe('VoiceRecorderBar', () => {
  it('starts recording as soon as it mounts', () => {
    render(<VoiceRecorderBar onCancel={vi.fn()} onSent={vi.fn()} onSend={vi.fn()} />);
    expect(recorderState.start).toHaveBeenCalledTimes(1);
  });

  it('cancelling while recording calls recorder.cancel() and onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<VoiceRecorderBar onCancel={onCancel} onSent={vi.fn()} onSend={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel recording' }));
    expect(recorderState.cancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('hides the pause control when the browser cannot pause', () => {
    recorderState.canPause = false;
    render(<VoiceRecorderBar onCancel={vi.fn()} onSent={vi.fn()} onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Pause recording' })).not.toBeInTheDocument();
  });

  it('shows a requesting-permission notice with a way to back out', async () => {
    recorderState.status = 'requesting';
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<VoiceRecorderBar onCancel={onCancel} onSent={vi.fn()} onSend={vi.fn()} />);

    expect(screen.getByText('Allow microphone access…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the error notice and closes back out on Close', async () => {
    recorderState.status = 'error';
    recorderState.errorMessage = 'Microphone access was denied.';
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<VoiceRecorderBar onCancel={onCancel} onSent={vi.fn()} onSend={vi.fn()} />);

    expect(screen.getByText('Microphone access was denied.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('stopping moves into preview with play/delete/re-record/send', async () => {
    recorderState.stop.mockResolvedValue(fakeRecording);
    const user = userEvent.setup();
    render(<VoiceRecorderBar onCancel={vi.fn()} onSent={vi.fn()} onSend={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(recorderState.stop).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole('button', { name: 'Delete recording' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play voice message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-record' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send voice message' })).toBeInTheDocument();
    expect(screen.getByText('0:03')).toBeInTheDocument();
  });

  it('deleting the preview discards it and calls onCancel', async () => {
    recorderState.stop.mockResolvedValue(fakeRecording);
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<VoiceRecorderBar onCancel={onCancel} onSent={vi.fn()} onSend={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByRole('button', { name: 'Delete recording' });
    await user.click(screen.getByRole('button', { name: 'Delete recording' }));

    expect(recorderState.cancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('re-record discards the take and starts a fresh recording', async () => {
    recorderState.stop.mockResolvedValue(fakeRecording);
    const user = userEvent.setup();
    render(<VoiceRecorderBar onCancel={vi.fn()} onSent={vi.fn()} onSend={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByRole('button', { name: 'Re-record' });
    recorderState.start.mockClear();

    await user.click(screen.getByRole('button', { name: 'Re-record' }));
    expect(recorderState.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Delete recording' })).not.toBeInTheDocument();
  });

  it('sends the recorded blob and closes the bar after the confirmation beat', async () => {
    // Real timers throughout — the 500ms confirmation delay is short enough
    // to just wait out, and mixing fake timers with userEvent's own internal
    // waiting is a well-known source of hangs.
    recorderState.stop.mockResolvedValue(fakeRecording);
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onSent = vi.fn();
    render(<VoiceRecorderBar onCancel={vi.fn()} onSent={onSent} onSend={onSend} />);

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByRole('button', { name: 'Send voice message' });
    await user.click(screen.getByRole('button', { name: 'Send voice message' }));

    expect(onSend).toHaveBeenCalledWith(
      fakeRecording.blob,
      {
        durationMs: fakeRecording.durationMs,
        waveform: fakeRecording.waveform,
        mimeType: fakeRecording.mimeType,
      },
      expect.any(Function),
    );

    expect(onSent).not.toHaveBeenCalled();
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it('shows Retry (not re-record) when sending fails, and retries the same blob', async () => {
    recorderState.stop.mockResolvedValue(fakeRecording);
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(undefined);
    render(<VoiceRecorderBar onCancel={vi.fn()} onSent={vi.fn()} onSend={onSend} />);

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByRole('button', { name: 'Send voice message' });
    await user.click(screen.getByRole('button', { name: 'Send voice message' }));

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByText('Could not send this voice message.')).toBeInTheDocument();

    await user.click(retryButton);
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    // Retried with the exact same take, not a fresh recording.
    expect(onSend.mock.calls[1][0]).toBe(fakeRecording.blob);
  });
});
