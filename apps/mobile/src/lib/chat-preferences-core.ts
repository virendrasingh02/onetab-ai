import type { KeyValueStore } from './session-core';

export interface ChatPreferencesState {
  pinned: string[];
  muted: string[];
  archived: string[];
}

const STORAGE_KEY_PREFIX = 'onetab.chat.prefs.';

export function getPreferencesKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

export function parsePreferences(json: string | null): ChatPreferencesState {
  if (!json) return { pinned: [], muted: [], archived: [] };
  try {
    const parsed = JSON.parse(json);
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      muted: Array.isArray(parsed.muted) ? parsed.muted : [],
      archived: Array.isArray(parsed.archived) ? parsed.archived : [],
    };
  } catch {
    return { pinned: [], muted: [], archived: [] };
  }
}

export function serializePreferences(state: ChatPreferencesState): string {
  return JSON.stringify(state);
}

export function toggleItemInList(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [item, ...list];
}

export async function loadChatPreferences(
  store: KeyValueStore,
  workspaceId: string,
): Promise<ChatPreferencesState> {
  const raw = await store.get(getPreferencesKey(workspaceId));
  return parsePreferences(raw);
}

export async function saveChatPreferences(
  store: KeyValueStore,
  workspaceId: string,
  state: ChatPreferencesState,
): Promise<void> {
  await store.set(getPreferencesKey(workspaceId), serializePreferences(state));
}
