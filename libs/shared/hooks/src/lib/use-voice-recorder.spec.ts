import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceRecorder } from './use-voice-recorder.js';

class FakeTrack {
  stop = vi.fn();
}

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(
    (type: string) => type === 'audio/webm;codecs=opus',
  );
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob; size: number }) => void) | null =
    null;
  onstop: (() => void) | null = null;

  constructor(
    public stream: unknown,
    options?: { mimeType?: string },
  ) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {
    this.state = 'recording';
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    const blob = new Blob(['fake-audio'], { type: this.mimeType });
    this.ondataavailable?.({ data: blob, size: blob.size });
    this.onstop?.();
  }
}

let getUserMedia: ReturnType<typeof vi.fn>;

function installMediaRecorder() {
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder =
    FakeMediaRecorder;
}

function removeMediaRecorder() {
  // @ts-expect-error — cleaned up between tests
  delete globalThis.MediaRecorder;
}

function installGetUserMedia(
  impl: () => Promise<{ getTracks: () => FakeTrack[] }> = async () => ({
    getTracks: () => [new FakeTrack()],
  }),
) {
  getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    installMediaRecorder();
    installGetUserMedia();
  });

  afterEach(() => {
    removeMediaRecorder();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
  });

  it('reports unsupported and never calls getUserMedia when MediaRecorder does not exist', async () => {
    removeMediaRecorder();
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.supported).toBe(false);

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('unsupported');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('goes idle → requesting → recording, then produces a recording on stop()', async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('recording');
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    let recording: Awaited<ReturnType<typeof result.current.stop>> = null;
    await act(async () => {
      recording = await result.current.stop();
    });
    if (!recording) throw new Error('expected stop() to resolve a recording');
    expect(recording.mimeType).toContain('audio/');
    expect(recording.blob.size).toBeGreaterThan(0);
    // Fixed-length waveform even for a take with no live samples collected.
    expect(recording.waveform).toHaveLength(40);
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('supports pause/resume when the browser MediaRecorder does', async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.canPause).toBe(true);

    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');

    act(() => result.current.resume());
    expect(result.current.status).toBe('recording');
  });

  it('cancel() discards the take, stops all tracks, and resets to idle', async () => {
    let tracks: FakeTrack[] = [];
    installGetUserMedia(async () => {
      tracks = [new FakeTrack(), new FakeTrack()];
      return { getTracks: () => tracks };
    });

    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => {
      await result.current.start();
    });

    act(() => result.current.cancel());
    expect(result.current.status).toBe('idle');
    expect(result.current.durationMs).toBe(0);
    for (const track of tracks) expect(track.stop).toHaveBeenCalled();
  });

  it('maps a permission-denied getUserMedia rejection to a clear error', async () => {
    installGetUserMedia(async () => {
      throw new DOMException('blocked', 'NotAllowedError');
    });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('permission-denied');
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('maps a device-in-use rejection to device-unavailable', async () => {
    installGetUserMedia(async () => {
      throw new DOMException('busy', 'NotReadableError');
    });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('device-unavailable');
  });
});
