import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreditService } from './credit.service.js';

describe('CreditService', () => {
  let service: CreditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      creditAccount: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      creditTransaction: {
        create: vi.fn(),
      },
      workspaceSubscription: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callbacks) => Promise.all(callbacks)),
    };

    service = new CreditService(mockPrisma);
  });

  it('creates an initial shared credit account with $5 plan allocation', async () => {
    mockPrisma.creditAccount.findUnique.mockResolvedValue(null);
    mockPrisma.workspaceSubscription.findUnique.mockResolvedValue({
      planTier: 'STARTER',
    });
    mockPrisma.creditAccount.create.mockResolvedValue({
      id: 'acc_1',
      workspaceId: 'ws_1',
      balance: 5.0,
      currency: 'USD',
      updatedAt: new Date(),
      transactions: [],
    });

    const account = await service.getOrCreateAccount('ws_1');
    expect(account.balance).toBe(5.0);
    expect(mockPrisma.creditAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          balance: 5.0,
        }),
      }),
    );
  });

  it('deducts credits when sufficient balance exists', async () => {
    mockPrisma.creditAccount.findUnique.mockResolvedValue({
      id: 'acc_1',
      workspaceId: 'ws_1',
      balance: 5.0,
      currency: 'USD',
      updatedAt: new Date(),
      transactions: [],
    });

    mockPrisma.creditTransaction.create.mockResolvedValue({
      id: 'tx_1',
      accountId: 'acc_1',
      amount: -0.5,
      balanceAfter: 4.5,
      description: 'Agent turn execution',
      referenceType: 'AGENT',
      referenceId: 'ag_1',
      createdAt: new Date(),
    });

    const tx = await service.deductCredits(
      'ws_1',
      0.5,
      'AGENT',
      'ag_1',
      'Agent turn execution',
    );

    expect(tx.balanceAfter).toBe(4.5);
    expect(mockPrisma.creditAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc_1' },
      data: { balance: 4.5 },
    });
  });

  it('throws CREDIT_LIMIT_REACHED when credit balance is insufficient', async () => {
    mockPrisma.creditAccount.findUnique.mockResolvedValue({
      id: 'acc_1',
      workspaceId: 'ws_1',
      balance: 0.1,
      currency: 'USD',
      updatedAt: new Date(),
      transactions: [],
    });

    await expect(
      service.deductCredits('ws_1', 1.0, 'AGENT', 'ag_1', 'Test'),
    ).rejects.toThrow();
  });

  it('tops up credits and increases balance', async () => {
    mockPrisma.creditAccount.findUnique.mockResolvedValue({
      id: 'acc_1',
      workspaceId: 'ws_1',
      balance: 2.0,
      currency: 'USD',
      updatedAt: new Date(),
      transactions: [],
    });

    mockPrisma.creditTransaction.create.mockResolvedValue({
      id: 'tx_topup',
      accountId: 'acc_1',
      amount: 10.0,
      balanceAfter: 12.0,
      description: 'AI credit top-up ($10.00)',
      createdAt: new Date(),
    });

    await service.topUpCredits('ws_1', 10.0);
    expect(mockPrisma.creditAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc_1' },
      data: { balance: 12.0 },
    });
  });
});
