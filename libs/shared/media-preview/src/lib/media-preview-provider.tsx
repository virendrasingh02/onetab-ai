import type { ReactNode } from 'react';
import { MediaPreviewModal } from './media-preview-modal.js';

export interface MediaPreviewProviderProps {
  children: ReactNode;
}

/**
 * Mount once near the app root, alongside `<Toaster/>`. Preview state lives
 * in a module-level zustand store (`useMediaPreviewStore`), the same pattern
 * `useRightPanelStore` uses — so this isn't a React Context provider despite
 * the name; it just renders the modal as a permanent sibling of the app so
 * `useMediaPreview().openPreview(...)` works from anywhere without prop
 * drilling.
 */
export function MediaPreviewProvider({ children }: MediaPreviewProviderProps) {
  return (
    <>
      {children}
      <MediaPreviewModal />
    </>
  );
}
