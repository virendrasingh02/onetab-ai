import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { secureStore } from './secure-store';

/**
 * On-device AI chat history (the AI chat endpoint is stateless, so the
 * transcript is kept locally).
 *
 * It used to live in SecureStore, whose values are capped around 2 KB — a
 * handful of answers overflowed it and the write failed silently, so history
 * was lost. Native builds now keep one JSON file per user + workspace in the
 * app's private document directory (sandboxed, excluded from other apps);
 * web keeps localStorage. Everything is wiped on sign-out.
 */

const MAX_ITEMS = 50;
const WEB_PREFIX = 'ai_chat_history:';
const isWeb = Platform.OS === 'web';

function legacyKey(workspaceId: string): string {
  return `ai_chat_history:${workspaceId}`;
}

function scopeName(userId: string, workspaceId: string): string {
  return `${userId}_${workspaceId}`.replace(/[^A-Za-z0-9_-]+/g, '_');
}

function historyDirectory(): Directory {
  const dir = new Directory(Paths.document, 'ai-chat-history');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function historyFile(userId: string, workspaceId: string): File {
  return new File(historyDirectory(), `${scopeName(userId, workspaceId)}.json`);
}

function webStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? (list as T[]) : [];
  } catch {
    return [];
  }
}

export async function loadAiChatHistory<T>(
  userId: string,
  workspaceId: string,
): Promise<T[]> {
  if (isWeb) {
    const storage = webStorage();
    const scoped = storage?.getItem(
      WEB_PREFIX + scopeName(userId, workspaceId),
    );
    if (scoped) return parse<T>(scoped);
  } else {
    try {
      const file = historyFile(userId, workspaceId);
      if (file.exists) return parse<T>(await file.text());
    } catch {
      return [];
    }
  }
  // One-time move from the old workspace-only SecureStore key.
  const legacy = await secureStore
    .get(legacyKey(workspaceId))
    .catch(() => null);
  if (!legacy) return [];
  const items = parse<T>(legacy);
  await secureStore.remove(legacyKey(workspaceId)).catch(() => undefined);
  if (items.length) await saveAiChatHistory(userId, workspaceId, items);
  return items;
}

export async function saveAiChatHistory<T>(
  userId: string,
  workspaceId: string,
  items: T[],
): Promise<void> {
  const json = JSON.stringify(items.slice(-MAX_ITEMS));
  if (isWeb) {
    try {
      webStorage()?.setItem(WEB_PREFIX + scopeName(userId, workspaceId), json);
    } catch {
      // Quota exceeded — the in-memory conversation is unaffected.
    }
    return;
  }
  try {
    await historyFile(userId, workspaceId).write(json);
  } catch {
    // Disk full / sandbox error — keep the in-memory conversation.
  }
}

export async function clearAiChatHistory(
  userId: string,
  workspaceId: string,
): Promise<void> {
  await secureStore.remove(legacyKey(workspaceId)).catch(() => undefined);
  if (isWeb) {
    try {
      webStorage()?.removeItem(WEB_PREFIX + scopeName(userId, workspaceId));
    } catch {
      // ignore
    }
    return;
  }
  try {
    const file = historyFile(userId, workspaceId);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}

/** Sign-out: no transcript survives for the next account on this device. */
export function clearAllAiChatHistory(): void {
  if (isWeb) {
    const storage = webStorage();
    if (!storage) return;
    try {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key?.startsWith(WEB_PREFIX)) storage.removeItem(key);
      }
    } catch {
      // ignore
    }
    return;
  }
  try {
    const dir = new Directory(Paths.document, 'ai-chat-history');
    if (dir.exists) dir.delete();
  } catch {
    // ignore
  }
}
