import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  IconButton,
  Slider,
} from '@org/ui';
import { cn } from '@org/utils';
import { Gauge, Music, Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types.js';
import { useMediaPreviewKeys } from '../use-media-preview-keys.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface AudioViewerProps {
  item: MediaItem;
  url: string;
}

/** No waveform data outside chat's voice messages (`Attachment.waveform`) —
 * generated/uploaded audio always uses the flat-bar fallback, same as
 * `VoiceMessage` in `@org/chat-ui` does today. */
export function AudioViewer({ item, url }: AudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  const samples = item.waveform?.length ? item.waveform : Array.from({ length: 40 }, () => 0.35);
  const progress = duration ? current / duration : 0;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  useMediaPreviewKeys(true, { onPlayPause: togglePlay });

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [url]);

  return (
    <div className="flex size-full items-center justify-center p-6">
      <div className="w-full max-w-md gap-4 p-6 flex flex-col rounded-2xl border border-border bg-surface shadow-overlay">
        <div className="gap-2 flex items-center text-foreground">
          <Music className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{item.name}</span>
        </div>

        <audio
          ref={audioRef}
          src={url}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />

        <div className="gap-3 flex items-center">
          <Hint label={playing ? 'Pause' : 'Play'} shortcut="Space">
            <IconButton variant="secondary" size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
              {playing ? <Pause /> : <Play />}
            </IconButton>
          </Hint>

          <div
            className="h-10 flex flex-1 cursor-pointer items-center gap-px"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={current}
            tabIndex={0}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - rect.left) / rect.width;
              if (audioRef.current) audioRef.current.currentTime = ratio * duration;
            }}
          >
            {samples.map((sample, index) => (
              <span
                key={index}
                className={cn(
                  'flex-1 rounded-full transition-colors',
                  index / samples.length <= progress ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
                style={{ height: `${Math.max(15, sample * 100)}%` }}
              />
            ))}
          </div>

          <span className="w-20 text-xs text-right text-muted-foreground tabular-nums">
            {formatTime(current)} / {formatTime(duration)}
          </span>
        </div>

        <div className="gap-4 flex items-center justify-between">
          <div className="gap-2 flex flex-1 items-center">
            <Volume2 className="size-3.5 text-muted-foreground" />
            <Slider
              value={[volume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([value]) => {
                setVolume(value);
                if (audioRef.current) audioRef.current.volume = value;
              }}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="icon-sm" aria-label="Playback speed">
                <Gauge />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SPEEDS.map((value) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => {
                    setSpeed(value);
                    if (audioRef.current) audioRef.current.playbackRate = value;
                  }}
                >
                  {value}x {value === speed ? '✓' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
