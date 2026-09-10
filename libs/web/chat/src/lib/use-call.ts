import type { Call, CallKind, CallState } from '@org/matrix-client';
import { useCallback, useEffect, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface UseCallResult {
  call: Call | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  state: CallState | null;
  isIncoming: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreensharing: boolean;
  startCall: (roomId: string, kind: CallKind) => Promise<Call>;
  answerCall: (kind?: CallKind) => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  setMuted: (muted: boolean) => Promise<void>;
  setVideoEnabled: (enabled: boolean) => Promise<void>;
  setScreensharingEnabled: (enabled: boolean) => Promise<boolean>;
}

/**
 * Hook to manage Matrix WebRTC calls.
 * Connects directly to the CallManager on the active OneTabMatrixClient.
 */
export function useCall(): UseCallResult {
  const { client } = useMatrix();
  const manager = client?.getCallManager();

  const [call, setCall] = useState<Call | null>(() => manager?.getActiveCall() ?? null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(() => manager?.getLocalStream() ?? null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(() => manager?.getRemoteStream() ?? null);
  const [isMuted, setIsMuted] = useState<boolean>(() => manager?.isMuted() ?? false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(() => manager?.isVideoEnabled() ?? true);
  const [isScreensharing, setIsScreensharing] = useState<boolean>(() => manager?.isScreensharing() ?? false);

  useEffect(() => {
    if (!manager) {
      setCall(null);
      setLocalStream(null);
      setRemoteStream(null);
      return;
    }

    const syncState = (updatedCall: Call) => {
      setCall({ ...updatedCall });
      setLocalStream(manager.getLocalStream());
      setRemoteStream(manager.getRemoteStream());
      setIsMuted(manager.isMuted());
      setIsVideoEnabled(manager.isVideoEnabled());
      setIsScreensharing(manager.isScreensharing());
    };

    const unsub = manager.on((c) => {
      syncState(c);
    });

    const current = manager.getActiveCall();
    if (current) {
      syncState(current);
    }

    return () => {
      unsub();
    };
  }, [manager]);

  const startCall = useCallback(
    async (roomId: string, kind: CallKind) => {
      if (!manager) throw new Error('Chat client is not connected.');
      const newCall = await manager.startCall(roomId, kind);
      setCall({ ...newCall });
      setLocalStream(manager.getLocalStream());
      setRemoteStream(manager.getRemoteStream());
      return newCall;
    },
    [manager],
  );

  const answerCall = useCallback(
    async (kind?: CallKind) => {
      if (!manager) return;
      await manager.answerCall(kind);
      const active = manager.getActiveCall();
      if (active) setCall({ ...active });
      setLocalStream(manager.getLocalStream());
      setRemoteStream(manager.getRemoteStream());
    },
    [manager],
  );

  const rejectCall = useCallback(() => {
    if (!manager) return;
    manager.rejectCall();
    setCall(manager.getActiveCall());
  }, [manager]);

  const hangUp = useCallback(() => {
    if (!manager) return;
    manager.hangUp();
    setCall(manager.getActiveCall());
    setLocalStream(null);
    setRemoteStream(null);
  }, [manager]);

  const setMuted = useCallback(
    async (muted: boolean) => {
      if (!manager) return;
      await manager.setMuted(muted);
      setIsMuted(manager.isMuted());
    },
    [manager],
  );

  const setVideoEnabled = useCallback(
    async (enabled: boolean) => {
      if (!manager) return;
      await manager.setVideoEnabled(enabled);
      setIsVideoEnabled(manager.isVideoEnabled());
    },
    [manager],
  );

  const setScreensharingEnabled = useCallback(
    async (enabled: boolean) => {
      if (!manager) return false;
      const res = await manager.setScreensharingEnabled(enabled);
      setIsScreensharing(res);
      return res;
    },
    [manager],
  );

  return {
    call,
    localStream,
    remoteStream,
    state: call?.state ?? null,
    isIncoming: call?.isIncoming ?? false,
    isMuted,
    isVideoEnabled,
    isScreensharing,
    startCall,
    answerCall,
    rejectCall,
    hangUp,
    setMuted,
    setVideoEnabled,
    setScreensharingEnabled,
  };
}
