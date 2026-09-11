import { useVoiceRecorder, type VoiceRecording } from '@org/hooks';
import { Button, Hint } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  Check,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { WaveformBars } from './waveform-bars.js';

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface VoiceRecorderBarProps {
  /** Recording/preview was abandoned — nothing was sent. */
  onCancel: () => void;
  /** A message sent successfully — the host closes the bar. */
  onSent: () => void;
  onSend: (
    blob: Blob,
    meta: { durationMs: number; waveform: number[]; mimeType: string },
    onProgress?: (percent: number) => void,
  ) => void | Promise<void>;
  className?: string;
}

type SendPhase = 'idle' | 'uploading' | 'sent' | 'failed';

/**
 * Replaces the composer's normal input row while a voice message is being
 * recorded, previewed, or sent — the full state machine from mic tap through
 * delivery. Recording itself is delegated entirely to `useVoiceRecorder`
 * (`@org/hooks`); this component only adds the record→preview→send UI and
 * the post-record send lifecycle around it.
 */
export function VoiceRecorderBar({
  onCancel,
  onSent,
  onSend,
  className,
}: VoiceRecorderBarProps) {
  const recorder = useVoiceRecorder();
  const [take, setTake] = useState<VoiceRecording | null>(null);
  const [sendPhase, setSendPhase] = useState<SendPhase>('idle');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const previewUrlRef = useRef<string | null>(null);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void recorder.start();
    // Fires exactly once, when the bar first mounts (the composer only
    // renders it after the mic button is tapped) — recording should begin
    // immediately, not wait for a second click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The preview blob needs an object URL for local playback before it has
  // gone anywhere near the server; revoke it on re-record/unmount so a fast
  // record→delete→record loop never leaks blob URLs.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const previewUrl = (() => {
    if (!take) return null;
    if (!previewUrlRef.current) {
      previewUrlRef.current = URL.createObjectURL(take.blob);
    }
    return previewUrlRef.current;
  })();

  const discardTake = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setTake(null);
    setPreviewPlaying(false);
    setPreviewProgress(0);
    setSendPhase('idle');
    setSendError(null);
  };

  const handleCancel = () => {
    recorder.cancel();
    discardTake();
    onCancel();
  };

  const handleStopToPreview = async () => {
    const recording = await recorder.stop();
    if (recording) setTake(recording);
    else handleCancel();
  };

  const handleReRecord = () => {
    discardTake();
    void recorder.start();
  };

  const togglePreviewPlayback = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewPlaying) audio.pause();
    else void audio.play();
    setPreviewPlaying(!previewPlaying);
  };

  const handleSend = async () => {
    if (!take) return;
    setSendPhase('uploading');
    setUploadPercent(0);
    setSendError(null);
    try {
      await onSend(
        take.blob,
        {
          durationMs: take.durationMs,
          waveform: take.waveform,
          mimeType: take.mimeType,
        },
        setUploadPercent,
      );
      setSendPhase('sent');
      // A brief, deliberate confirmation beat rather than an instant cut —
      // matches the rest of the platform's send-confirmation micro-interaction.
      setTimeout(onSent, 500);
    } catch {
      setSendPhase('failed');
      setSendError('Could not send this voice message.');
    }
  };

  const baseClass = cn(
    'flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5',
    className,
  );

  // --- error / unsupported -------------------------------------------------
  if (recorder.status === 'error' || recorder.status === 'unsupported') {
    return (
      <div className={cn(baseClass, 'bg-surface-muted')}>
        <AlertTriangle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs text-muted-foreground">
          {recorder.errorMessage ?? 'Could not record a voice message.'}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          Close
        </Button>
      </div>
    );
  }

  // --- requesting permission ------------------------------------------------
  if (recorder.status === 'requesting') {
    return (
      <div className={baseClass} aria-live="polite">
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs text-muted-foreground">
          Allow microphone access…
        </span>
        <Hint label="Cancel">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel"
            onClick={handleCancel}
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </div>
    );
  }

  // --- preview (recording finished, not sent yet) ---------------------------
  if (take) {
    const durationLabel = formatClock(take.durationMs);
    const busy = sendPhase === 'uploading' || sendPhase === 'sent';

    return (
      <div className={baseClass}>
        <Hint label="Delete recording">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete recording"
            disabled={busy}
            onClick={handleCancel}
          >
            <Trash2 className="size-4" />
          </Button>
        </Hint>

        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={previewPlaying ? 'Pause voice message' : 'Play voice message'}
          disabled={busy}
          onClick={togglePreviewPlayback}
        >
          {previewPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <WaveformBars
          samples={take.waveform}
          progress={previewProgress}
          aria-label={`Voice message preview, ${durationLabel}`}
        />

        <span className="w-9 shrink-0 text-xs text-right text-muted-foreground tabular-nums">
          {durationLabel}
        </span>

        {sendPhase === 'failed' ? (
          <>
            <span className="text-xs text-destructive">{sendError}</span>
            <Button variant="outline" size="sm" onClick={() => void handleSend()}>
              Retry
            </Button>
          </>
        ) : (
          <>
            <Hint label="Re-record">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Re-record"
                disabled={busy}
                onClick={handleReRecord}
              >
                <RotateCcw className="size-4" />
              </Button>
            </Hint>

            <Hint label={sendPhase === 'sent' ? 'Sent' : 'Send voice message'}>
              <Button
                variant="primary"
                size="icon-sm"
                aria-label="Send voice message"
                loading={sendPhase === 'uploading'}
                disabled={busy}
                onClick={() => void handleSend()}
              >
                {sendPhase === 'uploading'
                  ? null
                  : sendPhase === 'sent'
                    ? <Check className="size-4" />
                    : <Send className="size-4" />}
              </Button>
            </Hint>
          </>
        )}

        <audio
          ref={previewAudioRef}
          src={previewUrl ?? undefined}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            if (audio.duration) setPreviewProgress(audio.currentTime / audio.duration);
          }}
          onEnded={() => {
            setPreviewPlaying(false);
            setPreviewProgress(0);
          }}
          className="hidden"
        />

        {sendPhase === 'uploading' ? (
          <span className="sr-only" aria-live="polite">
            Sending voice message, {uploadPercent}%
          </span>
        ) : null}
      </div>
    );
  }

  // --- recording / paused / finishing up -------------------------------------
  const isPaused = recorder.status === 'paused';
  const isProcessing = recorder.status === 'processing';

  return (
    <div className={baseClass}>
      <Hint label="Cancel recording">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel recording"
          disabled={isProcessing}
          onClick={handleCancel}
        >
          <X className="size-4" />
        </Button>
      </Hint>

      <span
        className={cn(
          'size-2.5 shrink-0 rounded-full',
          isPaused ? 'bg-muted-foreground' : 'bg-destructive motion-safe:animate-pulse',
        )}
        aria-hidden
      />

      <WaveformBars
        samples={recorder.liveWaveform}
        live={!isPaused}
        aria-label={isPaused ? 'Recording paused' : 'Recording in progress'}
      />

      <span
        className="w-9 shrink-0 text-xs text-right text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {formatClock(recorder.durationMs)}
      </span>

      {recorder.canPause ? (
        <Hint label={isPaused ? 'Resume recording' : 'Pause recording'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            disabled={isProcessing}
            onClick={isPaused ? recorder.resume : recorder.pause}
          >
            {isPaused ? <Mic className="size-4" /> : <Pause className="size-4" />}
          </Button>
        </Hint>
      ) : null}

      <Hint label="Stop recording">
        <Button
          variant="primary"
          size="icon-sm"
          aria-label="Stop recording"
          loading={isProcessing}
          onClick={() => void handleStopToPreview()}
        >
          {isProcessing ? null : <Check className="size-4" />}
        </Button>
      </Hint>
    </div>
  );
}
