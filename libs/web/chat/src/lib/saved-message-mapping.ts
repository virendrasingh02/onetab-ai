import type {
  BookmarkDto,
  CreateBookmarkInput,
  SavedMessage,
} from '@org/types';

/**
 * Saved messages are `message` bookmarks on the server (`/bookmarks`), like
 * every other saved object: the snapshot needed to render one outside its room
 * rides in the bookmark's metadata. One list, one cache, every device.
 */
export const MESSAGE_BOOKMARK_TYPE = 'message';

export function savedMessageToBookmark(message: SavedMessage): CreateBookmarkInput {
  const body = message.body.trim();
  return {
    targetType: MESSAGE_BOOKMARK_TYPE,
    targetId: message.id,
    title: `${message.senderName || 'Someone'} in ${message.channelName || 'a conversation'}`.slice(0, 500),
    snippet: body ? body.slice(0, 4000) : null,
    tags: [],
    metadata: {
      roomId: message.roomId,
      channelName: message.channelName,
      channelSlug: message.channelSlug,
      senderId: message.senderId,
      senderName: message.senderName,
      senderAvatarUrl: message.senderAvatarUrl,
      sentAt: message.sentAt,
      href: message.href,
    },
  };
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** The snapshot back out of a `message` bookmark. */
export function bookmarkToSavedMessage(bookmark: BookmarkDto): SavedMessage {
  const meta = bookmark.metadata ?? {};
  return {
    id: bookmark.targetId,
    roomId: str(meta['roomId']) ?? '',
    channelName: str(meta['channelName']) ?? '',
    channelSlug: str(meta['channelSlug']),
    senderId: str(meta['senderId']),
    senderName: str(meta['senderName']) ?? '',
    senderAvatarUrl: str(meta['senderAvatarUrl']),
    body: bookmark.snippet ?? '',
    sentAt: typeof meta['sentAt'] === 'number' ? meta['sentAt'] : 0,
    savedAt: new Date(bookmark.createdAt).getTime(),
    href: str(meta['href']),
  };
}
