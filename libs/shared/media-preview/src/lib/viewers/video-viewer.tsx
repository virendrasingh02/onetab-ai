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
import {
  Gauge,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
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

export interface VideoViewerProps {
  item: MediaItem;
  url: string;
}

export function VideoViewer({ item, url }: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  useMediaPreviewKeys(true, { onPlayPause: togglePlay });

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setLoaded(false);
  }, [url]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={wrapperRef} className="relative flex size-full flex-col items-center justify-center">
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border-white/20 border-t-white/70 size-10 animate-spin rounded-full border-2" aria-hidden />
        </div>
      ) : null}

      <video
        ref={videoRef}
        src={url}
        preload="metadata"
        className="max-h-full max-w-full"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setLoaded(true);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onClick={togglePlay}
        aria-label={item.name}
      />

      <div className="gap-2 px-3 py-2 flex w-full max-w-2xl shrink-0 flex-col border-t border-white/10 bg-black/30 text-white">
        <Slider
          value={[current]}
          min={0}
          max={duration || 1}
          step={0.1}
          onValueChange={([value]) => {
            if (videoRef.current) videoRef.current.currentTime = value;
            setCurrent(value);
          }}
        />
        <div className="gap-2 flex items-center justify-between text-xs">
          <div className="gap-1 flex items-center">
            <Hint label={playing ? 'Pause' : 'Play'} shortcut="Space">
              <IconButton
                variant="ghost"
                size="icon-sm"
                aria-label={playing ? 'Pause' : 'Play'}
                onClick={togglePlay}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                {playing ? <Pause /> : <Play />}
              </IconButton>
            </Hint>
            <span className="tabular-nums text-white/70">
              {formatTime(current)} / {formatTime(duration)}
            </span>
          </div>

          <div className="gap-1 flex items-center">
            <IconButton
              variant="ghost"
              size="icon-sm"
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <VolumeIcon />
            </IconButton>
            <div className="w-16">
              <Slider
                value={[muted ? 0 : volume]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([value]) => {
                  setVolume(value);
                  setMuted(value === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = value;
                    videoRef.current.muted = value === 0;
                  }
                }}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Playback speed"
                  className={cn('text-white hover:bg-white/10 hover:text-white', speed !== 1 && 'text-white')}
                >
                  <Gauge />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SPEEDS.map((value) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => {
                      setSpeed(value);
                      if (videoRef.current) videoRef.current.playbackRate = value;
                    }}
                  >
                    {value}x {value === speed ? '✓' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {typeof document !== 'undefined' && 'pictureInPictureEnabled' in document ? (
              <Hint label="Picture in picture">
                <IconButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Picture in picture"
                  onClick={() => void videoRef.current?.requestPictureInPicture?.()}
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <PictureInPicture2 />
                </IconButton>
              </Hint>
            ) : null}

            <Hint label="Fullscreen video">
              <IconButton
                variant="ghost"
                size="icon-sm"
                aria-label="Fullscreen video"
                onClick={() => void videoRef.current?.requestFullscreen?.()}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Maximize />
              </IconButton>
            </Hint>
          </div>
        </div>
      </div>
    </div>
  );
}
