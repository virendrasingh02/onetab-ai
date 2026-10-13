import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { Prisma, PrismaService } from '@org/database';
import { PLANS_CONFIG, normalizePlanTier } from '@org/types';
import { BillingAuditService } from './billing-audit.service.js';
import { CheckoutService } from './checkout.service.js';
import { CreditService } from './credit.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider, type ProviderEvent } from './payment-provider.js';

const STATUS_MAP: Record<string, string> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  unpaid: 'UNPAID',
  canceled: 'CANCELLED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'EXPIRED',
  paused: 'PAUSED',
};

/** Thrown to make the provider redeliver (e.g. an invoice that beat its checkout). */
export class RetryWebhookLater extends Error {}

export interface WebhookResult {
  duplicate: boolean;
  status: 'PROCESSED' | 'IGNORED';
}

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly credits: CreditService,
    private readonly audit: BillingAuditService,
    private readonly events: EventEmitter2,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Verifies, de-duplicates and applies one provider webhook.
   * The signature is checked by the provider adapter before anything is stored.
   */
  async handle(rawBody: Buffer, signature: string | undefined): Promise<WebhookResult> {
    const event = this.provider.parseWebhook(rawBody, signature); // throws InvalidWebhookSignatureError

    // Claim the event. A unique violation means we've seen it before.
    try {
      await this.prisma.billingWebhookEvent.create({
        data: {
          provider: this.provider.name,
          providerEventId: event.id,
          type: event.type === 'ignored' ? event.rawType : event.type,
          payload: { type: event.type } as object,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const prior = await this.prisma.billingWebhookEvent.findUnique({
          where: { provider_providerEventId: { provider: this.provider.name, providerEventId: event.id } },
        });
        if (prior && (prior.status === 'PROCESSED' || prior.status === 'IGNORED')) {
          return { duplicate: true, status: prior.status };
        }
        // RECEIVED/FAILED: a previous attempt did not finish — fall through and retry it.
      } else {
        throw err;
      }
    }

    try {
      const applied = await this.apply(event);
      const status = applied ? 'PROCESSED' : 'IGNORED';
      await this.prisma.billingWebhookEvent.update({
        where: { provider_providerEventId: { provider: this.provider.name, providerEventId: event.id } },
        data: { status, processedAt: new Date(), error: null },
      });
      return { duplicate: false, status };
    } catch (err) {
      await this.prisma.billingWebhookEvent
        .update({
          where: { provider_providerEventId: { provider: this.provider.name, providerEventId: event.id } },
          data: { status: 'FAILED', error: String(err).slice(0, 500) },
        })
        .catch(() => undefined);
      this.logger.error(`Webhook ${event.id} (${event.type}) failed: ${String(err)}`);
      throw err; // non-2xx => provider retries
    }
  }

  private async findSubscription(subscriptionId: string | null, customerId: string | null) {
    if (subscriptionId) {
      const bySub = await this.prisma.workspaceSubscription.findFirst({
        where: { providerSubscriptionId: subscriptionId },
      });
      if (bySub) return bySub;
    }
    if (customerId) {
      return this.prisma.workspaceSubscription.findFirst({ where: { providerCustomerId: customerId } });
    }
    return null;
  }

  /** True when this event is older than state already applied (out-of-order delivery). */
  private isStale(sub: { providerEventAt: Date | null }, at: Date): boolean {
    return !!sub.providerEventAt && at < sub.providerEventAt;
  }

  /** @returns whether the event changed anything */
  private async apply(event: ProviderEvent): Promise<boolean> {
    switch (event.type) {
      case 'checkout.completed': {
        const session = await this.prisma.billingCheckoutSession.findFirst({
          where: event.checkoutId
            ? { id: event.checkoutId }
            : { providerSessionId: event.providerSessionId },
        });
        if (!session) return false;
        if (!event.paid) return false; // async payment still pending
        if (session.kind === 'CREDIT_TOPUP') {
          return this.checkout.completeTopUp(session.id, event.amountTotalCents);
        }
        // Never grant when the provider collected less than we quoted (tamper / mismatch).
        if (session.trialDays === 0 && event.amountTotalCents < session.totalCents) {
          await this.checkout.failCheckout(session.id, 'FAILED', 'Paid amount was lower than the quoted total');
          await this.audit.record({
            action: 'CHECKOUT_AMOUNT_MISMATCH',
            targetType: 'checkout',
            targetId: session.id,
            workspaceId: session.workspaceId,
            details: { quoted: session.totalCents, paid: event.amountTotalCents },
          });
          return true;
        }
        return this.checkout.completeSubscriptionCheckout(session.id, {
          source: 'PROVIDER',
          amountPaidCents: event.amountTotalCents,
          providerCustomerId: event.customerId,
          providerSubscriptionId: event.subscriptionId,
          eventAt: event.createdAt,
        });
      }

      case 'checkout.expired': {
        const session = await this.prisma.billingCheckoutSession.findFirst({
          where: event.checkoutId ? { id: event.checkoutId } : { providerSessionId: event.providerSessionId },
        });
        if (!session || session.status !== 'PENDING') return false;
        await this.checkout.failCheckout(session.id, 'EXPIRED', 'Checkout expired at the provider');
        return true;
      }

      case 'invoice.paid': {
        if (!event.subscriptionId) return false; // one-off invoice, not a subscription
        const sub = await this.findSubscription(event.subscriptionId, event.customerId);
        if (!sub) {
          // Provider may deliver the invoice before the checkout event — ask for a redelivery.
          throw new RetryWebhookLater(`No subscription yet for invoice ${event.providerInvoiceId}`);
        }
        const periodStart = event.periodStart ?? sub.currentPeriodStart;
        const periodEnd = event.periodEnd ?? sub.currentPeriodEnd;
        const plan = normalizePlanTier(sub.planTier);
        const number = event.number ?? `INV-${event.providerInvoiceId.slice(-8).toUpperCase()}`;
        await this.prisma.billingInvoice.upsert({
          where: { providerInvoiceId: event.providerInvoiceId },
          create: {
            workspaceId: sub.workspaceId,
            providerInvoiceId: event.providerInvoiceId,
            number,
            amountCents: event.amountPaidCents,
            currency: event.currency,
            status: 'PAID',
            description: `${PLANS_CONFIG[plan].name} plan`,
            periodStart,
            periodEnd,
            hostedUrl: event.hostedUrl,
            pdfUrl: event.pdfUrl,
            paidAt: event.paidAt ?? event.createdAt,
          },
          update: { status: 'PAID', paidAt: event.paidAt ?? event.createdAt, hostedUrl: event.hostedUrl, pdfUrl: event.pdfUrl },
        });
        if (this.isStale(sub, event.createdAt)) return true; // invoice recorded, state untouched
        const advances = periodEnd > sub.currentPeriodEnd;
        await this.prisma.workspaceSubscription.update({
          where: { workspaceId: sub.workspaceId },
          data: {
            status: sub.status === 'TRIALING' && event.amountPaidCents === 0 ? 'TRIALING' : 'ACTIVE',
            pastDueSince: null,
            providerEventAt: event.createdAt,
            ...(advances ? { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, renewAt: periodEnd } : {}),
          },
        });
        if (advances) await this.applyScheduledPlan(sub.workspaceId, { resetPeriod: false });
        if (event.amountPaidCents > 0) {
          await this.credits.grantPlanAllowance(sub.workspaceId, sub.planTier, `invoice:${event.providerInvoiceId}`);
        }
        this.events.emit(AppEvent.BillingNotice, {
          workspaceId: sub.workspaceId,
          actorId: null,
          title: 'Payment received',
          body: `Invoice ${number} was paid (${(event.amountPaidCents / 100).toFixed(2)} ${event.currency}).`,
          dedupeKey: `invoice-paid:${event.providerInvoiceId}`,
        });
        return true;
      }

      case 'invoice.payment_failed': {
        const sub = await this.findSubscription(event.subscriptionId, event.customerId);
        if (!sub || this.isStale(sub, event.createdAt)) return false;
        await this.prisma.workspaceSubscription.update({
          where: { workspaceId: sub.workspaceId },
          data: { status: 'PAST_DUE', pastDueSince: sub.pastDueSince ?? event.createdAt, providerEventAt: event.createdAt },
        });
        this.events.emit(AppEvent.BillingNotice, {
          workspaceId: sub.workspaceId,
          actorId: null,
          title: 'Payment failed',
          body: 'We could not collect your latest payment. Update your payment method to keep your plan.',
          dedupeKey: `invoice-failed:${event.providerInvoiceId}`,
        });
        return true;
      }

      case 'subscription.updated': {
        const sub = await this.findSubscription(event.subscriptionId, event.customerId);
        if (!sub || this.isStale(sub, event.createdAt)) return false;
        const status = STATUS_MAP[event.status] ?? sub.status;
        // A subscription we are replacing (upgrade) must not clobber the new one.
        if (sub.providerSubscriptionId && sub.providerSubscriptionId !== event.subscriptionId) return false;
        await this.prisma.workspaceSubscription.update({
          where: { workspaceId: sub.workspaceId },
          data: {
            status,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd,
            providerEventAt: event.createdAt,
            providerSubscriptionId: event.subscriptionId,
            pastDueSince: status === 'PAST_DUE' ? sub.pastDueSince ?? event.createdAt : null,
            ...(event.periodEnd && event.periodEnd > sub.currentPeriodEnd
              ? {
                  currentPeriodStart: event.periodStart ?? sub.currentPeriodStart,
                  currentPeriodEnd: event.periodEnd,
                  renewAt: event.periodEnd,
                }
              : {}),
          },
        });
        return true;
      }

      case 'subscription.deleted': {
        const sub = await this.prisma.workspaceSubscription.findFirst({
          where: { providerSubscriptionId: event.subscriptionId },
        });
        // Not ours any more (replaced by an upgrade) — nothing to downgrade.
        if (!sub || this.isStale(sub, event.createdAt)) return false;
        await this.downgradeToFree(sub.workspaceId, 'Subscription ended at the payment provider', event.createdAt);
        return true;
      }

      case 'charge.refunded': {
        if (!event.providerInvoiceId) return false;
        const invoice = await this.prisma.billingInvoice.findUnique({
          where: { providerInvoiceId: event.providerInvoiceId },
        });
        if (!invoice) return false;
        if (event.fullyRefunded) {
          await this.prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: 'REFUNDED' } });
        }
        await this.audit.record({
          action: 'INVOICE_REFUNDED',
          targetType: 'invoice',
          targetId: invoice.id,
          workspaceId: invoice.workspaceId,
          details: { amountRefundedCents: event.amountRefundedCents, full: event.fullyRefunded },
        });
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Applies a scheduled downgrade once its effective date has arrived. Moving to
   * Free ends the subscription; a lower paid tier just switches the plan (the
   * provider already charges the new price from the new period).
   */
  async applyScheduledPlan(workspaceId: string, opts: { resetPeriod: boolean }): Promise<boolean> {
    const sub = await this.prisma.workspaceSubscription.findUnique({ where: { workspaceId } });
    if (!sub?.scheduledPlanTier || !sub.scheduledChangeAt) return false;
    if (sub.scheduledChangeAt.getTime() - 60_000 > Date.now()) return false;

    const target = normalizePlanTier(sub.scheduledPlanTier);
    if (target === 'free') {
      await this.downgradeToFree(workspaceId, 'Your scheduled cancellation took effect.');
      return true;
    }
    const interval = (sub.scheduledBillingInterval ?? sub.billingInterval).toLowerCase() === 'annual' ? 'annual' : 'monthly';
    const now = new Date();
    const end = new Date(now);
    if (interval === 'annual') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        planTier: target.toUpperCase(),
        billingInterval: interval.toUpperCase(),
        scheduledPlanTier: null,
        scheduledBillingInterval: null,
        scheduledChangeAt: null,
        cancelAtPeriodEnd: false,
        ...(opts.resetPeriod ? { currentPeriodStart: now, currentPeriodEnd: end, renewAt: end } : {}),
      },
    });
    await this.audit.record({
      action: 'DOWNGRADE_APPLIED',
      targetType: 'subscription',
      targetId: workspaceId,
      workspaceId,
      details: { from: sub.planTier, to: target },
    });
    this.events.emit(AppEvent.BillingNotice, {
      workspaceId,
      actorId: null,
      title: `Your plan changed to ${PLANS_CONFIG[target].name}`,
      body: 'Your scheduled plan change has taken effect.',
      dedupeKey: `downgrade-applied:${workspaceId}:${sub.scheduledChangeAt.toISOString()}`,
    });
    return true;
  }

  /** Drops a workspace back to Free, keeping its data (limits then apply to *new* writes). */
  async downgradeToFree(workspaceId: string, reason: string, eventAt?: Date): Promise<void> {
    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        planTier: 'FREE',
        status: 'ACTIVE',
        source: 'FREE',
        provider: null,
        providerSubscriptionId: null,
        cancelAtPeriodEnd: false,
        cancelledAt: new Date(),
        pastDueSince: null,
        scheduledPlanTier: null,
        scheduledBillingInterval: null,
        scheduledChangeAt: null,
        appliedPromotionCode: null,
        discountPercent: null,
        ...(eventAt ? { providerEventAt: eventAt } : {}),
      },
    });
    await this.audit.record({
      action: 'SUBSCRIPTION_ENDED',
      targetType: 'subscription',
      targetId: workspaceId,
      workspaceId,
      details: { reason },
    });
    this.events.emit(AppEvent.BillingNotice, {
      workspaceId,
      actorId: null,
      title: 'Your workspace moved to the Free plan',
      body: reason,
      dedupeKey: `ended:${workspaceId}:${Date.now().toString(36)}`,
    });
  }
}
