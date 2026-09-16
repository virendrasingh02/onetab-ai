import { create } from 'zustand';

export interface ScheduledMessage {
  id: string;
  workspaceId?: string;
  conversationId: string;
  channelName?: string;
  body: string;
  scheduledFor: string; // ISO string
  createdAt: string;
  status: 'pending' | 'sent' | 'cancelled';
  sentAt?: string;
}

interface ScheduledMessagesState {
  messages: ScheduledMessage[];
  scheduleMessage: (
    item: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status'>,
  ) => ScheduledMessage;
  cancelScheduledMessage: (id: string) => void;
  rescheduleMessage: (id: string, newScheduledFor: string) => void;
  markAsSent: (id: string) => void;
  deleteScheduledMessage: (id: string) => void;
  clearAll: () => void;
}

const STORAGE_KEY = 'onetab_scheduled_messages';

function loadInitialMessages(): ScheduledMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistMessages(messages: ScheduledMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore quota errors
  }
}

export const useScheduledMessagesStore = create<ScheduledMessagesState>(
  (set) => ({
    messages: loadInitialMessages(),

    scheduleMessage: (item) => {
      const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newMessage: ScheduledMessage = {
        ...item,
        id,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      set((state) => {
        const next = [newMessage, ...state.messages];
        persistMessages(next);
        return { messages: next };
      });

      return newMessage;
    },

    cancelScheduledMessage: (id: string) => {
      set((state) => {
        const next = state.messages.map((m) =>
          m.id === id ? { ...m, status: 'cancelled' as const } : m,
        );
        persistMessages(next);
        return { messages: next };
      });
    },

    rescheduleMessage: (id: string, newScheduledFor: string) => {
      set((state) => {
        const next = state.messages.map((m) =>
          m.id === id
            ? {
                ...m,
                scheduledFor: newScheduledFor,
                status: 'pending' as const,
              }
            : m,
        );
        persistMessages(next);
        return { messages: next };
      });
    },

    markAsSent: (id: string) => {
      set((state) => {
        const next = state.messages.map((m) =>
          m.id === id
            ? {
                ...m,
                status: 'sent' as const,
                sentAt: new Date().toISOString(),
              }
            : m,
        );
        persistMessages(next);
        return { messages: next };
      });
    },

    deleteScheduledMessage: (id: string) => {
      set((state) => {
        const next = state.messages.filter((m) => m.id !== id);
        persistMessages(next);
        return { messages: next };
      });
    },

    clearAll: () => {
      persistMessages([]);
      set({ messages: [] });
    },
  }),
);
