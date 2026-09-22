import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { PLANS_CONFIG, normalizePlanTier, type CreditAccountDto, type CreditTransactionDto } from '@org/types';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves or creates the workspace shared AI credit account.
   */
  async getOrCreateAccount(workspaceId: string): Promise<CreditAccountDto> {
    let account = await this.prisma.creditAccount.findUnique({
      where: { workspaceId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!account) {
      // Determine initial plan credit grant
      const sub = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId },
        select: { planTier: true },
      });
      const plan = normalizePlanTier(sub?.planTier ?? 'starter');
      const initialCredits = PLANS_CONFIG[plan].machineLimits.aiCreditsUsd > 0
        ? PLANS_CONFIG[plan].machineLimits.aiCreditsUsd
        : 5.0;

      account = await this.prisma.creditAccount.create({
        data: {
          workspaceId,
          balance: initialCredits,
          currency: 'USD',
          transactions: {
            create: {
              amount: initialCredits,
              balanceAfter: initialCredits,
              description: `Initial ${PLANS_CONFIG[plan].name} plan shared AI credit allocation`,
              referenceType: 'PLAN_GRANT',
            },
          },
        },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      this.logger.log(`Initialized shared credit account for workspace ${workspaceId} with $${initialCredits}`);
    }

    return {
      id: account.id,
      workspaceId: account.workspaceId,
      balance: account.balance,
      currency: account.currency,
      updatedAt: account.updatedAt.toISOString(),
      transactions: account.transactions?.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        referenceType: t.referenceType ?? undefined,
        referenceId: t.referenceId ?? undefined,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Deducts AI credits from the workspace shared balance.
   */
  async deductCredits(
    workspaceId: string,
    amount: number,
    referenceType: 'AGENT' | 'WORKFLOW' | string,
    referenceId: string,
    description: string,
  ): Promise<CreditTransactionDto> {
    if (amount <= 0) {
      throw new BadRequestException('Deduction amount must be greater than zero.');
    }

    const account = await this.getOrCreateAccount(workspaceId);
    if (account.balance < amount) {
      throw new BadRequestException({
        code: 'CREDIT_LIMIT_REACHED',
        message: `Insufficient AI credits. Current balance: $${account.balance.toFixed(2)}, required: $${amount.toFixed(2)}. Please top up your shared credits.`,
      });
    }

    const newBalance = Math.max(0, Number((account.balance - amount).toFixed(4)));

    const [tx] = await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          accountId: account.id,
          amount: -amount,
          balanceAfter: newBalance,
          description,
          referenceType,
          referenceId,
        },
      }),
      this.prisma.creditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      }),
    ]);

    return {
      id: tx.id,
      accountId: tx.accountId,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      referenceType: tx.referenceType ?? undefined,
      referenceId: tx.referenceId ?? undefined,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  /**
   * Tops up the workspace shared AI credit balance.
   */
  async topUpCredits(
    workspaceId: string,
    amount: number,
    paymentMethodId?: string,
  ): Promise<CreditAccountDto> {
    if (amount <= 0 || isNaN(amount)) {
      throw new BadRequestException('Top-up amount must be a positive number.');
    }

    const account = await this.getOrCreateAccount(workspaceId);
    const newBalance = Number((account.balance + amount).toFixed(4));

    await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          accountId: account.id,
          amount,
          balanceAfter: newBalance,
          description: `AI credit top-up ($${amount.toFixed(2)})`,
          referenceType: 'TOP_UP',
          metadata: paymentMethodId ? { paymentMethodId } : {},
        },
      }),
      this.prisma.creditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      }),
    ]);

    this.logger.log(`Workspace ${workspaceId} topped up $${amount.toFixed(2)}. New balance: $${newBalance.toFixed(2)}`);
    return this.getOrCreateAccount(workspaceId);
  }

  /**
   * Verifies whether workspace has enough credit to execute a task.
   */
  async hasSufficientCredits(workspaceId: string, requiredAmount = 0.01): Promise<boolean> {
    const account = await this.getOrCreateAccount(workspaceId);
    return account.balance >= requiredAmount;
  }
}
