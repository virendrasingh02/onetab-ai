import { describe, expect, it, vi } from 'vitest';
import { AppEvent, type ConnectorEventReceivedEvent } from '@org/api-common';
import { GithubEventsListener } from './github-events.listener.js';

function setup(prefs: Record<string, unknown> | null) {
  const prisma = {
    externalIntegration: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
    workspaceMemberPreference: { findUnique: vi.fn().mockResolvedValue(prefs ? { data: prefs } : null) },
  };
  const events = { emit: vi.fn() };
  const listener = new GithubEventsListener(prisma as never, events as never);
  return { listener, events };
}

const pr = (over: Partial<ConnectorEventReceivedEvent> = {}): ConnectorEventReceivedEvent => ({
  workspaceId: 'w1',
  integrationId: 'i1',
  provider: 'GITHUB',
  triggerId: 'pull_request',
  eventId: 'e1',
  item: { action: 'opened', number: 3, title: 'T', repository: 'a/b', merged: false },
  ownerUserId: null,
  ...over,
});

describe('GithubEventsListener', () => {
  it('raises github.pull_request in the connection workspace by default', async () => {
    const { listener, events } = setup(null);
    await listener.onEvent(pr());
    expect(events.emit).toHaveBeenCalledWith(
      AppEvent.GithubPullRequest,
      expect.objectContaining({ workspaceId: 'w1', number: 3, repository: 'a/b' }),
    );
  });

  it('stays silent when the owner switched the PR webhook off', async () => {
    const { listener, events } = setup({ githubPRWebhook: false });
    await listener.onEvent(pr());
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('ignores other providers and other triggers', async () => {
    const { listener, events } = setup(null);
    await listener.onEvent(pr({ provider: 'SHOPIFY' }));
    await listener.onEvent(pr({ triggerId: 'push' }));
    expect(events.emit).not.toHaveBeenCalled();
  });
});
