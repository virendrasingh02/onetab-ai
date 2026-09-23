import { callsApi } from '@org/api-client';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  notificationAudio,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Check,
  Expand,
  FileText,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Settings,
  Signal,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CallSummaryView } from './call-summary-view.js';
import { useMatrix } from './matrix-provider.js';
import { useCall } from './use-call.js';

export function CallModal() {
  const { workspaceId } = useCurrentWorkspace();
  const {
    call,
    localStream,
    remoteStream,
    state,
    isIncoming,
    isMuted,
    isVideoEnabled,
    isScreensharing,
    isMinimized,
    connectionQuality,
    isSpeaking,
    devices,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    answerCall,
    rejectCall,
    hangUp,
    setMuted,
    setVideoEnabled,
    setScreensharingEnabled,
    setMinimized,
    selectAudioInput,
    selectVideoInput,
    selectAudioOutput,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [dbCallId, setDbCallId] = useState<string | null>(null);
  const [postCallData, setPostCallData] = useState<{
    workspaceId: string;
    callId: string;
    title: string;
    duration: number;
  } | null>(null);

  // Audio ringtone during ringing state
  useEffect(() => {
    let ringInterval: ReturnType<typeof setInterval> | null = null;
    if (state === 'ringing') {
      try {
        notificationAudio.play('call', { volume: 0.7 });
      } catch {
        // ignore
      }
      ringInterval = setInterval(() => {
        try {
          notificationAudio.play('call', { volume: 0.7 });
        } catch {
          // ignore
        }
      }, 3000);
    }

    return () => {
      if (ringInterval) {
        clearInterval(ringInterval);
      }
    };
  }, [state]);

  // Sync call session with backend when connected
  useEffect(() => {
    let isMounted = true;
    if (state === 'connected' && workspaceId && call && !dbCallId) {
      callsApi
        .startCall(workspaceId, {
          conversationId: call.roomId,
          title: call.remoteUserId ? `Call with ${call.remoteUserId}` : 'Team Call',
          kind: call.kind === 'video' ? 'VIDEO' : 'AUDIO',
        })
        .then((res) => {
          if (isMounted) {
            setDbCallId(res.id);
          }
        })
        .catch((err) => {
          console.warn('[CallModal] Failed to sync call session with backend:', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [state, workspaceId, call, dbCallId]);

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
      if (selectedAudioOutput) {
        void selectAudioOutput(remoteVideoRef.current, selectedAudioOutput);
      }
    }
  }, [remoteStream, selectedAudioOutput, selectAudioOutput]);

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

  const { client } = useMatrix();

  const handleHangUp = () => {
    if (dbCallId && workspaceId) {
      const endedCallId = dbCallId;
      const callDuration = duration;
      const callTitle = call?.remoteUserId ? `Call with ${call.remoteUserId}` : 'Team Call';
      callsApi.endCall(workspaceId, endedCallId).catch((e) => console.warn(e));
      setPostCallData({
        workspaceId,
        callId: endedCallId,
        title: callTitle,
        duration: callDuration,
      });

      // Post a call-summary card into the Matrix room
      if (client && call?.roomId) {
        client
          .sendStructuredMessage(call.roomId, {
            type: 'mie.call_summary',
            callId: endedCallId,
            title: callTitle,
            durationSeconds: callDuration,
          })
          .catch((e) => console.warn('[CallModal] Failed to post call summary card:', e));
      }
    }
    hangUp();
  };

  useEffect(() => {
    if (state === 'ended' && dbCallId && workspaceId && !postCallData) {
      setPostCallData({
        workspaceId,
        callId: dbCallId,
        title: call?.remoteUserId ? `Call with ${call.remoteUserId}` : 'Team Call',
        duration,
      });
    }
  }, [state, dbCallId, workspaceId, postCallData, call, duration]);

  if (!call || state === 'ended' || state === 'rejected' || state === 'failed' || state === 'timeout') {
    if (postCallData) {
      return (
        <Dialog open={true} onOpenChange={(open) => !open && setPostCallData(null)}>
          <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border shadow-2xl">
            <CallSummaryView
              workspaceId={postCallData.workspaceId}
              callId={postCallData.callId}
              onClose={() => setPostCallData(null)}
            />
          </DialogContent>
        </Dialog>
      );
    }
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 p-4">
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
              aria-label="Decline incoming call"
            >
              <PhoneOff className="size-5" />
            </Button>
            <Button
              variant="default"
              size="lg"
              className="rounded-full size-12 p-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
              onClick={() => void answerCall(call.kind)}
              title="Accept"
              aria-label="Accept incoming call"
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
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 max-w-sm">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <PhoneCall className="size-5 animate-pulse" />
        </div>
        <div className="space-y-0.5 pr-2 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {call.remoteUserId || 'Team Member'}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase shrink-0">
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
          className="size-9 rounded-full p-0 shrink-0"
          onClick={hangUp}
          title="Cancel"
          aria-label="Cancel call"
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>
    );
  }

  // 3. Minimized Floating Call Dock
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
        <div className="relative">
          <Avatar className="size-9 border border-border" />
          <span
            className={cn(
              'absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background',
              isSpeaking ? 'bg-emerald-400 ring-emerald-500/50 animate-pulse' : 'bg-emerald-500',
            )}
          />
        </div>
        <div className="min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
              {call.remoteUserId || 'Call'}
            </span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {formatDuration(duration)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Signal className="size-2.5 text-emerald-500" />
            <span className="capitalize">{connectionQuality}</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 pl-1 border-l border-border">
          <Button
            variant={isMuted ? 'destructive' : 'ghost'}
            size="icon-xs"
            className="size-7 rounded-full"
            onClick={() => void setMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-full"
            onClick={() => setMinimized(false)}
            title="Expand call"
            aria-label="Expand call"
          >
            <Expand className="size-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="icon-xs"
            className="size-7 rounded-full bg-red-600 hover:bg-red-500"
            onClick={handleHangUp}
            title="End call"
            aria-label="End call"
          >
            <PhoneOff className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // 4. Connected Active Call Surface (Desktop & Overlay)
  const audioInputDevices = devices.filter((d) => d.kind === 'audioinput');
  const videoInputDevices = devices.filter((d) => d.kind === 'videoinput');
  const audioOutputDevices = devices.filter((d) => d.kind === 'audiooutput');

  return (
    <div
      className={cn(
        'fixed z-50 shadow-2xl rounded-3xl overflow-hidden border border-border bg-black/95 transition-all duration-300 flex',
        isNotesOpen
          ? isVideo
            ? 'bottom-6 right-6 w-[940px] max-w-[96vw] h-[540px] flex-row'
            : 'bottom-6 right-6 w-[480px] max-w-[96vw] h-[540px] flex-col'
          : isVideo
          ? 'bottom-6 right-6 w-96 sm:w-[520px] h-[360px] flex-col'
          : 'bottom-6 right-6 w-84 p-4 flex-col gap-3',
      )}
    >
      {/* Video or Voice Core Area */}
      <div className={cn('flex flex-col', isNotesOpen && isVideo ? 'w-1/2 h-full' : 'w-full flex-1 min-h-0')}>
        {isVideo ? (
          <div className="relative flex-1 w-full bg-black/90 flex items-center justify-center overflow-hidden">
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn(
                'size-full object-cover transition-all',
                isSpeaking && 'ring-2 ring-emerald-500/50',
              )}
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

            {/* Call Header badge & Minimize button */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/10 text-white text-xs">
                <span className={cn('size-2 rounded-full', isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500 animate-pulse')} />
                <span className="font-mono text-[11px]">{formatDuration(duration)}</span>
                <span className="text-white/40 text-[10px]">·</span>
                <span className="text-[10px] text-white/70 capitalize">{connectionQuality}</span>
              </div>
            </div>

            <div className="absolute top-3 right-32 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-full bg-black/40 text-white hover:bg-black/60"
                onClick={() => setMinimized(true)}
                title="Minimize call"
                aria-label="Minimize call"
              >
                <Minimize2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <Avatar className="size-10 border border-border" />
                <span
                  className={cn(
                    'absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background',
                    isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500',
                  )}
                />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-foreground truncate">
                  {call.remoteUserId || 'Voice Call'}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>{formatDuration(duration)}</span>
                  <span>·</span>
                  <span className="capitalize">{connectionQuality}</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setMinimized(true)}
              title="Minimize call"
              aria-label="Minimize call"
            >
              <Minimize2 className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Action Controls Bar */}
        <div
          className={cn(
            'flex items-center justify-center gap-2 bg-card/90 backdrop-blur-md p-3 border-t border-border',
            !isVideo && !isNotesOpen && 'border-none p-0 bg-transparent',
          )}
        >
          {/* Mute toggle */}
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="sm"
            className="size-9 rounded-full p-0"
            onClick={() => void setMuted(!isMuted)}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>

          {/* Camera toggle */}
          {isVideo && (
            <Button
              variant={!isVideoEnabled ? 'destructive' : 'outline'}
              size="sm"
              className="size-9 rounded-full p-0"
              onClick={() => void setVideoEnabled(!isVideoEnabled)}
              title={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
              aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              {isVideoEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            </Button>
          )}

          {/* Screenshare toggle */}
          {isVideo && (
            <Button
              variant={isScreensharing ? 'default' : 'outline'}
              size="sm"
              className="size-9 rounded-full p-0"
              onClick={() => void setScreensharingEnabled(!isScreensharing)}
              title={isScreensharing ? 'Stop sharing screen' : 'Share screen'}
              aria-label={isScreensharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <MonitorUp className="size-4" />
            </Button>
          )}

          {/* Device settings dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-9 rounded-full p-0"
                title="Audio & Video Settings"
                aria-label="Audio & Video Settings"
              >
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-64 max-h-72 overflow-y-auto">
              {/* Microphones */}
              {audioInputDevices.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                    <Mic className="size-3" /> Microphones
                  </DropdownMenuLabel>
                  {audioInputDevices.map((d) => (
                    <DropdownMenuItem
                      key={d.deviceId}
                      onClick={() => void selectAudioInput(d.deviceId)}
                      className="text-xs justify-between"
                    >
                      <span className="truncate">{d.label}</span>
                      {selectedAudioInput === d.deviceId && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Cameras */}
              {videoInputDevices.length > 0 && isVideo && (
                <>
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                    <Video className="size-3" /> Cameras
                  </DropdownMenuLabel>
                  {videoInputDevices.map((d) => (
                    <DropdownMenuItem
                      key={d.deviceId}
                      onClick={() => void selectVideoInput(d.deviceId)}
                      className="text-xs justify-between"
                    >
                      <span className="truncate">{d.label}</span>
                      {selectedVideoInput === d.deviceId && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Speakers */}
              {audioOutputDevices.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                    <Volume2 className="size-3" /> Speakers
                  </DropdownMenuLabel>
                  {audioOutputDevices.map((d) => (
                    <DropdownMenuItem
                      key={d.deviceId}
                      onClick={() => {
                        if (remoteVideoRef.current) {
                          void selectAudioOutput(remoteVideoRef.current, d.deviceId);
                        }
                      }}
                      className="text-xs justify-between"
                    >
                      <span className="truncate">{d.label}</span>
                      {selectedAudioOutput === d.deviceId && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Call Notes & Summary Dock Toggle */}
          <Button
            variant={isNotesOpen ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'size-9 rounded-full p-0 transition-colors',
              isNotesOpen && 'bg-primary text-primary-foreground',
            )}
            onClick={() => setIsNotesOpen(!isNotesOpen)}
            title={isNotesOpen ? 'Hide Notes & AI Summary' : 'Call Notes & AI Summary'}
            aria-label={isNotesOpen ? 'Hide Notes & AI Summary' : 'Call Notes & AI Summary'}
          >
            <FileText className="size-4" />
          </Button>

          {/* Hang up */}
          <Button
            variant="destructive"
            size="sm"
            className="size-9 rounded-full p-0 bg-red-600 hover:bg-red-500"
            onClick={handleHangUp}
            title="End Call"
            aria-label="End Call"
          >
            <PhoneOff className="size-4" />
          </Button>
        </div>
      </div>

      {/* Live Docked Notes & Summary Panel */}
      {isNotesOpen && workspaceId && dbCallId && (
        <div
          className={cn(
            'h-full bg-background',
            isVideo ? 'flex-1 border-l border-border' : 'flex-1 border-t border-border min-h-0',
          )}
        >
          <CallSummaryView
            workspaceId={workspaceId}
            callId={dbCallId}
            isLive={true}
            onClose={() => setIsNotesOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
