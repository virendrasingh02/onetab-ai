import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSpeechToText } from './use-speech-to-text.js';

class FakeSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
}

let lastInstance: FakeSpeechRecognition | null = null;
function captureInstance(instance: FakeSpeechRecognition) {
  lastInstance = instance;
}

/** Stands in for the vendor-prefixed constructor — captures each instance it
 *  creates so tests can drive its event handlers directly. A plain
 *  `Object.assign(this, new FakeSpeechRecognition())` would copy over method
 *  references whose `this` is still lexically bound to that throwaway donor
 *  instance (they're arrow-function class fields), so `recognition.stop()`
 *  would fire `donor.onend` instead of the real instance's — subclassing
 *  keeps `this` correct throughout. */
function installSpeechRecognition() {
  class TrackedSpeechRecognition extends FakeSpeechRecognition {
    constructor() {
      super();
      captureInstance(this);
    }
  }
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
    TrackedSpeechRecognition;
}

function removeSpeechRecognition() {
  // @ts-expect-error — cleaned up between tests
  delete window.webkitSpeechRecognition;
  // @ts-expect-error — cleaned up between tests
  delete window.SpeechRecognition;
}

describe('useSpeechToText', () => {
  afterEach(() => {
    removeSpeechRecognition();
    lastInstance = null;
  });

  it('reports unsupported when no speech-recognition API exists (Firefox)', () => {
    const { result } = renderHook(() => useSpeechToText());
    expect(result.current.supported).toBe(false);
  });

  it('accumulates final transcript and surfaces interim text separately', () => {
    installSpeechRecognition();
    const { result } = renderHook(() => useSpeechToText());
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    expect(lastInstance?.start).toHaveBeenCalled();

    act(() => {
      lastInstance?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: 'hello world' }, length: 1 }],
      });
    });
    expect(result.current.finalText).toBe('hello world');
    expect(result.current.interimText).toBe('');

    act(() => {
      lastInstance?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: 'and mo' }, length: 1 }],
      });
    });
    expect(result.current.interimText).toBe('and mo');
    // Interim text never lands in the confirmed transcript.
    expect(result.current.finalText).toBe('hello world');
  });

  it('stop() ends the session and clears listening', () => {
    installSpeechRecognition();
    const { result } = renderHook(() => useSpeechToText());

    act(() => result.current.start());
    act(() => result.current.stop());

    expect(lastInstance?.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('reset() clears both final and interim text', () => {
    installSpeechRecognition();
    const { result } = renderHook(() => useSpeechToText());
    act(() => result.current.start());
    act(() => {
      lastInstance?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: 'hi' }, length: 1 }],
      });
    });
    expect(result.current.finalText).toBe('hi');

    act(() => result.current.reset());
    expect(result.current.finalText).toBe('');
    expect(result.current.interimText).toBe('');
  });
});
