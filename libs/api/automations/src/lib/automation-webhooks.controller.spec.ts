import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '@org/api-common';
import { describe, expect, it, vi } from 'vitest';
import { AutomationWebhooksController } from './automation-webhooks.controller.js';

describe('AutomationWebhooksController', () => {
  it('is public and carries no member-only guard, so outside callers can reach it', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AutomationWebhooksController)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, AutomationWebhooksController)).toBeUndefined();
  });

  it('passes the workspace from the URL and wraps a non-object body', async () => {
    const canvasAgents = { webhook: vi.fn().mockResolvedValue({ runId: 'r' }) };
    const controller = new AutomationWebhooksController({} as never, canvasAgents as never);
    await controller.triggerCanvasAgent('ws', 'a', [1, 2], 's');
    expect(canvasAgents.webhook).toHaveBeenCalledWith('ws', 'a', { body: [1, 2] }, 's');
  });
});
