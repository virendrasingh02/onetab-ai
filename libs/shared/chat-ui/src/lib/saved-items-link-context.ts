import { createContext, useContext } from 'react';

/**
 * Opens the viewer's Saved page focused on one saved message — the host
 * owns routing, so the "Saved for later · View Saved" marker only calls this.
 * Absent (no provider) the marker renders without the link.
 */
export type SavedItemsOpener = (messageId: string) => void;

const SavedItemsLinkContext = createContext<SavedItemsOpener | null>(null);

export const SavedItemsLinkProvider = SavedItemsLinkContext.Provider;

export function useSavedItemsOpener(): SavedItemsOpener | null {
  return useContext(SavedItemsLinkContext);
}
