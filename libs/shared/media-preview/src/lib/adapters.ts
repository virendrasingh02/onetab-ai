import type { Attachment, GeneratedFile, MessageKind } from '@org/types';
import { getMediaType } from './get-media-type.js';
import type { MediaItem } from './types.js';

/**
 * Chat's Matrix-resolved attachment. `kind` (from the message, already
 * classified server/mapper-side) is trusted over a mimeType guess for the
 * image/video/voice cases — it's how the existing `AttachmentRenderer`
 * decides which inline renderer to use, so the preview should agree with it.
 */
export function attachmentToMediaItem(
  attachment: Attachment,
  kind?: MessageKind,
  id = attachment.url,
): MediaItem {
  const category =
    kind === 'image' || kind === 'video'
      ? kind
      : kind === 'voice'
        ? 'audio'
        : getMediaType(attachment.mimeType, attachment.name);

  return {
    id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    category,
    size: attachment.size,
    url: attachment.url,
    thumbnailUrl: attachment.thumbnailUrl,
    width: attachment.width,
    height: attachment.height,
    duration: attachment.duration,
    waveform: attachment.waveform,
  };
}

/**
 * An AI-generated/agent output file. A `codeSnippet` renders instantly via
 * `inlineText` — no network fetch needed for something the model already
 * returned inline.
 */
export function generatedFileToMediaItem(
  file: GeneratedFile,
  index = 0,
): MediaItem {
  const category = file.codeSnippet
    ? 'text'
    : getMediaType(file.mimeType, file.name);

  return {
    id: file.id ?? `${file.url}-${index}`,
    name: file.name,
    mimeType: file.mimeType,
    category,
    size: file.size,
    url: file.url,
    thumbnailUrl: file.previewUrl,
    inlineText: file.codeSnippet?.code,
    language: file.codeSnippet?.language,
    isDiff: file.codeSnippet?.isDiff,
  };
}
