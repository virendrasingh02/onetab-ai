import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Recording lifecycle. Deliberately stops at the raw take — what happens to
 * it afterwards (upload/send/retry) is the caller's concern, not the
 * recorder's, so this hook stays reusable for anything that needs a
 * microphone (voice messages today; huddle/meeting mic controls later, per
 * the platform's "one reusable audio layer" rule) rather than baking in a
 * chat-specific send flow.
 */
export type VoiceRecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'error'
  | 'unsupported';

export type VoiceRecorderErrorReason =
  | 'permission-denied'
  | 'device-unavailable'
  | 'unsupported'
  | 'unknown';

export interface VoiceRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** Normalised 0..1 samples, fixed length — matches `Attachment.waveform`. */
  waveform: number[];
}

export interface UseVoiceRecorderResult {
  status: VoiceRecorderStatus;
  /** Static feature check (`getUserMedia` + `MediaRecorder` both exist) — use
   *  this to hide the mic button entirely before the user ever clicks it. */
  supported: boolean;
  /** Whether this browser's `MediaRecorder` supports pause/resume at all. */
  canPause: boolean;
  durationMs: number;
  /** Current input amplitude, 0..1 — drives a live pulse/meter. */
  liveLevel: number;
  /** Rolling waveform for the in-progress recording (fixed-length window). */
  liveWaveform: number[];
  error: VoiceRecorderErrorReason | null;
  errorMessage: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** Discards everything and returns to `idle`. */
  cancel: () => void;
  stop: () => Promise<VoiceRecording | null>;
}

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
];

/** Best supported recording mime type, or `''` to let the browser pick its
 *  own default (Safari's `MediaRecorder` predates `isTypeSupported` on some
 *  versions), or `null` when `MediaRecorder` itself doesn't exist. */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function isRecorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Static feature check, for hosts that want to hide the "record" affordance
 * entirely on an unsupported browser without mounting the (comparatively
 * heavy — it opens an `AudioContext` while active) recorder hook just to
 * read one boolean.
 */
export function isVoiceRecordingSupported(): boolean {
  return isRecorderSupported();
}

function canRecorderPause(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.prototype?.pause === 'function'
  );
}

function classifyGetUserMediaError(err: unknown): {
  reason: VoiceRecorderErrorReason;
  message: string;
} {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        reason: 'permission-denied',
        message: 'Microphone access was denied.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return {
        reason: 'device-unavailable',
        message: 'No microphone was found on this device.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        reason: 'device-unavailable',
        message: 'Your microphone is being used by another application.',
      };
    default:
      return {
        reason: 'unknown',
        message: 'Could not access the microphone.',
      };
  }
}

/** Bucket-averages `raw` into exactly `length` samples, each 0..1, so every
 *  voice message renders the same number of waveform bars regardless of how
 *  long the recording was. A too-short take (below `length` raw samples) is
 *  padded by repeating its last value rather than left sparse. */
function downsampleWaveform(raw: readonly number[], length = 40): number[] {
  if (raw.length === 0) return Array.from({ length }, () => 0.15);
  if (raw.length <= length) {
    const last = raw[raw.length - 1];
    return [...raw, ...Array.from({ length: length - raw.length }, () => last)];
  }
  const bucketSize = raw.length / length;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let max = 0;
    for (let j = start; j < end && j < raw.length; j++) {
      if (raw[j] > max) max = raw[j];
    }
    out.push(max);
  }
  return out;
}

/** How often (ms) live level/waveform/duration are committed to React state
 *  while recording — capped well below animation-frame rate so a long
 *  recording never turns into a render storm. */
const LIVE_SAMPLE_INTERVAL_MS = 100;

/**
 * The reusable microphone-recording engine (brief: "one reusable audio layer,
 * not one implementation per feature"). Owns permission request, capture,
 * live level/waveform, pause/resume, and cleanup; produces a finished
 * `VoiceRecording` on `stop()`. Says nothing about uploading or sending it.
 */
