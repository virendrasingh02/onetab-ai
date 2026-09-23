import { callsApi } from '@org/api-client';
import { isCallLive, type Call, type CallQuality } from '@org/matrix-client';
import {
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
  UserAvatar,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CallSummaryView } from './call-summary-view.js';
import { useMatrix } from './matrix-provider.js';
import { useCall } from './use-call.js';

/** The backend session shadowing one Matrix call. */
interface CallSession {
  matrixCallId: string;
  dbCallId: string | null;
  starting: boolean;
  closing: boolean;
  connectedAt: number | null;
}

interface Peer {
  name: string;
  avatarUrl?: string;
  seed: string;
  /** How the call is labelled: "Call with Ana" (DM) or "#design call" (room). */
  title: string;
}

const QUALITY_LABEL: Record<CallQuality, string> = {
  excellent: 'Excellent connection',
  good: 'Good connection',
  poor: 'Poor connection',
  reconnecting: 'Reconnecting…',
};

const QUALITY_TONE: Record<CallQuality, string> = {
  excellent: 'text-success-text',
  good: 'text-success-text',
  poor: 'text-warning-text',
  reconnecting: 'text-warning-text',
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * The floating call surface for 1:1 Matrix calls — ringing, connecting, the
 * live call (voice or video, docked or minimized) and, after hang-up, the call
 * notes & AI summary.
 *
 * Every Matrix call is shadowed by one backend call session: opened when the
 * call connects (both ends converge on it by Matrix call id) and closed when it
 * ends — whichever side hangs up. The server tells exactly one client that it
 * closed the session, and that client posts the summary card into the chat.
 */
export function CallModal() {
  const { workspaceId } = useCurrentWorkspace();
  const { client } = useMatrix();
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
  // Remote audio plays from one element that outlives every layout switch, so
  // voice calls are audible and minimizing a video call does not mute it.
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [dbCallId, setDbCallId] = useState<string | null>(null);
  const [postCall, setPostCall] = useState<{ workspaceId: string; callId: string } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const session = useRef<CallSession | null>(null);

  const live = isCallLive(state);
  const isVideo = call?.kind === 'video';

  const peer = useMemo<Peer | null>(() => {
    if (!call) return null;
    return resolvePeer(client, call);
    // Only the room and the other party decide who we are talking to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, call?.roomId, call?.remoteUserId]);

  // A new Matrix call starts a fresh session — never the previous call's.
  useEffect(() => {
    if (!call || session.current?.matrixCallId === call.id) return;
    session.current = {
      matrixCallId: call.id,
      dbCallId: null,
      starting: false,
      closing: false,
      connectedAt: null,
    };
    setDbCallId(null);
    setConnectedAt(null);
    setIsNotesOpen(false);
  }, [call]);

  const closeSession = useCallback(
    async (current: CallSession) => {
      if (!workspaceId || !current.dbCallId || current.closing) return;
      current.closing = true;
      const durationSeconds = current.connectedAt
        ? Math.round((Date.now() - current.connectedAt) / 1000)
        : 0;
      setPostCall({ workspaceId, callId: current.dbCallId });
      try {
        const ended = await callsApi.endCall(workspaceId, current.dbCallId);
        // Both ends report the hang-up; only the one that actually closed the
        // session posts the card, so the conversation gets exactly one.
        if (ended.endedNow && client) {
          await client.sendStructuredMessage(ended.conversationId, {
            type: 'mie.call_summary',
            callId: ended.id,
            title: ended.title,
            durationSeconds,
            participantsCount: ended.participants.length,
          });
        }
      } catch (err) {
        console.warn('[CallModal] Failed to close the call session:', err);
      }
    },
    [workspaceId, client],
  );

  // Connected → open (or join) the backend session.
  useEffect(() => {
    const current = session.current;
    if (state !== 'connected' || !workspaceId || !call || !peer || !current) return;
    if (current.connectedAt === null) {
      current.connectedAt = Date.now();
      setConnectedAt(current.connectedAt);
    }
    if (current.dbCallId || current.starting) return;
    current.starting = true;
    callsApi
      .startCall(workspaceId, {
        conversationId: call.roomId,
        matrixCallId: call.id,
        title: peer.title,
        kind: isVideo ? 'VIDEO' : 'AUDIO',
      })
      .then((started) => {
        if (session.current !== current) return;
        current.dbCallId = started.id;
        setDbCallId(started.id);
      })
      .catch((err) => console.warn('[CallModal] Failed to start the call session:', err))
      .finally(() => {
        current.starting = false;
      });
  }, [state, workspaceId, call, peer, isVideo]);

  // Any finish — our hang-up, theirs, a dropped connection — closes the
  // session. Also runs when the session id lands after the call already ended.
  useEffect(() => {
    const current = session.current;
    if (!current || !call || live || !dbCallId) return;
    void closeSession(current);
  }, [live, call, dbCallId, closeSession]);

  // Ringtone while an incoming call rings.
  useEffect(() => {
    if (state !== 'ringing' || !isIncoming) return;
    const ring = () => {
      try {
        notificationAudio.play('call', { volume: 0.7 });
      } catch {
        // Autoplay can be blocked before the first gesture — the prompt still shows.
      }
    };
    ring();
    const interval = setInterval(ring, 3000);
    return () => clearInterval(interval);
  }, [state, isIncoming]);

  // One-second tick for the call timer while connected.
  useEffect(() => {
    if (state !== 'connected') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, isMinimized, isNotesOpen]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, isMinimized, isNotesOpen]);

  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.srcObject = remoteStream;
    if (remoteStream && selectedAudioOutput) {
      void selectAudioOutput(audio, selectedAudioOutput);
    }
  }, [remoteStream, selectedAudioOutput, selectAudioOutput]);

  const duration = connectedAt ? Math.max(0, Math.floor((now - connectedAt) / 1000)) : 0;

  const remoteAudio = (
    <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
  );

  if (!call || !peer || !live) {
    return postCall ? (
      <Dialog open onOpenChange={(open) => !open && setPostCall(null)}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border shadow-overlay">
          <CallSummaryView
            workspaceId={postCall.workspaceId}
            callId={postCall.callId}
            onClose={() => setPostCall(null)}
          />
        </DialogContent>
      </Dialog>
    ) : null;
  }

  // 1. Incoming call prompt
  if (state === 'ringing' && isIncoming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 p-4">
        {remoteAudio}
        <div
          role="alertdialog"
          aria-label={`Incoming ${isVideo ? 'video' : 'voice'} call from ${peer.name}`}
          className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-overlay space-y-6 text-center"
        >
          <div className="relative mx-auto size-20 flex items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/20" />
            <UserAvatar
              name={peer.name}
              src={peer.avatarUrl}
              seed={peer.seed}
              size="xl"
              className="relative size-20 ring-4 ring-surface"
            />
          </div>

          <div className="space-y-1">
            <Badge variant="primary" className="uppercase tracking-wider">
              <PhoneIncoming />
              {isVideo ? 'Incoming video call' : 'Incoming voice call'}
            </Badge>
            <h3 className="text-base font-semibold text-foreground">{peer.name}</h3>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full size-12 p-0"
              onClick={rejectCall}
              aria-label="Decline call"
            >
              <PhoneOff className="size-5" />
            </Button>
            <Button
              size="lg"
              className="rounded-full size-12 p-0 bg-success text-success-foreground hover:bg-success/90"
              onClick={() => void answerCall(call.kind)}
              aria-label="Accept call"
            >
              {isVideo ? <Video className="size-5" /> : <Phone className="size-5" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Outgoing ringing / connecting
  if (state !== 'connected' && state !== 'reconnecting') {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-border bg-surface/95 p-4 shadow-overlay backdrop-blur-md animate-in slide-in-from-bottom-5 max-w-sm">
        {remoteAudio}
        <UserAvatar name={peer.name} src={peer.avatarUrl} seed={peer.seed} size="lg" />
        <div className="space-y-0.5 pr-2 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{peer.name}</span>
            <Badge variant="neutral" className="shrink-0">
              <PhoneCall className="animate-pulse" />
              {state === 'ringing' ? 'Ringing…' : 'Connecting…'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isVideo ? 'Video call' : 'Voice call'}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="size-9 rounded-full p-0 shrink-0"
          onClick={hangUp}
          aria-label="Cancel call"
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>
    );
  }

  const qualityLabel = QUALITY_LABEL[connectionQuality];

  // 3. Minimized dock
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-overlay backdrop-blur-md animate-in slide-in-from-bottom-5">
        {remoteAudio}
        <UserAvatar
          name={peer.name}
          src={peer.avatarUrl}
          seed={peer.seed}
          size="md"
          className={cn(isSpeaking && 'ring-2 ring-success')}
        />
        <div className="min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
              {peer.name}
            </span>
            <span className="font-mono text-[11px] font-semibold text-success-text tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
          <p
            className={cn('text-[10px] flex items-center gap-1', QUALITY_TONE[connectionQuality])}
          >
            <Signal className="size-2.5" />
            <span>{qualityLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 pl-1 border-l border-border">
          <Button
            variant={isMuted ? 'destructive' : 'ghost'}
            size="icon-xs"
            className="size-7 rounded-full"
            onClick={() => void setMuted(!isMuted)}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-full"
            onClick={() => setMinimized(false)}
            aria-label="Expand call"
          >
            <Expand className="size-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="icon-xs"
            className="size-7 rounded-full"
            onClick={hangUp}
            aria-label="End call"
          >
            <PhoneOff className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // 4. Live call surface
  const audioInputDevices = devices.filter((d) => d.kind === 'audioinput');
  const videoInputDevices = devices.filter((d) => d.kind === 'videoinput');
  const audioOutputDevices = devices.filter((d) => d.kind === 'audiooutput');

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex max-w-[96vw] overflow-hidden rounded-3xl border border-border shadow-overlay transition-all duration-300',
        isVideo ? 'bg-black' : 'bg-surface',
        isNotesOpen
          ? isVideo
            ? 'w-[940px] h-[540px] flex-row'
            : 'w-[480px] h-[540px] flex-col'
          : isVideo
            ? 'w-96 sm:w-[520px] h-[360px] flex-col'
            : 'w-84 flex-col',
      )}
    >
      {remoteAudio}
      <div
        className={cn(
          'flex flex-col',
          isNotesOpen && isVideo ? 'w-1/2 h-full' : 'w-full flex-1 min-h-0',
        )}
      >
        {isVideo ? (
          <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
            {/* Audio comes from the shared <audio> sink; this is picture only. */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="size-full object-cover"
            />

            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <UserAvatar name={peer.name} src={peer.avatarUrl} seed={peer.seed} size="xl" />
                <span className="text-xs font-medium text-white/80">{peer.name}</span>
              </div>
            )}

            <div className="absolute top-3 right-3 w-28 h-20 rounded-xl overflow-hidden border border-white/15 bg-black/80 shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={cn('size-full object-cover', !isVideoEnabled && 'hidden')}
              />
              {!isVideoEnabled && (
                <div className="size-full flex items-center justify-center text-white/60">
                  <VideoOff className="size-5" />
                </div>
              )}
            </div>

            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-xs">
              <span
                className={cn(
                  'size-2 rounded-full bg-success',
                  isSpeaking ? 'animate-ping' : 'animate-pulse',
                )}
              />
              <span className="font-mono text-[11px] tabular-nums">{formatDuration(duration)}</span>
              <span className="text-white/40 text-[10px]">·</span>
              <span className="text-[10px] text-white/70">{qualityLabel}</span>
            </div>

            <div className="absolute top-3 right-32">
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                onClick={() => setMinimized(true)}
                aria-label="Minimize call"
              >
                <Minimize2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-4 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                name={peer.name}
                src={peer.avatarUrl}
                seed={peer.seed}
                size="lg"
                className={cn('transition-shadow', isSpeaking && 'ring-2 ring-success')}
              />
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-foreground truncate">{peer.name}</h4>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
                  <span>·</span>
                  <span className={QUALITY_TONE[connectionQuality]}>{qualityLabel}</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 rounded-full"
              onClick={() => setMinimized(true)}
              aria-label="Minimize call"
            >
              <Minimize2 className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Controls */}
        <div
          className={cn(
            'flex items-center justify-center gap-2 p-3',
            isVideo ? 'bg-surface/95 border-t border-border' : 'pt-0',
          )}
        >
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="sm"
            className="size-9 rounded-full p-0"
            onClick={() => void setMuted(!isMuted)}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={isMuted}
          >
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>

          {isVideo && (
            <Button
              variant={!isVideoEnabled ? 'destructive' : 'outline'}
              size="sm"
              className="size-9 rounded-full p-0"
              onClick={() => void setVideoEnabled(!isVideoEnabled)}
              aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
              aria-pressed={!isVideoEnabled}
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
              aria-label={isScreensharing ? 'Stop sharing screen' : 'Share screen'}
              aria-pressed={isScreensharing}
            >
              <MonitorUp className="size-4" />
            </Button>
          )}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-9 rounded-full p-0"
                aria-label="Audio and video settings"
              >
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-64 max-h-72 overflow-y-auto">
              {audioInputDevices.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                    <Mic className="size-3" /> Microphone
                  </DropdownMenuLabel>
                  {audioInputDevices.map((d) => (
                    <DropdownMenuItem
                      key={d.deviceId}
                      onSelect={() => void selectAudioInput(d.deviceId)}
                      className="text-xs justify-between"
                    >
                      <span className="truncate">{d.label}</span>
                      {selectedAudioInput === d.deviceId && (
                        <Check className="size-3.5 text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {videoInputDevices.length > 0 && isVideo && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                    <Video className="size-3" /> Camera
                  </DropdownMenuLabel>
                  {videoInputDevices.map((d) => (
                    <DropdownMenuItem
                      key={d.deviceId}
                      onSelect={() => void selectVideoInput(d.deviceId)}
                      className="text-xs justify-between"
                    >
                      <span className="truncate">{d.label}</span>
                      {selectedVideoInput === d.deviceId && (
                        <Check className="size-3.5 text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {audioOutputDevices.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                    <Volume2 className="size-3" /> Speaker
                  </DropdownMenuLabel>
                  {audioOutputDevices.map((d) => (
                    <DropdownMenuItem
                      key={d.deviceId}
                      onSelect={() => {
                        if (remoteAudioRef.current) {
                          void selectAudioOutput(remoteAudioRef.current, d.deviceId);
                        }
                      }}
                      className="text-xs justify-between"
                    >
                      <span className="truncate">{d.label}</span>
                      {selectedAudioOutput === d.deviceId && (
                        <Check className="size-3.5 text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={isNotesOpen ? 'default' : 'outline'}
            size="sm"
            className="size-9 rounded-full p-0"
            onClick={() => setIsNotesOpen((open) => !open)}
            disabled={!dbCallId}
            aria-label={isNotesOpen ? 'Hide call notes' : 'Call notes and AI summary'}
            aria-pressed={isNotesOpen}
          >
            <FileText className="size-4" />
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="size-9 rounded-full p-0"
            onClick={hangUp}
            aria-label="End call"
          >
            <PhoneOff className="size-4" />
          </Button>
        </div>
      </div>

      {isNotesOpen && workspaceId && dbCallId && (
        <div
          className={cn(
            'h-full min-h-0 bg-background',
            isVideo ? 'flex-1 border-l border-border' : 'flex-1 border-t border-border',
          )}
        >
          <CallSummaryView
            workspaceId={workspaceId}
            callId={dbCallId}
            isLive
            onClose={() => setIsNotesOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/** Who the call is with, by name — never a raw `@user:server` id. */
function resolvePeer(
  client: ReturnType<typeof useMatrix>['client'],
  call: Call,
): Peer {
  let displayName: string | undefined;
  let avatarUrl: string | undefined;
  let roomName: string | undefined;
  let isDirect = true;
  try {
    const room = client?.getRoom(call.roomId);
    roomName = room?.name;
    isDirect = !room || room.kind === 'direct';
    const member = call.remoteUserId
      ? client?.getMembers(call.roomId).find((m) => m.userId === call.remoteUserId)
      : undefined;
    displayName = member?.displayName;
    avatarUrl = member?.avatarUrl;
  } catch {
    // Not synced yet — fall back to the id-derived name below.
  }
  const fallback = call.remoteUserId?.replace(/^@/, '').split(':')[0] || 'Team member';
  const name = displayName || (isDirect ? roomName : undefined) || fallback;
  return {
    name,
    avatarUrl,
    seed: call.remoteUserId ?? call.roomId,
    title: isDirect || !roomName ? `Call with ${name}` : `${roomName} call`,
  };
}
