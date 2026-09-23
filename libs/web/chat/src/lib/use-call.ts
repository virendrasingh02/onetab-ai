import type {
  Call,
  CallDeviceInfo,
  CallKind,
  CallQuality,
  CallState,
} from '@org/matrix-client';
import { setActiveCallState } from '@org/notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  isMinimized: boolean;
  connectionQuality: CallQuality;
  isSpeaking: boolean;
  devices: CallDeviceInfo[];
  selectedAudioInput: string | null;
  selectedVideoInput: string | null;
  selectedAudioOutput: string | null;
  startCall: (roomId: string, kind: CallKind) => Promise<Call>;
  answerCall: (kind?: CallKind) => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  setMuted: (muted: boolean) => Promise<void>;
  setVideoEnabled: (enabled: boolean) => Promise<void>;
  setScreensharingEnabled: (enabled: boolean) => Promise<boolean>;
  setMinimized: (minimized: boolean) => void;
  selectAudioInput: (deviceId: string) => Promise<boolean>;
  selectVideoInput: (deviceId: string) => Promise<boolean>;
  selectAudioOutput: (element: HTMLMediaElement, deviceId: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
}

/**
 * Hook to manage Matrix WebRTC calls.
 * Connects directly to the CallManager on the active OneTabMatrixClient.
 */
export function useCall(): UseCallResult {
  const { client } = useMatrix();
  const manager = client?.getCallManager();

  const [call, setCall] = useState<Call | null>(() => manager?.getActiveCall() ?? null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(
    () => manager?.getLocalStream() ?? null,
  );
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(
    () => manager?.getRemoteStream() ?? null,
  );
  const [isMuted, setIsMuted] = useState<boolean>(() => manager?.isMuted() ?? false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(
    () => manager?.isVideoEnabled() ?? true,
  );
  const [isScreensharing, setIsScreensharing] = useState<boolean>(
    () => manager?.isScreensharing() ?? false,
  );
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<CallQuality>(
    () => manager?.getConnectionQuality() ?? 'good',
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [devices, setDevices] = useState<CallDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string | null>(null);
  const [selectedVideoInput, setSelectedVideoInput] = useState<string | null>(null);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasInCallRef = useRef<boolean>(false);

  // Sync state from manager
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
      setConnectionQuality(manager.getConnectionQuality());
    };

    const unsubCall = manager.on((c) => {
      syncState(c);
    });

    const unsubQuality = manager.onQuality((q) => {
      setConnectionQuality(q);
    });

    const current = manager.getActiveCall();
    if (current) {
      syncState(current);
    }

    return () => {
      unsubCall();
      unsubQuality();
    };
  }, [manager]);

  // Sync active call state to notification service
  useEffect(() => {
    const isInCall = call?.state === 'connected';
    if (isInCall !== wasInCallRef.current) {
      wasInCallRef.current = isInCall;
      setActiveCallState(isInCall);
    }
  }, [call?.state]);

  // Refresh available devices
  const refreshDevices = useCallback(async () => {
    if (!manager) return;
    const devs = await manager.getDevices();
    setDevices(devs);
  }, [manager]);

  useEffect(() => {
    void refreshDevices();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      const handler = () => void refreshDevices();
      navigator.mediaDevices.addEventListener('devicechange', handler);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handler);
      };
    }
    return undefined;
  }, [refreshDevices]);

  // Active speaker detection on remoteStream
  useEffect(() => {
    if (!remoteStream || call?.state !== 'connected') {
      setIsSpeaking(false);
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current);
        speakingIntervalRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          void audioContextRef.current.close();
        } catch {
          // ignore
        }
        audioContextRef.current = null;
      }
      return;
    }

    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(remoteStream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      speakingIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        setIsSpeaking(average > 15);
      }, 200);
    } catch {
      // Audio context might fail or be restricted before user gesture
    }

    return () => {
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current);
        speakingIntervalRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          void audioContextRef.current.close();
        } catch {
          // ignore
        }
        audioContextRef.current = null;
      }
    };
  }, [remoteStream, call?.state]);

  const startCall = useCallback(
    async (roomId: string, kind: CallKind) => {
      if (!manager) throw new Error('Chat client is not connected.');
      const newCall = await manager.startCall(roomId, kind);
      setCall({ ...newCall });
      setLocalStream(manager.getLocalStream());
      setRemoteStream(manager.getRemoteStream());
      setIsMinimized(false);
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
      setIsMinimized(false);
    },
    [manager],
  );

  const rejectCall = useCallback(() => {
    if (!manager) return;
    manager.rejectCall();
    setCall(manager.getActiveCall());
    setIsMinimized(false);
  }, [manager]);

  const hangUp = useCallback(() => {
    if (!manager) return;
    manager.hangUp();
    setCall(manager.getActiveCall());
    setLocalStream(null);
    setRemoteStream(null);
    setIsMinimized(false);
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

  const selectAudioInput = useCallback(
    async (deviceId: string) => {
      if (!manager) return false;
      const success = await manager.setAudioInputDevice(deviceId);
      if (success) {
        setSelectedAudioInput(deviceId);
        setLocalStream(manager.getLocalStream());
      }
      return success;
    },
    [manager],
  );

  const selectVideoInput = useCallback(
    async (deviceId: string) => {
      if (!manager) return false;
      const success = await manager.setVideoInputDevice(deviceId);
      if (success) {
        setSelectedVideoInput(deviceId);
        setLocalStream(manager.getLocalStream());
      }
      return success;
    },
    [manager],
  );

  const selectAudioOutput = useCallback(
    async (element: HTMLMediaElement, deviceId: string) => {
      if (!manager) return false;
      const success = await manager.setAudioOutputDevice(element, deviceId);
      if (success) {
        setSelectedAudioOutput(deviceId);
      }
      return success;
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
    isMinimized,
    connectionQuality,
    isSpeaking,
    devices,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    startCall,
    answerCall,
    rejectCall,
    hangUp,
    setMuted,
    setVideoEnabled,
    setScreensharingEnabled,
    setMinimized: setIsMinimized,
    selectAudioInput,
    selectVideoInput,
    selectAudioOutput,
    refreshDevices,
  };
}
