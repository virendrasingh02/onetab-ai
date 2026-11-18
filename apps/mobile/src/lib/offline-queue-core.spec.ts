import { describe, expect, it, vi } from 'vitest';
import {
  describeDroppedAction,
  isNetworkFailure,
  MOBILE_OFFLINE_ACTION,
  sendOrQueue,
  signOutMessage,
} from './offline-queue-core';

/** Shape of `@org/api-client`'s ApiError as far as the queue cares. */
class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}
const apiError = (status: number) => new ApiError(status);

const request = (send: () => Promise<string>) => ({
  kind: MOBILE_OFFLINE_ACTION.TaskCommentCreate,
  workspaceId: 'ws',
  dedupeKey: 'c1',
  payload: { taskId: 't1', input: { content: 'hi' } },
  send,
});

describe('sendOrQueue', () => {
  it('sends when online and does not queue', async () => {
    const queue = { enqueue: vi.fn() };
    const outcome = await sendOrQueue(
      queue,
      true,
      request(async () => 'ok'),
    );
    expect(outcome).toEqual({ status: 'sent', result: 'ok' });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('queues without calling the API while offline', async () => {
    const queue = { enqueue: vi.fn() };
    const send = vi.fn(async () => 'ok');
    const outcome = await sendOrQueue(queue, false, request(send));
    expect(outcome).toEqual({ status: 'queued' });
    expect(send).not.toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith({
      kind: 'taskComment.create',
      workspaceId: 'ws',
      dedupeKey: 'c1',
      payload: { taskId: 't1', input: { content: 'hi' } },
    });
  });

  it('queues when the request fails only because the network dropped', async () => {
    const queue = { enqueue: vi.fn() };
    const outcome = await sendOrQueue(
      queue,
      true,
      request(async () => {
        throw apiError(0);
      }),
    );
    expect(outcome).toEqual({ status: 'queued' });
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('surfaces real server errors instead of queuing them', async () => {
    const queue = { enqueue: vi.fn() };
    await expect(
      sendOrQueue(
        queue,
        true,
        request(async () => {
          throw apiError(403);
        }),
      ),
    ).rejects.toBeInstanceOf(ApiError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});

describe('isNetworkFailure', () => {
  it('treats status 0 and status-less errors as network, HTTP codes as not', () => {
    expect(isNetworkFailure(apiError(0))).toBe(true);
    expect(isNetworkFailure(new TypeError('Network request failed'))).toBe(
      true,
    );
    expect(isNetworkFailure(apiError(500))).toBe(false);
    expect(isNetworkFailure(apiError(409))).toBe(false);
  });
});

describe('offline queue wording', () => {
  it('names a dropped action with a short preview', () => {
    expect(
      describeDroppedAction({
        id: 'q',
        kind: 'taskComment.create',
        workspaceId: 'ws',
        dedupeKey: 'c',
        payload: { input: { content: '  Looks   good to me  ' } },
        enqueuedAt: '',
        attempts: 0,
      }),
    ).toBe('a comment (“Looks good to me”)');
  });

  it('warns on sign-out only when changes would be lost', () => {
    expect(signOutMessage(0)).not.toMatch(/discarded/);
    expect(signOutMessage(2)).toMatch(/2 changes .* haven't .* discarded/);
  });
});
