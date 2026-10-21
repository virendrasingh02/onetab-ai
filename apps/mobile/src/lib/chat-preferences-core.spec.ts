import { describe, expect, it } from 'vitest';
import {
  getPreferencesKey,
  parsePreferences,
  serializePreferences,
  toggleItemInList,
  loadChatPreferences,
  saveChatPreferences,
  type ChatPreferencesState,
} from './chat-preferences-core';
import type { KeyValueStore } from './session-core';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}

describe('chat-preferences-core', () => {
  it('generates isolated key per workspace', () => {
    expect(getPreferencesKey('ws_123')).toBe('onetab.chat.prefs.ws_123');
  });

  it('parses valid preferences JSON', () => {
    const raw = JSON.stringify({
      pinned: ['!room1:server', 'general'],
      muted: ['!room2:server'],
      archived: ['random'],
    });
    const parsed = parsePreferences(raw);
    expect(parsed.pinned).toEqual(['!room1:server', 'general']);
    expect(parsed.muted).toEqual(['!room2:server']);
    expect(parsed.archived).toEqual(['random']);
  });

  it('handles corrupted or empty JSON safely', () => {
    expect(parsePreferences(null)).toEqual({
      pinned: [],
      muted: [],
      archived: [],
    });
    expect(parsePreferences('')).toEqual({
      pinned: [],
      muted: [],
      archived: [],
    });
    expect(parsePreferences('{ invalid json')).toEqual({
      pinned: [],
      muted: [],
      archived: [],
    });
    expect(parsePreferences('{"pinned": "not-an-array"}')).toEqual({
      pinned: [],
      muted: [],
      archived: [],
    });
  });

  it('toggles items into and out of list', () => {
    const list = ['a', 'b'];
    expect(toggleItemInList(list, 'c')).toEqual(['c', 'a', 'b']);
    expect(toggleItemInList(list, 'a')).toEqual(['b']);
  });

  it('serializes preferences state', () => {
    const state: ChatPreferencesState = {
      pinned: ['a'],
      muted: [],
      archived: [],
    };
    expect(serializePreferences(state)).toContain('"pinned":["a"]');
  });

  it('loads and saves preferences to key value store', async () => {
    const store = memoryStore();
    const state: ChatPreferencesState = {
      pinned: ['r1'],
      muted: ['r2'],
      archived: [],
    };
    await saveChatPreferences(store, 'ws_1', state);
    const loaded = await loadChatPreferences(store, 'ws_1');
    expect(loaded).toEqual(state);
  });
});
