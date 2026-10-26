import { describe, expect, it, vi } from 'vitest';
import { AiEntityMatrixListener } from './ai-entity-matrix.listener.js';

function setup(enabled = true) {
  const auth = { syncAiEntityIdentity: vi.fn().mockResolvedValue('@bot:srv') };
  const admin = { isEnabled: enabled, deactivateUser: vi.fn().mockResolvedValue(undefined) };
  const listener = new AiEntityMatrixListener(auth as never, admin as never);
  return { auth, admin, listener };
}

const base = { workspaceId: 'w1', agentId: 'a1', kind: 'entity' as const };

describe('AiEntityMatrixListener', () => {
  it('provisions and syncs the profile on create and update', async () => {
    const { auth, listener } = setup();
    await listener.onAgentChanged({ ...base, action: 'created' });
    await listener.onAgentChanged({ ...base, action: 'updated' });
    expect(auth.syncAiEntityIdentity).toHaveBeenCalledTimes(2);
    expect(auth.syncAiEntityIdentity).toHaveBeenCalledWith('a1');
  });

  it('deactivates the bot account on delete', async () => {
    const { admin, listener } = setup();
    await listener.onAgentChanged({ ...base, action: 'deleted', matrixUserId: '@bot:srv' });
    expect(admin.deactivateUser).toHaveBeenCalledWith('@bot:srv');
  });

  it('ignores workflow events and a disabled homeserver', async () => {
    const off = setup(false);
    await off.listener.onAgentChanged({ ...base, action: 'created' });
    expect(off.auth.syncAiEntityIdentity).not.toHaveBeenCalled();

    const on = setup();
    await on.listener.onAgentChanged({ ...base, kind: 'workflow', action: 'created' });
    expect(on.auth.syncAiEntityIdentity).not.toHaveBeenCalled();
  });

  it('never throws when the homeserver fails', async () => {
    const { auth, listener } = setup();
    auth.syncAiEntityIdentity.mockRejectedValue(new Error('down'));
    await expect(listener.onAgentChanged({ ...base, action: 'updated' })).resolves.toBeUndefined();
  });
});
