import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountDeletionService,
  DELETED_USER_NAME,
  tombstoneEmail,
} from './account-deletion.service.js';

const USER = 'user-1';

/** Every `deleteMany` is a spy, so the scrub can run without naming each table. */
function fakePrisma(owned: Array<{ id: string; members: number }> = []) {
  const deletes = new Map<string, ReturnType<typeof vi.fn>>();
  const userUpdate = vi.fn().mockReturnValue('update');
  const base = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        passwordHash: 'hash',
        matrixUserId: '@u:hs',
        twoFactorAuth: null,
        ownedWorkspaces: owned.map((w) => ({
          id: w.id,
          name: w.id,
          slug: w.id,
          _count: { members: w.members },
        })),
      }),
      update: userUpdate,
    },
    externalIntegration: {
      findMany: vi.fn().mockResolvedValue([{ id: 'i1', workspaceId: 'w' }]),
      deleteMany: vi.fn().mockReturnValue('del'),
    },
    workspaceSubscription: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const prisma = new Proxy(base as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      const spy = vi.fn().mockReturnValue('del');
      deletes.set(key, spy);
      target[key] = { deleteMany: spy };
      return target[key];
    },
  });
  return { prisma, base, deletes, userUpdate };
}

function build(owned?: Array<{ id: string; members: number }>) {
  const fake = fakePrisma(owned);
  const auth = { assertAccountOwnership: vi.fn().mockResolvedValue(undefined) };
  const workspaces = { remove: vi.fn().mockResolvedValue(undefined) };
  const billing = { cancelSubscription: vi.fn().mockResolvedValue({}) };
  const integrations = {
    disconnectIntegration: vi.fn().mockResolvedValue({}),
  };
  const matrix = { deactivateUser: vi.fn().mockResolvedValue(true) };
  const storage = {
    exists: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const service = new AccountDeletionService(
    fake.prisma as never,
    auth as never,
    workspaces as never,
    billing as never,
    integrations as never,
    matrix as never,
    storage as never,
  );
  return {
    ...fake,
    service,
    auth,
    workspaces,
    billing,
    integrations,
    matrix,
    storage,
  };
}

const input = { confirmation: 'DELETE' as const, password: 'pw' };

describe('AccountDeletionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses without proof of ownership and touches nothing', async () => {
    const t = build();
    t.auth.assertAccountOwnership.mockRejectedValue(
      new UnauthorizedException(),
    );

    await expect(t.service.deleteAccount(USER, input)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(t.base.$transaction).not.toHaveBeenCalled();
    expect(t.matrix.deactivateUser).not.toHaveBeenCalled();
  });

  it('blocks while the person owns a workspace others use', async () => {
    const t = build([{ id: 'team', members: 3 }]);

    await expect(t.service.deleteAccount(USER, input)).rejects.toThrow(
      ConflictException,
    );
    expect(t.workspaces.remove).not.toHaveBeenCalled();
    expect(t.base.$transaction).not.toHaveBeenCalled();
  });

  it('deletes a workspace only its owner uses, cancelling billing first', async () => {
    const t = build([{ id: 'solo', members: 1 }]);
    t.base.workspaceSubscription.findUnique.mockResolvedValue({
      providerSubscriptionId: 'sub_1',
      cancelAtPeriodEnd: false,
    });

    const result = await t.service.deleteAccount(USER, input);

    expect(t.billing.cancelSubscription).toHaveBeenCalledWith('solo', USER);
    expect(t.workspaces.remove).toHaveBeenCalledWith('solo', USER);
    expect(
      t.billing.cancelSubscription.mock.invocationCallOrder[0],
    ).toBeLessThan(t.workspaces.remove.mock.invocationCallOrder[0] as number);
    expect(result.workspacesDeleted).toBe(1);
  });

  it('stops before erasing anything when the billing provider fails', async () => {
    const t = build([{ id: 'solo', members: 1 }]);
    t.base.workspaceSubscription.findUnique.mockResolvedValue({
      providerSubscriptionId: 'sub_1',
      cancelAtPeriodEnd: false,
    });
    t.billing.cancelSubscription.mockRejectedValue(new Error('stripe down'));

    await expect(t.service.deleteAccount(USER, input)).rejects.toThrow(
      'stripe down',
    );
    expect(t.matrix.deactivateUser).not.toHaveBeenCalled();
    expect(t.base.$transaction).not.toHaveBeenCalled();
  });

  it('replaces every personal field and revokes credentials', async () => {
    const t = build();

    await t.service.deleteAccount(USER, input);

    const data = t.userUpdate.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      email: tombstoneEmail(USER),
      name: DELETED_USER_NAME,
      passwordHash: null,
      username: null,
      avatarUrl: null,
      bio: null,
      systemRole: 'USER',
      matrixUserId: null,
    });
    expect(data.deletedAt).toBeInstanceOf(Date);
    for (const table of [
      'refreshToken',
      'userIdentity',
      'pushRegistration',
      'webAuthnCredential',
      'aIChatSession',
      'workspaceMember',
    ]) {
      expect(t.deletes.get(table), table).toHaveBeenCalled();
    }
    expect(t.base.externalIntegration.deleteMany).toHaveBeenCalled();
    expect(t.base.$transaction).toHaveBeenCalledTimes(1);
  });

  it('revokes integrations and erases chat through the homeserver', async () => {
    const t = build();

    const result = await t.service.deleteAccount(USER, input);

    expect(t.integrations.disconnectIntegration).toHaveBeenCalledWith(
      'i1',
      USER,
      'w',
    );
    expect(t.matrix.deactivateUser).toHaveBeenCalledWith('@u:hs', {
      erase: true,
    });
    expect(result).toMatchObject({ deleted: true, chatErased: true });
  });

  it('still deletes, and says so, when chat erasure fails', async () => {
    const t = build();
    t.matrix.deactivateUser.mockRejectedValue(new Error('synapse down'));
    t.integrations.disconnectIntegration.mockRejectedValue(new Error('nope'));

    const result = await t.service.deleteAccount(USER, input);

    expect(result.chatErased).toBe(false);
    expect(t.base.$transaction).toHaveBeenCalledTimes(1);
  });

  it('removes the avatar and cover blobs', async () => {
    const t = build();

    await t.service.deleteAccount(USER, input);

    expect(t.storage.delete).toHaveBeenCalledWith(
      `avatars/${USER}/avatar.webp`,
    );
    expect(t.storage.delete).toHaveBeenCalledWith(`covers/${USER}/cover.webp`);
  });
});
