// LocalStorage wrapper with fallback for mock state persistence
const STORAGE_PREFIX = 'onetab_agent_studio_';

export const storage = {
  get(key, defaultValue = null) {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn(`[storage.get] Error reading ${key}`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn(`[storage.set] Error saving ${key}`, e);
    }
  },

  remove(key) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (e) {
      console.warn(`[storage.remove] Error removing ${key}`, e);
    }
  },

  clear() {
    if (typeof window === 'undefined') return;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keys.push(k);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[storage.clear] Error clearing storage', e);
    }
  },
};
