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

/*
 * `localStorage.setItem` is synchronous and `JSON.stringify`s every draft, so
 * doing it on the keystroke that produced the change janks fast typing. Coalesce
 * the writes: the in-memory store still updates immediately (that's what a
 * conversation switch reads back), only the persistence is deferred — and forced
 * out on tab hide / unload so nothing typed is lost.
 */
const PERSIST_DEBOUNCE_MS = 800;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let queuedDrafts: Record<string, ConversationDraft> | null = null;

function flushDrafts() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (queuedDrafts) {
    persistDrafts(queuedDrafts);
    queuedDrafts = null;
  }
}

function schedulePersist(drafts: Record<string, ConversationDraft>) {
  queuedDrafts = drafts;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (queuedDrafts) {
      persistDrafts(queuedDrafts);
      queuedDrafts = null;
    }
  }, PERSIST_DEBOUNCE_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushDrafts);
  window.addEventListener('beforeunload', flushDrafts);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDrafts();
  });
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
      schedulePersist(updated);
      return { drafts: updated };
    });
  },

  clearDraft: (conversationId) => {
    if (!conversationId) return;
    set((state) => {
      if (!(conversationId in state.drafts)) return state;
      const next = { ...state.drafts };
      delete next[conversationId];
      schedulePersist(next);
      return { drafts: next };
    });
  },
}));
