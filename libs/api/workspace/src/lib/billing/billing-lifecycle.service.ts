import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { BillingAuditService } from './billing-audit.service.js';
import { BillingWebhookService } from './billing-webhook.service.js';
import { CheckoutService, addInterval } from './checkout.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';

const DAY_MS = 86_400_000;
const BATCH = 100;

/**
 * Time-driven billing transitions the payment provider cannot do for us:
 * period-end plan changes for subscriptions without a provider, the past-due
 * grace period, abandoned checkouts, and "ending soon" notices.
 */
@Injectable()
export class BillingLifecycleService {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly checkout: CheckoutService,
    private readonly webhooks: BillingWebhookService,
    private readonly audit: BillingAuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private get graceDays(): number {
    const n = Number(this.config.get<string>('BILLING_PAST_DUE_GRACE_DAYS') ?? 7);
    return Number.isFinite(n) && n >= 0 ? n : 7;
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'billing-lifecycle' })
  async sweep(): Promise<void> {
    try {
      await this.checkout.expireStaleCheckouts();
      await this.applyDueChanges();
      await this.enforcePastDueGrace();
      await this.sendReminders();
    } catch (err) {
      this.logger.error(`Billing lifecycle sweep failed: ${String(err)}`);
    }
  }

  /**
   * Subscriptions that no payment provider renews (approved zero-total
   * activations and grandfathered legacy plans) when their period ends.
   */
  async applyDueChanges(now = new Date()): Promise<number> {
    const due = await this.prisma.workspaceSubscription.findMany({
      where: {
        source: { in: ['PROMOTION', 'LEGACY'] },
        planTier: { not: 'FREE' },
        currentPeriodEnd: { lte: now },
      },
      take: BATCH,
    });
    let changed = 0;
    for (const sub of due) {
      if (sub.scheduledPlanTier || sub.cancelAtPeriodEnd) {
        if (await this.webhooks.applyScheduledPlan(sub.workspaceId, { resetPeriod: true })) {
          changed++;
          continue;
        }
        if (sub.cancelAtPeriodEnd) {
          await this.webhooks.downgradeToFree(sub.workspaceId, 'Your scheduled cancellation took effect.');
          changed++;
          continue;
        }
      }
      if (sub.source === 'PROMOTION') {
        // A coupon activation has no renewal behind it, so the access simply ends.
        await this.webhooks.downgradeToFree(sub.workspaceId, 'Your promotional plan period ended.');
        changed++;
      } else {
        // LEGACY: grandfathered paid plan from before payment verification — keep access, roll the window.
        const interval = sub.billingInterval.toLowerCase() === 'annual' ? 'annual' : 'monthly';
        let next = sub.currentPeriodEnd;
        while (next <= now) next = addInterval(next, interval);
        await this.prisma.workspaceSubscription.update({
          where: { workspaceId: sub.workspaceId },
          data: { currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: next, renewAt: next },
        });
      }
    }
    return changed;
  }

  /** After the grace window a still-unpaid subscription loses paid access. */
  async enforcePastDueGrace(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.graceDays * DAY_MS);
    const overdue = await this.prisma.workspaceSubscription.findMany({
      where: { source: 'PROVIDER', status: { in: ['PAST_DUE', 'UNPAID'] }, pastDueSince: { lte: cutoff } },
      take: BATCH,
    });
    for (const sub of overdue) {
      if (sub.providerSubscriptionId && this.provider.isConfigured()) {
        await this.provider.cancelNow(sub.providerSubscriptionId).catch((err) => {
          this.logger.warn(`Could not cancel overdue subscription ${sub.providerSubscriptionId}: ${String(err)}`);
        });
      }
      await this.webhooks.downgradeToFree(
        sub.workspaceId,
        `Payment was not received within ${this.graceDays} days, so the workspace returned to the Free plan.`,
      );
    }
    return overdue.length;
  }

  private async emitOnce(notice: {
    workspaceId: string;
    actorId: null;
    title: string;
    body: string;
    dedupeKey: string;
  }): Promise<void> {
    if (await this.audit.firstTime(notice.dedupeKey)) {
      this.events.emit(AppEvent.BillingNotice, notice);
    }
  }

  /** Trial-ending and upcoming-renewal notices (deduped per period by key). */
  async sendReminders(now = new Date()): Promise<void> {
    const soon = new Date(now.getTime() + 3 * DAY_MS);

    const trials = await this.prisma.workspaceSubscription.findMany({
      where: { status: 'TRIALING', trialEnd: { gt: now, lte: soon } },
      select: { workspaceId: true, trialEnd: true },
      take: BATCH,
    });
    for (const t of trials) {
      await this.emitOnce({
        workspaceId: t.workspaceId,
        actorId: null,
        title: 'Your free trial ends soon',
        body: `Your trial ends on ${t.trialEnd?.toDateString()}. Your subscription will start automatically unless you cancel.`,
        dedupeKey: `trial-ending:${t.workspaceId}:${t.trialEnd?.toISOString()}`,
      });
    }

    const renewals = await this.prisma.workspaceSubscription.findMany({
      where: {
        source: 'PROVIDER',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: { gt: now, lte: soon },
      },
      select: { workspaceId: true, currentPeriodEnd: true },
      take: BATCH,
    });
    for (const r of renewals) {
      await this.emitOnce({
        workspaceId: r.workspaceId,
        actorId: null,
        title: 'Upcoming renewal',
        body: `Your subscription renews on ${r.currentPeriodEnd.toDateString()}.`,
        dedupeKey: `renewal:${r.workspaceId}:${r.currentPeriodEnd.toISOString()}`,
      });
    }
  }
}
