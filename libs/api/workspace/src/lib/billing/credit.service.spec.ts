import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditService } from './credit.service.js';

describe('CreditService', () => {
  let service: CreditService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      creditAccount: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      creditTransaction: { create: vi.fn(), findFirst: vi.fn() },
      workspaceSubscription: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new CreditService(prisma);
  });

  it('creates the initial shared account from the plan (legacy STARTER row => Free allowance)', async () => {
    prisma.creditAccount.findUnique.mockResolvedValue(null);
    prisma.workspaceSubscription.findUnique.mockResolvedValue({ planTier: 'STARTER' });
    prisma.creditAccount.create.mockResolvedValue({
      id: 'a1', workspaceId: 'ws', balance: 5, currency: 'USD', updatedAt: new Date(), transactions: [],
    });
    const account = await service.getOrCreateAccount('ws');
    expect(account.balance).toBe(5);
    expect(prisma.creditAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: 5 }) }),
    );
  });

  describe('deductCredits', () => {
    beforeEach(() => {
      prisma.creditAccount.findUnique.mockResolvedValue({
        id: 'a1', workspaceId: 'ws', balance: 5, currency: 'USD', updatedAt: new Date(), transactions: [],
      });
    });

    it('decrements atomically with a balance guard in the same statement', async () => {
      prisma.creditAccount.updateMany.mockResolvedValue({ count: 1 });
      prisma.creditAccount.findUniqueOrThrow.mockResolvedValue({ balance: 4.5 });
      prisma.creditTransaction.create.mockResolvedValue({
        id: 't1', accountId: 'a1', amount: -0.5, balanceAfter: 4.5, description: 'd', referenceType: 'AGENT', referenceId: 'r', createdAt: new Date(),
      });
      const tx = await service.deductCredits('ws', 0.5, 'AGENT', 'r', 'd');
      expect(prisma.creditAccount.updateMany).toHaveBeenCalledWith({
        where: { id: 'a1', balance: { gte: 0.5 } },
        data: { balance: { decrement: 0.5 } },
      });
      expect(tx.balanceAfter).toBe(4.5);
    });

    it('refuses with CREDIT_LIMIT_REACHED when the guarded update matches nothing', async () => {
      prisma.creditAccount.updateMany.mockResolvedValue({ count: 0 });
      prisma.creditAccount.findUnique.mockResolvedValueOnce({ id: 'a1', workspaceId: 'ws', balance: 0.1, currency: 'USD', updatedAt: new Date(), transactions: [] });
      prisma.creditAccount.findUnique.mockResolvedValueOnce({ balance: 0.1 });
      await expect(service.deductCredits('ws', 1, 'AGENT', 'r', 'd')).rejects.toMatchObject({
        response: { code: 'CREDIT_LIMIT_REACHED' },
      });
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects non-positive amounts', async () => {
      await expect(service.deductCredits('ws', 0, 'AGENT', 'r', 'd')).rejects.toThrow(/greater than zero/);
      await expect(service.deductCredits('ws', Number.NaN, 'AGENT', 'r', 'd')).rejects.toThrow();
    });
  });

  describe('credit (verified additions)', () => {
    beforeEach(() => {
      prisma.creditAccount.findUnique.mockResolvedValue({
        id: 'a1', workspaceId: 'ws', balance: 5, currency: 'USD', updatedAt: new Date(), transactions: [],
      });
    });

    it('is a no-op for a repeated idempotency key', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue({ id: 'existing' });
      expect(await service.credit('ws', 10, 'TOP_UP', 'checkout:1', 'x')).toBe(false);
      expect(prisma.creditAccount.update).not.toHaveBeenCalled();
    });

    it('adds the amount once for a new key', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.creditAccount.findUniqueOrThrow.mockResolvedValue({ balance: 15 });
      expect(await service.credit('ws', 10, 'TOP_UP', 'checkout:2', 'x')).toBe(true);
      expect(prisma.creditAccount.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { balance: { increment: 10 } },
      });
    });

    it('rejects zero, negative and non-finite amounts', async () => {
      for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
        await expect(service.credit('ws', bad, 'TOP_UP', 'k', 'x')).rejects.toThrow();
      }
    });
  });

  describe('threshold notices', () => {
    const run = async (before: number, after: number) => {
      const events = { emit: vi.fn() };
      const svc = new CreditService(prisma, events as never);
      prisma.creditAccount.findUnique.mockResolvedValue({
        id: 'a1', workspaceId: 'ws', balance: before, currency: 'USD', updatedAt: new Date(), transactions: [],
      });
      prisma.creditAccount.updateMany.mockResolvedValue({ count: 1 });
      prisma.creditAccount.findUniqueOrThrow.mockResolvedValue({ balance: after });
      prisma.creditTransaction.create.mockResolvedValue({
        id: 't', accountId: 'a1', amount: before - after, balanceAfter: after, description: 'd', referenceType: 'AGENT', referenceId: 'r', createdAt: new Date(),
      });
      await svc.deductCredits('ws', before - after, 'AGENT', 'r', 'd');
      return events.emit.mock.calls.map((c) => c[1].title);
    };

    it('warns once when a deduction crosses the low line', async () => {
      expect(await run(1.5, 0.8)).toEqual(['AI credits running low']);
    });
    it('says exhausted when the balance is emptied', async () => {
      expect(await run(0.5, 0)).toEqual(['AI credits exhausted']);
    });
    it('stays quiet when already below the line or still comfortably above it', async () => {
      expect(await run(0.9, 0.7)).toEqual([]);
      expect(await run(4, 3)).toEqual([]);
    });
  });

  it('grants nothing for plans whose allowance is custom (-1) — those are set by contract', async () => {
    const spy = vi.spyOn(service, 'credit');
    expect(await service.grantPlanAllowance('ws', 'enterprise', 'p1')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
