import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { focusAudio, type FocusSoundType } from './focus-audio.js';

export interface FocusState {
  isActive: boolean;
  isPaused: boolean;
  durationMinutes: number;
  totalSeconds: number;
  remainingSeconds: number;
  taskObjective: string;
  soundType: FocusSoundType;
  soundVolume: number;
  sessionsCompletedToday: number;
  lastSessionDate: string | null;
  isFocusModalOpen: boolean;
  isStatusModalOpen: boolean;
  autoSetSlackStatus: boolean;

  // Actions
  startFocus: (options: {
    durationMinutes: number;
    taskObjective?: string;
    soundType?: FocusSoundType;
    soundVolume?: number;
    autoSetSlackStatus?: boolean;
  }) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: (completed?: boolean) => void;
  addTime: (minutes: number) => void;
  setSound: (sound: FocusSoundType) => void;
  setVolume: (volume: number) => void;
  tick: () => void;
  openFocusModal: () => void;
  closeFocusModal: () => void;
  openStatusModal: () => void;
  closeStatusModal: () => void;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isPaused: false,
      durationMinutes: 25,
      totalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      taskObjective: '',
      soundType: 'none',
      soundVolume: 0.5,
      sessionsCompletedToday: 0,
      lastSessionDate: null,
      isFocusModalOpen: false,
      isStatusModalOpen: false,
      autoSetSlackStatus: true,

      startFocus: ({
        durationMinutes,
        taskObjective = '',
        soundType = 'none',
        soundVolume = 0.5,
        autoSetSlackStatus = true,
      }) => {
        const total = durationMinutes * 60;
        focusAudio.setSound(soundType, soundVolume);

        set({
          isActive: true,
          isPaused: false,
          durationMinutes,
          totalSeconds: total,
          remainingSeconds: total,
          taskObjective: taskObjective.trim(),
          soundType,
          soundVolume,
          autoSetSlackStatus,
          isFocusModalOpen: false,
        });
      },

      pauseFocus: () => {
        focusAudio.stop();
        set({ isPaused: true });
      },

      resumeFocus: () => {
        const state = get();
        if (state.soundType !== 'none') {
          focusAudio.setSound(state.soundType, state.soundVolume);
        }
        set({ isPaused: false });
      },

      stopFocus: (completed = false) => {
        const state = get();
        focusAudio.stop();

        if (completed) {
          focusAudio.playChime();
          const today = getTodayString();
          const isSameDay = state.lastSessionDate === today;
          const newCount = isSameDay ? state.sessionsCompletedToday + 1 : 1;

          set({
            isActive: false,
            isPaused: false,
            remainingSeconds: state.totalSeconds,
            sessionsCompletedToday: newCount,
            lastSessionDate: today,
          });
        } else {
          set({
            isActive: false,
            isPaused: false,
            remainingSeconds: state.totalSeconds,
          });
        }
      },

      addTime: (minutes: number) => {
        const secondsToAdd = minutes * 60;
        set((state) => ({
          remainingSeconds: state.remainingSeconds + secondsToAdd,
          totalSeconds: state.totalSeconds + secondsToAdd,
        }));
      },

      setSound: (sound: FocusSoundType) => {
        const state = get();
        if (state.isActive && !state.isPaused) {
          focusAudio.setSound(sound, state.soundVolume);
        }
        set({ soundType: sound });
      },

      setVolume: (volume: number) => {
        focusAudio.setVolume(volume);
        set({ soundVolume: volume });
      },

      tick: () => {
        const state = get();
        if (!state.isActive || state.isPaused) return;

        if (state.remainingSeconds <= 1) {
          get().stopFocus(true);
        } else {
          set({ remainingSeconds: state.remainingSeconds - 1 });
        }
      },

      openFocusModal: () => set({ isFocusModalOpen: true }),
      closeFocusModal: () => set({ isFocusModalOpen: false }),
      openStatusModal: () => set({ isStatusModalOpen: true }),
      closeStatusModal: () => set({ isStatusModalOpen: false }),
    }),
    {
      name: 'onetab_focus_store',
      partialize: (state) => ({
        durationMinutes: state.durationMinutes,
        soundType: state.soundType,
        soundVolume: state.soundVolume,
        sessionsCompletedToday: state.sessionsCompletedToday,
        lastSessionDate: state.lastSessionDate,
        autoSetSlackStatus: state.autoSetSlackStatus,
      }),
    },
  ),
);
