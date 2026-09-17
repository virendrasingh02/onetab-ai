import { linkPreviewApi } from '@org/api-client';
import { configureLinkPreviewApi } from '@org/chat-ui';
import { useEffect } from 'react';

/**
 * Supplies `@org/chat-ui`'s `useLinkPreviewStore` the one thing it cannot get
 * on its own: the actual `linkPreviewApi` calls. `@org/chat-ui` is `type:ui`
 * and may not depend on `@org/api-client` (`type:data-access`) — the same
 * boundary `AuthenticatedMediaBridge` works around for authenticated media —
 * so the app wires it in here, once, near the root. Mounted as a leaf
 * alongside `CallOverlayBridge`; it renders nothing of its own.
 */
export function LinkPreviewBridge() {
  useEffect(() => {
    configureLinkPreviewApi({
      getPreview: linkPreviewApi.getPreview,
      updateMessageVisibility: linkPreviewApi.updateMessageVisibility,
      getMessageVisibility: linkPreviewApi.getMessageVisibility,
    });
    return () => configureLinkPreviewApi(null);
  }, []);

  return null;
}
