import type { LinkPreview, WorkspacePolicy } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureLinkPreviewApi,
  resolvePreviewVisibility,
  useLinkPreviewStore,
} from './use-link-preview.js';

const linkPreviewApi = {
  getPreview: vi.fn(),
  updateMessageVisibility: vi.fn(),
};

describe('use-link-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureLinkPreviewApi(linkPreviewApi);
    useLinkPreviewStore.setState({
      previews: {},
      loadingUrls: {},
      messageOverrides: {},
    });
  });

  describe('resolvePreviewVisibility (Three-Level Precedence)', () => {
    it('Level 1: explicit per-message override "visible" takes precedence over disabled preference and workspace policy', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-1',
        messageOverrides: { 'msg-1': 'visible' },
        userChatPreferences: { linkPreviewsEnabled: false },
        workspacePolicy: { linkPreviewsPolicy: 'DISABLED' } as unknown as WorkspacePolicy,
      });
      expect(visible).toBe(true);
    });

    it('Level 1: explicit per-message override "hidden" takes precedence over enabled preference and workspace policy', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-1',
        messageOverrides: { 'msg-1': 'hidden' },
        userChatPreferences: { linkPreviewsEnabled: true },
        workspacePolicy: { linkPreviewsPolicy: 'ENABLED' } as unknown as WorkspacePolicy,
      });
      expect(visible).toBe(false);
    });

    it('Level 3: workspace policy DISABLED forces previews off when no explicit message override exists', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-2',
        messageOverrides: {},
        userChatPreferences: { linkPreviewsEnabled: true },
        workspacePolicy: { linkPreviewsPolicy: 'DISABLED' } as unknown as WorkspacePolicy,
      });
      expect(visible).toBe(false);
    });

    it('Level 3: workspace policy ENABLED forces previews on when no explicit message override exists', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-2',
        messageOverrides: {},
        userChatPreferences: { linkPreviewsEnabled: false },
        workspacePolicy: { linkPreviewsPolicy: 'ENABLED' } as unknown as WorkspacePolicy,
      });
      expect(visible).toBe(true);
    });

    it('Level 2: user chat preference linkPreviewsEnabled: false turns previews off under OPTIONAL policy', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-3',
        messageOverrides: {},
        userChatPreferences: { linkPreviewsEnabled: false },
        workspacePolicy: { linkPreviewsPolicy: 'OPTIONAL' } as unknown as WorkspacePolicy,
      });
      expect(visible).toBe(false);
    });

    it('Level 2: user chat preference linkPreviewsEnabled: true turns previews on under OPTIONAL policy', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-3',
        messageOverrides: {},
        userChatPreferences: { linkPreviewsEnabled: true },
        workspacePolicy: { linkPreviewsPolicy: 'OPTIONAL' } as unknown as WorkspacePolicy,
      });
      expect(visible).toBe(true);
    });

    it('Level 4: defaults to true when no overrides, preferences, or restrictive policies are specified', () => {
      const visible = resolvePreviewVisibility({
        messageId: 'msg-4',
      });
      expect(visible).toBe(true);
    });
  });

  describe('useLinkPreviewStore', () => {
    const mockPreview: LinkPreview = {
      url: 'https://example.com/article',
      domain: 'example.com',
      title: 'Example Article',
      description: 'An article about example things.',
      status: 'ready',
      fetchedAt: Date.now(),
    };

    it('fetches and caches preview metadata', async () => {
      vi.mocked(linkPreviewApi.getPreview).mockResolvedValueOnce(mockPreview);

      const store = useLinkPreviewStore.getState();
      const res = await store.fetchPreview('https://example.com/article?utm_source=slack');

      expect(res).toEqual(mockPreview);
      expect(linkPreviewApi.getPreview).toHaveBeenCalledTimes(1);

      // Subsequent call for normalized URL returns cached preview without calling API again
      const cached = await store.fetchPreview('https://example.com/article');
      expect(cached).toEqual(mockPreview);
      expect(linkPreviewApi.getPreview).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent in-flight requests for the same normalized URL', async () => {
      let resolvePromise: (val: LinkPreview) => void;
      const delayedPromise = new Promise<LinkPreview>((res) => {
        resolvePromise = res;
      });
      vi.mocked(linkPreviewApi.getPreview).mockReturnValueOnce(delayedPromise);

      const store = useLinkPreviewStore.getState();
      // Trigger two concurrent requests
      const p1 = store.fetchPreview('https://example.com/post');
      const p2 = store.fetchPreview('https://example.com/post?utm_medium=email');

      resolvePromise!(mockPreview);
      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1).toEqual(mockPreview);
      expect(res2).toEqual(mockPreview);
      expect(linkPreviewApi.getPreview).toHaveBeenCalledTimes(1);
    });

    it('toggles message override optimistically and notifies the API', async () => {
      vi.mocked(linkPreviewApi.updateMessageVisibility).mockResolvedValueOnce({
        messageId: 'msg-99',
        visibility: 'hidden',
        updatedAt: Date.now(),
      });

      const store = useLinkPreviewStore.getState();
      // Current visibility is true, so toggling should make it hidden
      await store.toggleMessageOverride('msg-99', true);

      expect(useLinkPreviewStore.getState().messageOverrides['msg-99']).toBe('hidden');
      expect(linkPreviewApi.updateMessageVisibility).toHaveBeenCalledWith('msg-99', 'hidden');

      // Toggling again when hidden should make it visible
      vi.mocked(linkPreviewApi.updateMessageVisibility).mockResolvedValueOnce({
        messageId: 'msg-99',
        visibility: 'visible',
        updatedAt: Date.now(),
      });
      await store.toggleMessageOverride('msg-99', false);

      expect(useLinkPreviewStore.getState().messageOverrides['msg-99']).toBe('visible');
      expect(linkPreviewApi.updateMessageVisibility).toHaveBeenCalledWith('msg-99', 'visible');
    });
  });
});
