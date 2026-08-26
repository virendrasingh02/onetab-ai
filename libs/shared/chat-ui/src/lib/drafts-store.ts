import { create } from 'zustand';

export interface ConversationDraft {
  text: string;
  updatedAt: number;
}

interface DraftsState {
  drafts: Record<string, ConversationDraft>;
  getDraft: (conversationId: string | null | undefined) => string;
  setDraft: (conversationId: string | null | undefined, text: string) => void;
  clearDraft: (conversationId: string | null | undefined) => void;
}

const STORAGE_KEY = 'onetab_chat_drafts';

function loadInitialDrafts(): Record<string, ConversationDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistDrafts(drafts: Record<string, ConversationDraft>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore storage quota errors
  }
}

export const useDraftsStore = create<DraftsState>((set, get) => ({
  drafts: loadInitialDrafts(),

  getDraft: (conversationId) => {
    if (!conversationId) return '';
    return get().drafts[conversationId]?.text ?? '';
  },

  setDraft: (conversationId, text) => {
    if (!conversationId) return;
    const trimmed = text;
    set((state) => {
      let updated: Record<string, ConversationDraft>;
      if (!trimmed || trimmed.trim() === '') {
        const next = { ...state.drafts };
        delete next[conversationId];
        updated = next;
      } else {
        updated = {
          ...state.drafts,
          [conversationId]: {
            text: trimmed,
            updatedAt: Date.now(),
          },
        };
      }
      persistDrafts(updated);
      return { drafts: updated };
    });
  },

  clearDraft: (conversationId) => {
    if (!conversationId) return;
    set((state) => {
      const next = { ...state.drafts };
      delete next[conversationId];
      persistDrafts(next);
      return { drafts: next };
    });
  },
}));
