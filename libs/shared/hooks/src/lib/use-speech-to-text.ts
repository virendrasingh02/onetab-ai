import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal shape of the Web Speech API this hook uses — TS's own DOM lib does
 *  not ship types for it, and it only ever exists behind a vendor prefix. */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechToTextOptions {
  lang?: string;
}

export interface UseSpeechToTextResult {
  /** `false` on browsers with no speech-recognition API (Firefox, and any
   *  browser off a secure/localhost origin) — callers should hide the
   *  "dictate" affordance entirely rather than show one that always fails. */
  supported: boolean;
  listening: boolean;
  /** Not-yet-finalised text for the current utterance — display-only, may
   *  still change before it settles into `finalText`. */
  interimText: string;
  /** Confirmed transcript accumulated since the last `reset()`. */
  finalText: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Browser-native speech-to-text (voice → composer text), distinct from voice
 * *messages* (voice → audio attachment, see `useVoiceRecorder`). Text this
 * produces is always meant for the caller to show for review/editing — this
 * hook has no concept of "sending" anything.
 *
 * Purely client-side (`webkitSpeechRecognition`/`SpeechRecognition`); there is
 * no server-side fallback, so `supported` is the caller's cue to hide the
 * feature on browsers without it (Firefox today) instead of rendering a
 * button that can never work.
 */
export function useSpeechToText(
  options: UseSpeechToTextOptions = {},
): UseSpeechToTextResult {
  const { lang } = options;
  const Ctor = getSpeechRecognitionCtor();
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          setFinalText((current) => `${current}${current ? ' ' : ''}${transcript.trim()}`);
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [Ctor, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setInterimText('');
    setFinalText('');
  }, []);

  return {
    supported: !!Ctor,
    listening,
    interimText,
    finalText,
    start,
    stop,
    reset,
  };
}
