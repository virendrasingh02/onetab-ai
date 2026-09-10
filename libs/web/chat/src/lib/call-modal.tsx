import { Avatar, Badge, Button } from '@org/ui';
import { cn } from '@org/utils';
import {
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCall } from './use-call.js';

export function CallModal() {
  const {
    call,
    localStream,
    remoteStream,
    state,
    isIncoming,
    isMuted,
    isVideoEnabled,
    isScreensharing,
    answerCall,
    rejectCall,
    hangUp,
    setMuted,
    setVideoEnabled,
    setScreensharingEnabled,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Duration timer for connected calls
  useEffect(() => {
    if (state !== 'connected') {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  if (!call || state === 'ended' || state === 'rejected' || state === 'failed') {
    return null;
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isVideo = call.kind === 'video';

  // 1. Incoming Call Prompt
  if (state === 'ringing' && isIncoming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-6 text-center">
          <div className="relative mx-auto size-20 flex items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/20 opacity-75" />
            <div className="relative size-20 rounded-full border border-border bg-surface-raised flex items-center justify-center text-primary shadow-md">
              <PhoneIncoming className="size-9 animate-bounce" />
            </div>
          </div>

          <div className="space-y-1">
            <Badge variant="outline" className="text-xs uppercase tracking-wider text-primary border-primary/30">
              {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </Badge>
            <h3 className="text-base font-semibold text-foreground">
              {call.remoteUserId || 'Team Member'}
            </h3>
            <p className="text-xs text-muted-foreground">Calling you via Matrix WebRTC</p>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full size-12 p-0 shadow-md hover:bg-destructive/90"
              onClick={rejectCall}
              title="Decline"
            >
              <PhoneOff className="size-5" />
            </Button>
            <Button
              variant="default"
              size="lg"
              className="rounded-full size-12 p-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
              onClick={() => void answerCall(call.kind)}
              title="Accept"
            >
              {isVideo ? <Video className="size-5" /> : <Phone className="size-5" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Outgoing Ringing / Connecting State
  if (state === 'connecting' || (state === 'ringing' && !isIncoming)) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <PhoneCall className="size-5 animate-pulse" />
        </div>
        <div className="space-y-0.5 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {call.remoteUserId || 'Team Member'}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {state === 'ringing' ? 'Ringing...' : 'Connecting...'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isVideo ? 'Matrix Video Call' : 'Matrix Voice Call'}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="size-9 rounded-full p-0"
          onClick={hangUp}
          title="Cancel"
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>
    );
  }

  // 3. Connected Active Call Overlay
  return (
    <div
      className={cn(
        'fixed z-50 shadow-2xl rounded-3xl overflow-hidden border border-border bg-black/95 transition-all duration-300',
        isVideo
          ? 'bottom-6 right-6 w-96 sm:w-[480px] h-[340px] flex flex-col'
          : 'bottom-6 right-6 w-80 p-4 flex flex-col gap-3',
      )}
    >
      {isVideo ? (
        <div className="relative flex-1 w-full bg-black/90 flex items-center justify-center overflow-hidden">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="size-full object-cover"
          />

          {/* Fallback avatar if remote video is empty/off */}
          {!remoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/20">
              <Avatar className="size-16 border-2 border-border shadow-md" />
              <span className="text-xs text-muted-foreground font-medium">
                {call.remoteUserId || 'Connected'}
              </span>
            </div>
          )}

          {/* Local Video Pip */}
          <div className="absolute top-3 right-3 w-28 h-20 rounded-xl overflow-hidden border border-border/80 bg-black/80 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn('size-full object-cover', !isVideoEnabled && 'hidden')}
            />
            {!isVideoEnabled && (
              <div className="size-full flex items-center justify-center bg-muted/40 text-muted-foreground">
                <VideoOff className="size-5" />
              </div>
            )}
          </div>

          {/* Call Header badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/10 text-white text-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px]">{formatDuration(duration)}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-10 border border-border" />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-foreground truncate">
              {call.remoteUserId || 'Voice Call'}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>{formatDuration(duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Controls Bar */}
      <div className={cn('flex items-center justify-center gap-2 bg-card/90 backdrop-blur-md p-3 border-t border-border', !isVideo && 'border-none p-0 bg-transparent')}>
        <Button
          variant={isMuted ? 'destructive' : 'outline'}
          size="sm"
          className="size-9 rounded-full p-0"
          onClick={() => void setMuted(!isMuted)}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>

        {isVideo && (
          <Button
            variant={!isVideoEnabled ? 'destructive' : 'outline'}
            size="sm"
            className="size-9 rounded-full p-0"
            onClick={() => void setVideoEnabled(!isVideoEnabled)}
            title={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {isVideoEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
          </Button>
        )}

        {isVideo && (
          <Button
            variant={isScreensharing ? 'default' : 'outline'}
            size="sm"
            className="size-9 rounded-full p-0"
            onClick={() => void setScreensharingEnabled(!isScreensharing)}
            title={isScreensharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <MonitorUp className="size-4" />
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          className="size-9 rounded-full p-0 bg-red-600 hover:bg-red-500"
          onClick={hangUp}
          title="End Call"
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>
    </div>
  );
}
