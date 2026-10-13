import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { PLANS_CONFIG, normalizePlanTier, type CreditAccountDto, type CreditTransactionDto } from '@org/types';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

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
      const plan = normalizePlanTier(sub?.planTier ?? 'free');
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
   *
   * The balance check and the decrement are one conditional UPDATE, so
   * concurrent runs can never overdraw the account (no read-then-write race).
   */
  async deductCredits(
    workspaceId: string,
    amount: number,
    referenceType: 'AGENT' | 'WORKFLOW' | string,
    referenceId: string,
    description: string,
  ): Promise<CreditTransactionDto> {
    if (!(amount > 0)) {
      throw new BadRequestException('Deduction amount must be greater than zero.');
    }

    const account = await this.getOrCreateAccount(workspaceId);

    const tx = await this.prisma.$transaction(async (db) => {
      const updated = await db.creditAccount.updateMany({
        where: { id: account.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (updated.count === 0) {
        const current = await db.creditAccount.findUnique({ where: { id: account.id }, select: { balance: true } });
        throw new BadRequestException({
          code: 'CREDIT_LIMIT_REACHED',
          message: `Insufficient AI credits. Current balance: $${(current?.balance ?? 0).toFixed(2)}, required: $${amount.toFixed(2)}. Please top up your shared credits.`,
        });
      }
      const after = await db.creditAccount.findUniqueOrThrow({
        where: { id: account.id },
        select: { balance: true },
      });
      return db.creditTransaction.create({
        data: {
          accountId: account.id,
          amount: -amount,
          balanceAfter: Number(after.balance.toFixed(4)),
          description,
          referenceType,
          referenceId,
        },
      });
    });

    this.warnOnThresholdCrossing(workspaceId, account.balance, tx.balanceAfter);

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
   * Notifies billing managers exactly when a deduction *crosses* the low-credit
   * line or empties the balance — so each condition fires once per drawdown,
   * not on every later run. The low line is `BILLING_LOW_CREDIT_USD` (default $1).
   */
  private warnOnThresholdCrossing(workspaceId: string, before: number, after: number): void {
    if (!this.events) return;
    const configured = Number(process.env['BILLING_LOW_CREDIT_USD'] ?? 1);
    const low = Number.isFinite(configured) && configured > 0 ? configured : 1;
    const empty = 0.01;

    let title: string | null = null;
    let body = '';
    if (before >= empty && after < empty) {
      title = 'AI credits exhausted';
      body = 'Agent runs and workflows that use AI credits will stop until you top up or your plan renews.';
    } else if (before >= low && after < low) {
      title = 'AI credits running low';
      body = `Only $${after.toFixed(2)} of shared AI credits remain.`;
    }
    if (!title) return;
    this.events.emit(AppEvent.BillingNotice, {
      workspaceId,
      actorId: null,
      title,
      body,
      dedupeKey: `credits:${workspaceId}:${title === 'AI credits exhausted' ? 'empty' : 'low'}:${Date.now().toString(36)}`,
    });
  }

  /**
   * Adds credits for a *verified* reason (a confirmed payment or a plan grant).
   *
   * `idempotencyKey` is stored as the transaction's referenceId; a second call
   * with the same (referenceType, key) is a no-op, which is what makes webhook
   * retries safe. There is deliberately no public path that calls this without a
   * payment or plan event behind it.
   */
  async credit(
    workspaceId: string,
    amount: number,
    referenceType: 'TOP_UP' | 'PLAN_GRANT',
    idempotencyKey: string,
    description: string,
  ): Promise<boolean> {
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw new BadRequestException('Credit amount must be a positive number.');
    }
    const account = await this.getOrCreateAccount(workspaceId);

    return this.prisma.$transaction(async (db) => {
      const existing = await db.creditTransaction.findFirst({
        where: { accountId: account.id, referenceType, referenceId: idempotencyKey },
        select: { id: true },
      });
      if (existing) return false;
      await db.creditAccount.update({ where: { id: account.id }, data: { balance: { increment: amount } } });
      const after = await db.creditAccount.findUniqueOrThrow({ where: { id: account.id }, select: { balance: true } });
      await db.creditTransaction.create({
        data: {
          accountId: account.id,
          amount,
          balanceAfter: Number(after.balance.toFixed(4)),
          description,
          referenceType,
          referenceId: idempotencyKey,
        },
      });
      this.logger.log(`Workspace ${workspaceId} credited $${amount.toFixed(2)} (${referenceType}).`);
      return true;
    });
  }

  /** Grants the plan's included AI-credit allowance for a billing period (idempotent per period key). */
  async grantPlanAllowance(workspaceId: string, planInput: string, periodKey: string): Promise<boolean> {
    const plan = normalizePlanTier(planInput);
    const allowance = PLANS_CONFIG[plan].machineLimits.aiCreditsUsd;
    if (!(allowance > 0)) return false; // free-form / custom (-1) allowances are set by contract
    return this.credit(
      workspaceId,
      allowance,
      'PLAN_GRANT',
      `plan:${plan}:${periodKey}`,
      `${PLANS_CONFIG[plan].name} plan included AI credits`,
    );
  }

  /**
   * Verifies whether workspace has enough credit to execute a task.
   */
  async hasSufficientCredits(workspaceId: string, requiredAmount = 0.01): Promise<boolean> {
    const account = await this.getOrCreateAccount(workspaceId);
    return account.balance >= requiredAmount;
  }
}
