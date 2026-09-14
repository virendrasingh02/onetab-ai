import { create } from 'zustand';

export interface ComposerWarningStoreState {
  /**
   * conversationId -> signature of the unreachable-target-id set the user last dismissed.
   */
  dismissed: Record<string, string>;
  dismiss: (conversationId: string, signature: string) => void;
  isDismissed: (conversationId: string, signature: string) => boolean;
  clearDismissal: (conversationId: string) => void;
}

export const useComposerWarningStore = create<ComposerWarningStoreState>((set, get) => ({
  dismissed: {},
  dismiss: (conversationId, signature) => {
    if (!conversationId) return;
    set((state) => ({
      dismissed: {
        ...state.dismissed,
        [conversationId]: signature,
      },
    }));
  },
  isDismissed: (conversationId, signature) => {
    if (!conversationId) return false;
    return get().dismissed[conversationId] === signature;
  },
  clearDismissal: (conversationId) => {
    if (!conversationId) return;
    set((state) => {
      if (!(conversationId in state.dismissed)) return state;
      const next = { ...state.dismissed };
      delete next[conversationId];
      return { dismissed: next };
    });
  },
}));
