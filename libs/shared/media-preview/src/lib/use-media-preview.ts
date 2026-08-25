import type { MediaItem } from './types.js';
import { useMediaPreviewStore } from './media-preview-store.js';

export interface UseMediaPreviewResult {
  openPreview: (items: MediaItem[], startIndex?: number) => void;
  closePreview: () => void;
  next: () => void;
  previous: () => void;
  isOpen: boolean;
  activeItem: MediaItem | undefined;
  activeIndex: number;
  count: number;
}

/**
 * Public entry point for opening the shared preview from anywhere in the
 * app — a chat attachment, a generated file, a file-manager row, a search
 * result. Requires `<MediaPreviewProvider>` to be mounted once near the app
 * root (it renders the actual modal; this hook only touches the store).
 */
export function useMediaPreview(): UseMediaPreviewResult {
  const items = useMediaPreviewStore((state) => state.items);
  const activeIndex = useMediaPreviewStore((state) => state.activeIndex);
  const isOpen = useMediaPreviewStore((state) => state.isOpen);
  const open = useMediaPreviewStore((state) => state.open);
  const close = useMediaPreviewStore((state) => state.close);
  const next = useMediaPreviewStore((state) => state.next);
  const previous = useMediaPreviewStore((state) => state.previous);

  return {
    openPreview: open,
    closePreview: close,
    next,
    previous,
    isOpen,
    activeItem: items[activeIndex],
    activeIndex,
    count: items.length,
  };
}
