import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const client = {
  sendFile: vi.fn(async () => undefined),
};

vi.mock('./matrix-provider.js', () => ({
  useMatrix: () => ({ client, status: { state: 'connected' }, enabled: true, error: null }),
}));

import { useRoomActions } from './use-chat.js';

describe('useRoomActions().sendVoice', () => {
  it('sends the clip as an MSC3245 voice note via sendFile', async () => {
    client.sendFile.mockClear();
    const { result } = renderHook(() => useRoomActions('!room:hs'));

    const blob = new Blob(['fake-audio'], { type: 'audio/webm;codecs=opus' });
    const onProgress = vi.fn();

    await act(async () => {
      await result.current.sendVoice(
        blob,
        { durationMs: 4200, waveform: [0.1, 0.5, 0.9], mimeType: 'audio/webm;codecs=opus' },
        onProgress,
      );
    });

    expect(client.sendFile).toHaveBeenCalledTimes(1);
    const [roomId, file, options] = client.sendFile.mock.calls[0];
    expect(roomId).toBe('!room:hs');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('voice-message.weba');
    expect((file as File).type).toBe('audio/webm;codecs=opus');
    expect(options).toMatchObject({
      onProgress,
      voice: { durationMs: 4200, waveform: [0.1, 0.5, 0.9] },
    });
  });

  it('forwards threadRootId when replying in a thread', async () => {
    client.sendFile.mockClear();
    const { result } = renderHook(() => useRoomActions('!room:hs'));
    const blob = new Blob(['x'], { type: 'audio/mp4' });

    await act(async () => {
      await result.current.sendVoice(
        blob,
        { durationMs: 1000, waveform: [], mimeType: 'audio/mp4' },
        undefined,
        '$thread-root',
      );
    });

    const [, file, options] = client.sendFile.mock.calls[0];
    expect((file as File).name).toBe('voice-message.m4a');
    expect(options).toMatchObject({ threadRootId: '$thread-root' });
  });

  it('does nothing when there is no room to send into', async () => {
    client.sendFile.mockClear();
    const { result } = renderHook(() => useRoomActions(undefined));

    await act(async () => {
      await result.current.sendVoice(new Blob(['x']), {
        durationMs: 100,
        waveform: [],
        mimeType: 'audio/webm',
      });
    });

    expect(client.sendFile).not.toHaveBeenCalled();
  });
});
