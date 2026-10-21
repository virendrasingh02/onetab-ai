import { useCallback, useEffect, useState } from 'react';
import {
  loadChatPreferences,
  saveChatPreferences,
  toggleItemInList,
  type ChatPreferencesState,
} from './chat-preferences-core';
import { secureStore } from './secure-store';

export type { ChatPreferencesState };

/**
 * Hook to read and mutate local pinning, muting, and archiving for chat rooms/channels.
 */
export function useChatPreferences(workspaceId: string) {
  const [prefs, setPrefs] = useState<ChatPreferencesState>({
    pinned: [],
    muted: [],
    archived: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadChatPreferences(secureStore, workspaceId).then((data) => {
      if (active) {
        setPrefs(data);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const togglePin = useCallback(
    async (id: string) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          pinned: toggleItemInList(prev.pinned, id),
        };
        void saveChatPreferences(secureStore, workspaceId, next);
        return next;
      });
    },
    [workspaceId],
  );

  const toggleMute = useCallback(
    async (id: string) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          muted: toggleItemInList(prev.muted, id),
        };
        void saveChatPreferences(secureStore, workspaceId, next);
        return next;
      });
    },
    [workspaceId],
  );

  const toggleArchive = useCallback(
    async (id: string) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          archived: toggleItemInList(prev.archived, id),
        };
        void saveChatPreferences(secureStore, workspaceId, next);
        return next;
      });
    },
    [workspaceId],
  );

  return {
    prefs,
    loaded,
    isPinned: (id: string) => prefs.pinned.includes(id),
    isMuted: (id: string) => prefs.muted.includes(id),
    isArchived: (id: string) => prefs.archived.includes(id),
    togglePin,
    toggleMute,
    toggleArchive,
  };
}
