/**
 * Bookmarks / "Save for later" without the chat runtime: importable from any
 * surface (task cards, docs, files) without pulling in matrix-js-sdk.
 */
export {
  useBookmarks,
  useBookmarkMutations,
  useBookmarkToggle,
  useSaveForLater,
  type SaveForLaterTarget,
} from './lib/use-bookmarks.js';
export {
  useChannelMemberBookmarks,
  useDirectMessageBookmarks,
} from './lib/use-dm-bookmarks.js';
