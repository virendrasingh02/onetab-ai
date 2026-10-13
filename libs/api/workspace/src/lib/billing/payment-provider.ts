import type { PlanBillingInterval } from '@org/types';

/**
 * Provider-agnostic payment boundary. Billing code talks only to this
 * interface; Stripe (or any other processor) is one implementation. No card
 * data ever reaches us — the provider hosts the payment page.
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface ProviderCheckoutInput {
  checkoutId: string;
  workspaceId: string;
  kind: 'SUBSCRIPTION' | 'CREDIT_TOPUP';
  planTier: string;
  billingInterval: PlanBillingInterval;
  currency: string;
  productName: string;
  /** Full price of one billing period (or the top-up amount), before discount. */
  unitAmountCents: number;
  /** Discount applied to this first payment only. */
  discountCents: number;
  couponLabel?: string | null;
  trialDays?: number;
  customerEmail?: string | null;
  existingCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface ProviderCheckoutResult {
  providerSessionId: string;
  url: string;
}

export interface ProviderScheduleChangeInput {
  providerSubscriptionId: string;
  planTier: string;
  billingInterval: PlanBillingInterval;
  currency: string;
  productName: string;
  unitAmountCents: number;
  workspaceId: string;
}

/** Normalised webhook events; `createdAt` lets handlers ignore stale, out-of-order deliveries. */
export type ProviderEvent =
  | {
      type: 'checkout.completed';
      id: string;
      createdAt: Date;
      checkoutId: string | null;
      providerSessionId: string;
      customerId: string | null;
      subscriptionId: string | null;
      amountTotalCents: number;
      /** Provider confirms money was collected, or that none was required. */
      paid: boolean;
    }
  | { type: 'checkout.expired'; id: string; createdAt: Date; checkoutId: string | null; providerSessionId: string }
  | {
      type: 'invoice.paid';
      id: string;
      createdAt: Date;
      providerInvoiceId: string;
      subscriptionId: string | null;
      customerId: string | null;
      amountPaidCents: number;
      currency: string;
      number: string | null;
      periodStart: Date | null;
      periodEnd: Date | null;
      hostedUrl: string | null;
      pdfUrl: string | null;
      paidAt: Date | null;
    }
  | {
      type: 'invoice.payment_failed';
      id: string;
      createdAt: Date;
      providerInvoiceId: string;
      subscriptionId: string | null;
      customerId: string | null;
      amountDueCents: number;
    }
  | {
      type: 'subscription.updated';
      id: string;
      createdAt: Date;
      subscriptionId: string;
      customerId: string | null;
      status: string;
      cancelAtPeriodEnd: boolean;
      periodStart: Date | null;
      periodEnd: Date | null;
      workspaceId: string | null;
    }
  | { type: 'subscription.deleted'; id: string; createdAt: Date; subscriptionId: string; customerId: string | null }
  | {
      type: 'charge.refunded';
      id: string;
      createdAt: Date;
      providerInvoiceId: string | null;
      amountRefundedCents: number;
      fullyRefunded: boolean;
    }
  | { type: 'ignored'; id: string; createdAt: Date; rawType: string };

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export class InvalidWebhookSignatureError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  /** False when credentials are missing — paid checkout must then fail closed. */
  isConfigured(): boolean;
  /** `live` credentials move real money; anything else is a sandbox. */
  readonly mode: 'test' | 'live';
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>;
  /** Keep access until the period ends, then stop renewing. */
  cancelAtPeriodEnd(providerSubscriptionId: string): Promise<void>;
  resume(providerSubscriptionId: string): Promise<void>;
  /** Cancel immediately with no refund (used when an upgrade replaces a subscription). */
  cancelNow(providerSubscriptionId: string): Promise<void>;
  /** Switch the plan at the end of the current period (scheduled downgrade). */
  scheduleChangeAtPeriodEnd(input: ProviderScheduleChangeInput): Promise<void>;
  createPortalSession(customerId: string, returnUrl: string): Promise<string>;
  /** Throws InvalidWebhookSignatureError on a bad/stale signature. */
  parseWebhook(rawBody: Buffer, signatureHeader: string | undefined): ProviderEvent;
}
