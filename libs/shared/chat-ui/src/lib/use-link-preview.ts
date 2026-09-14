import type {
  ChatPreferences,
  LinkPreview,
  WorkspacePolicy,
} from '@org/types';
import { useEffect } from 'react';
import { create } from 'zustand';
import { normalizeUrl } from './link-detector.js';

/**
 * `@org/chat-ui` is `type:ui` and may not depend on `@org/api-client`
 * (`type:data-access`) — the same boundary `@org/hooks`' authenticated-media
 * fetcher works around. The app wires the real `linkPreviewApi` calls in once,
 * near the root, via `configureLinkPreviewApi` (see `LinkPreviewBridge` in
 * `@org/web-chat`); unconfigured, previews simply never load and callers fall
 * back to their normal loading/absent state.
 */
export interface LinkPreviewApi {
  getPreview: (url: string) => Promise<LinkPreview>;
  updateMessageVisibility: (
    messageId: string,
    visibility: 'visible' | 'hidden',
  ) => Promise<unknown>;
}

let linkPreviewApi: LinkPreviewApi | null = null;

/** Wires the real API calls in. Pass `null` to tear it down (e.g. sign-out). */
export function configureLinkPreviewApi(api: LinkPreviewApi | null): void {
  linkPreviewApi = api;
}

interface LinkPreviewState {
  previews: Record<string, LinkPreview>;
  loadingUrls: Record<string, boolean>;
  messageOverrides: Record<string, 'visible' | 'hidden'>;
  fetchPreview: (url: string) => Promise<LinkPreview | null>;
  setMessageOverride: (messageId: string, visibility: 'visible' | 'hidden') => void;
  toggleMessageOverride: (
    messageId: string,
    currentVisibility: boolean,
  ) => Promise<void>;
}

// In-flight promise cache for browser request deduplication
const inFlightRequests = new Map<string, Promise<LinkPreview | null>>();

export const useLinkPreviewStore = create<LinkPreviewState>((set, get) => ({
  previews: {},
  loadingUrls: {},
  messageOverrides: {},

  fetchPreview: async (url: string): Promise<LinkPreview | null> => {
    if (!url) return null;
    const normalized = normalizeUrl(url);

    // Return cached preview if available
    const existing = get().previews[normalized];
    if (existing) {
      return existing;
    }

    // Deduplicate in-flight requests
    const inFlight = inFlightRequests.get(normalized);
    if (inFlight) {
      return inFlight;
    }

    const api = linkPreviewApi;
    if (!api) return null;

    set((state) => ({
      loadingUrls: { ...state.loadingUrls, [normalized]: true },
    }));

    const promise = (async () => {
      try {
        const preview = await api.getPreview(url);
        set((state) => ({
          previews: { ...state.previews, [normalized]: preview },
          loadingUrls: { ...state.loadingUrls, [normalized]: false },
        }));
        return preview;
      } catch {
        set((state) => ({
          loadingUrls: { ...state.loadingUrls, [normalized]: false },
        }));
        return null;
      } finally {
        inFlightRequests.delete(normalized);
      }
    })();

    inFlightRequests.set(normalized, promise);
    return promise;
  },

  setMessageOverride: (messageId: string, visibility: 'visible' | 'hidden') => {
    set((state) => ({
      messageOverrides: {
        ...state.messageOverrides,
        [messageId]: visibility,
      },
    }));
  },

  toggleMessageOverride: async (
    messageId: string,
    currentVisibility: boolean,
  ) => {
    const nextVisibility = currentVisibility ? 'hidden' : 'visible';
    // Optimistic local update
    get().setMessageOverride(messageId, nextVisibility);

    if (!linkPreviewApi) return;
    try {
      await linkPreviewApi.updateMessageVisibility(messageId, nextVisibility);
    } catch {
      // Best effort remote sync; local override remains intact
    }
  },
}));

/**
 * Three-Level Priority Precedence evaluation:
 * 1. Explicit per-message choice (user override on this specific message)
 * 2. User global preference (chat.linkPreviewsEnabled, default: true)
 * 3. Workspace policy (linkPreviewsPolicy: ENABLED, OPTIONAL, DISABLED)
 * 4. System default: true
 */
export function resolvePreviewVisibility(params: {
  messageId: string;
  messagePreviews?: LinkPreview[];
  messageOverrides?: Record<string, 'visible' | 'hidden'>;
  userChatPreferences?: Partial<ChatPreferences> | { linkPreviewsEnabled?: boolean };
  workspacePolicy?: WorkspacePolicy;
}): boolean {
  const {
    messageId,
    messageOverrides = {},
    userChatPreferences,
    workspacePolicy,
  } = params;

  // Level 1: Explicit per-message override takes top precedence
  const explicitOverride = messageOverrides[messageId];
  if (explicitOverride === 'visible') return true;
  if (explicitOverride === 'hidden') return false;

  // Level 3 Check: If workspace policy strictly disables link previews
  if (workspacePolicy?.linkPreviewsPolicy === 'DISABLED') {
    return false;
  }

  // If workspace policy forces link previews to be enabled
  if (workspacePolicy?.linkPreviewsPolicy === 'ENABLED') {
    return true;
  }

  // Level 2: User global preference (defaults to true)
  if (typeof userChatPreferences?.linkPreviewsEnabled === 'boolean') {
    return userChatPreferences.linkPreviewsEnabled;
  }

  // Level 4: System default
  return true;
}

/**
 * React hook to fetch and subscribe to preview metadata for a URL.
 */
export function useLinkPreview(url?: string | null) {
  const normalized = url ? normalizeUrl(url) : '';
  const preview = useLinkPreviewStore((s) => (normalized ? s.previews[normalized] : undefined));
  const isLoading = useLinkPreviewStore((s) => (normalized ? !!s.loadingUrls[normalized] : false));
  const fetchPreview = useLinkPreviewStore((s) => s.fetchPreview);

  useEffect(() => {
    if (url && !preview && !isLoading) {
      void fetchPreview(url);
    }
  }, [url, preview, isLoading, fetchPreview]);

  return { preview, isLoading };
}
