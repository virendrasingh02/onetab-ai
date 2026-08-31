import type { Attachment, GeneratedFile, MessageKind } from '@org/types';
import { getMediaType } from './get-media-type.js';
import type { MediaItem } from './types.js';

export interface MediaUploaderContext {
  senderId?: string;
  senderName?: string;
  senderAvatarUrl?: string;
  senderPresence?: 'online' | 'busy' | 'away' | 'offline';
  senderStatusEmoji?: string;
  senderStatusText?: string;
  timestamp?: number | string | Date;
  channelName?: string;
  isEncrypted?: boolean;
}

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
  uploaderContext?: MediaUploaderContext,
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
    senderId: uploaderContext?.senderId,
    senderName: uploaderContext?.senderName,
    senderAvatarUrl: uploaderContext?.senderAvatarUrl,
    senderPresence: uploaderContext?.senderPresence,
    senderStatusEmoji: uploaderContext?.senderStatusEmoji,
    senderStatusText: uploaderContext?.senderStatusText,
    timestamp: uploaderContext?.timestamp,
    channelName: uploaderContext?.channelName,
    isEncrypted: uploaderContext?.isEncrypted,
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
    // Attributed to the assistant; `GeneratedFile` carries no creation time,
    // so the banner shows just the name rather than a fabricated "now".
    senderName: 'OneTab AI',
  };
}
