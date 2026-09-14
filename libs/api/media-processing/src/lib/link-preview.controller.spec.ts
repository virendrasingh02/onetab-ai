import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LinkPreviewController,
  MessagesLinkPreviewController,
} from './link-preview.controller.js';

describe('LinkPreviewController', () => {
  let controller: LinkPreviewController;
  let messagesController: MessagesLinkPreviewController;
  let mockService: {
    getPreview: ReturnType<typeof vi.fn>;
    setMessageVisibility: ReturnType<typeof vi.fn>;
    getMessageVisibility: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      getPreview: vi.fn(),
      setMessageVisibility: vi.fn().mockResolvedValue(undefined),
      getMessageVisibility: vi.fn().mockResolvedValue('visible'),
    };
    controller = new LinkPreviewController(mockService as any);
    messagesController = new MessagesLinkPreviewController(mockService as any);
  });

  it('calls getPreview with validated URL', async () => {
    const preview = {
      id: 'prev_1',
      url: 'https://github.com',
      normalizedUrl: 'https://github.com',
      domain: 'github.com',
      status: 'ready',
      visibility: 'visible',
    };
    mockService.getPreview.mockResolvedValue(preview);

    const result = await controller.getPreview({ url: 'https://github.com' });
    expect(mockService.getPreview).toHaveBeenCalledWith('https://github.com');
    expect(result).toEqual(preview);
  });

  it('updates message visibility on controller and messagesController', async () => {
    const res1 = await controller.updateMessageVisibility('msg_123', {
      visibility: 'hidden',
    });
    expect(mockService.setMessageVisibility).toHaveBeenCalledWith(
      'msg_123',
      'hidden',
    );
    expect(res1).toEqual({
      success: true,
      messageId: 'msg_123',
      visibility: 'hidden',
    });

    const res2 = await messagesController.updateMessageVisibility('msg_456', {
      visibility: 'visible',
    });
    expect(mockService.setMessageVisibility).toHaveBeenCalledWith(
      'msg_456',
      'visible',
    );
    expect(res2).toEqual({
      success: true,
      messageId: 'msg_456',
      visibility: 'visible',
    });
  });
});
