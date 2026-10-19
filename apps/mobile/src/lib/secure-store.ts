import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { KeyValueStore } from './session-core';

/**
 * The iOS Keychain / Android Keystore-backed store. Entries never leave the
 * device (no iCloud/backup migration) and are readable only after the first
 * unlock, so a background push handler can still reach them.
 * On web, falls back to localStorage.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStore: KeyValueStore = {
  get: (key) => {
    if (Platform.OS === 'web') {
      try {
        return Promise.resolve(
          typeof localStorage !== 'undefined'
            ? localStorage.getItem(key)
            : null,
        );
      } catch {
        return Promise.resolve(null);
      }
    }
    return SecureStore.getItemAsync(key, options);
  },
  set: (key, value) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined')
          localStorage.setItem(key, value);
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }
    return SecureStore.setItemAsync(key, value, options);
  },
  remove: (key) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }
    return SecureStore.deleteItemAsync(key, options);
  },
};
