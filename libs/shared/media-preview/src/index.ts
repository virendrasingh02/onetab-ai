export { attachmentToMediaItem, generatedFileToMediaItem } from './lib/adapters.js';
export { canRenderPreview, extensionFromName, getMediaType } from './lib/get-media-type.js';
export {
  MediaPreviewProvider,
  type MediaPreviewProviderProps,
} from './lib/media-preview-provider.js';
export {
  MediaThumbnail,
  MediaPreviewTrigger,
  type MediaThumbnailProps,
  type MediaPreviewTriggerProps,
} from './lib/media-thumbnail.js';
export { downloadMediaItem } from './lib/download-media-item.js';
export { useMediaPreview, type UseMediaPreviewResult } from './lib/use-media-preview.js';
export type { MediaCategory, MediaItem, MediaPreviewState } from './lib/types.js';