export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [liveLevel, setLiveLevel] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [error, setError] = useState<VoiceRecorderErrorReason | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef(0);
  const segmentStartRef = useRef(0);
  const accumulatedMsRef = useRef(0);
  const mimeTypeRef = useRef('');
  const stopResolveRef = useRef<((rec: VoiceRecording | null) => void) | null>(
    null,
  );

  const teardownStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    recorderRef.current = null;
  }, []);

  // Belt-and-braces: release the mic/AudioContext even if the component
  // unmounts mid-recording (a conversation switch, a route change).
  useEffect(() => teardownStream, [teardownStream]);

  const sampleLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const deviation = Math.abs(buffer[i] - 128) / 128;
      if (deviation > peak) peak = deviation;
    }
    const level = Math.min(1, peak);

    const now = performance.now();
    if (now - lastSampleAtRef.current >= LIVE_SAMPLE_INTERVAL_MS) {
      lastSampleAtRef.current = now;
      samplesRef.current.push(level);
      setLiveLevel(level);
      setLiveWaveform(samplesRef.current.slice(-40));
      setDurationMs(accumulatedMsRef.current + (now - segmentStartRef.current));
    }

    rafRef.current = requestAnimationFrame(sampleLoop);
  }, []);

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return;

    if (!isRecorderSupported()) {
      setStatus('unsupported');
      setError('unsupported');
      setErrorMessage('Voice messages aren’t supported in this browser.');
      return;
    }

    setStatus('requesting');
    setError(null);
    setErrorMessage(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const { reason, message } = classifyGetUserMediaError(err);
      setStatus('error');
      setError(reason);
      setErrorMessage(message);
      return;
    }

    const mimeType = pickMimeType();
    if (mimeType === null) {
      stream.getTracks().forEach((track) => track.stop());
      setStatus('unsupported');
      setError('unsupported');
      setErrorMessage('Voice messages aren’t supported in this browser.');
      return;
    }

    streamRef.current = stream;
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];
    samplesRef.current = [];
    accumulatedMsRef.current = 0;
    lastSampleAtRef.current = 0;
    segmentStartRef.current = performance.now();
    setDurationMs(0);
    setLiveWaveform([]);
    setLiveLevel(0);

    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      }
    } catch {
      // Live waveform is a nicety — recording still works without it.
    }

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeTypeRef.current || recorder.mimeType || 'audio/webm',
      });
      const finished: VoiceRecording = {
        blob,
        mimeType: blob.type,
        durationMs: Math.round(accumulatedMsRef.current),
        waveform: downsampleWaveform(samplesRef.current),
      };
      teardownStream();
      setStatus('idle');
      stopResolveRef.current?.(finished);
      stopResolveRef.current = null;
    };
    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');

    if (analyserRef.current) {
      rafRef.current = requestAnimationFrame(sampleLoop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || status !== 'recording' || !canRecorderPause()) return;
    recorder.pause();
    accumulatedMsRef.current += performance.now() - segmentStartRef.current;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setStatus('paused');
  }, [status]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || status !== 'paused') return;
    recorder.resume();
    segmentStartRef.current = performance.now();
    setStatus('recording');
    if (analyserRef.current) {
      rafRef.current = requestAnimationFrame(sampleLoop);
    }
  }, [status, sampleLoop]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopResolveRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      // Dropping the handler first means the in-flight `onstop` never
      // resolves a recording nobody asked for.
      recorder.onstop = null;
      recorder.stop();
    }
    teardownStream();
    chunksRef.current = [];
    samplesRef.current = [];
    setDurationMs(0);
    setLiveLevel(0);
    setLiveWaveform([]);
    setError(null);
    setErrorMessage(null);
    setStatus('idle');
  }, [teardownStream]);

  const stop = useCallback((): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);

    setStatus('processing');
    if (status === 'recording') {
      accumulatedMsRef.current += performance.now() - segmentStartRef.current;
    }
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }, [status]);

  return {
    status,
    supported: isRecorderSupported(),
    canPause: canRecorderPause(),
    durationMs,
    liveLevel,
    liveWaveform,
    error,
    errorMessage,
    start,
    pause,
    resume,
    cancel,
    stop,
  };
}
