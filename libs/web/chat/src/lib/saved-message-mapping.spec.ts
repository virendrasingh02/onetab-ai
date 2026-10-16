import { describe, expect, it } from 'vitest';
import type { BookmarkDto, SavedMessage } from '@org/types';
import {
  MESSAGE_BOOKMARK_TYPE,
  bookmarkToSavedMessage,
  savedMessageToBookmark,
} from './saved-message-mapping.js';

const message: SavedMessage = {
  id: '$evt:server',
  roomId: '!room:server',
  channelName: 'general',
  channelSlug: 'general',
  senderId: '@ana:server',
  senderName: 'Ana',
  body: 'Ship it on Friday',
  sentAt: 1_700_000_000_000,
  savedAt: 1_700_000_100_000,
  href: 'c/general?msg=%24evt%3Aserver',
};

describe('saved message ⇄ bookmark', () => {
  it('stores the snapshot in a message bookmark', () => {
    const input = savedMessageToBookmark(message);
    expect(input.targetType).toBe(MESSAGE_BOOKMARK_TYPE);
    expect(input.targetId).toBe(message.id);
    expect(input.title).toBe('Ana in general');
    expect(input.snippet).toBe('Ship it on Friday');
    expect(input.metadata).toMatchObject({
      roomId: message.roomId,
      channelSlug: 'general',
      href: message.href,
    });
  });

  it('round-trips through the server shape', () => {
    const input = savedMessageToBookmark(message);
    const dto: BookmarkDto = {
      id: 'bm1',
      workspaceId: 'ws1',
      userId: 'u1',
      targetType: input.targetType,
      targetId: input.targetId,
      title: input.title,
      snippet: input.snippet,
      tags: [],
      metadata: input.metadata,
      createdAt: new Date(message.savedAt).toISOString(),
      updatedAt: new Date(message.savedAt).toISOString(),
    };
    expect(bookmarkToSavedMessage(dto)).toEqual({
      ...message,
      senderAvatarUrl: undefined,
    });
  });

  it('caps an oversized body to the API limit and drops an empty one', () => {
    expect(savedMessageToBookmark({ ...message, body: 'x'.repeat(5000) }).snippet).toHaveLength(4000);
    expect(savedMessageToBookmark({ ...message, body: '   ' }).snippet).toBeNull();
  });
});
