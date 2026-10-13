import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  InvalidWebhookSignatureError,
  PaymentProviderError,
  type PaymentProvider,
  type ProviderCheckoutInput,
  type ProviderCheckoutResult,
  type ProviderEvent,
  type ProviderScheduleChangeInput,
} from './payment-provider.js';

const STRIPE_API = 'https://api.stripe.com/v1';
/** Stripe's documented default replay tolerance. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

type Json = Record<string, any>;

/** Stripe's API takes bracketed form-encoding: a[b][0][c]=d. */
export function encodeForm(data: Json, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') out.push(...encodeForm(item, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === 'object') {
      out.push(...encodeForm(value, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

/** Verifies `Stripe-Signature: t=...,v1=...` over the exact raw bytes. */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  if (!header) throw new InvalidWebhookSignatureError('Missing signature header');
  const parts = header.split(',').map((p) => p.trim().split('=') as [string, string]);
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || signatures.length === 0) throw new InvalidWebhookSignatureError('Malformed signature header');
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new InvalidWebhookSignatureError('Signature timestamp outside tolerance');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const ok = signatures.some((sig) => {
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new InvalidWebhookSignatureError('Signature mismatch');
}

const toDate = (seconds: unknown): Date | null =>
  typeof seconds === 'number' && seconds > 0 ? new Date(seconds * 1000) : null;

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string | undefined {
    return this.config.get<string>('STRIPE_SECRET_KEY') || undefined;
  }

  private get webhookSecret(): string | undefined {
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET') || undefined;
  }

  isConfigured(): boolean {
    return !!this.secretKey && !!this.webhookSecret;
  }

  get mode(): 'test' | 'live' {
    return this.secretKey?.startsWith('sk_live_') || this.secretKey?.startsWith('rk_live_') ? 'live' : 'test';
  }

  private async call<T = Json>(
    method: 'GET' | 'POST',
    path: string,
    body?: Json,
    idempotencyKey?: string,
  ): Promise<T> {
    const key = this.secretKey;
    if (!key) throw new PaymentProviderError('Stripe is not configured.');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    let res: Response;
    try {
      res = await fetch(`${STRIPE_API}${path}`, {
        method,
        headers,
        body: method === 'POST' && body ? encodeForm(body).join('&') : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new PaymentProviderError(
        `Could not reach the payment provider: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) {
      this.logger.warn(`Stripe ${method} ${path} -> ${res.status} ${json?.error?.message ?? ''}`);
      throw new PaymentProviderError(
        json?.error?.message ?? `Payment provider returned HTTP ${res.status}`,
        res.status >= 500 || res.status === 429,
      );
    }
    return json as T;
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    const isSubscription = input.kind === 'SUBSCRIPTION';
    const meta = {
      checkoutId: input.checkoutId,
      workspaceId: input.workspaceId,
      kind: input.kind,
      planTier: input.planTier,
      billingInterval: input.billingInterval,
    };

    let couponId: string | undefined;
    if (input.discountCents > 0) {
      const coupon = await this.call<{ id: string }>(
        'POST',
        '/coupons',
        {
          amount_off: input.discountCents,
          currency: input.currency.toLowerCase(),
          duration: 'once',
          max_redemptions: 1,
          name: input.couponLabel ?? 'Discount',
          metadata: { checkoutId: input.checkoutId },
        },
        `${input.idempotencyKey}:coupon`,
      );
      couponId = coupon.id;
    }

    const priceData: Json = {
      currency: input.currency.toLowerCase(),
      unit_amount: input.unitAmountCents,
      product_data: { name: input.productName },
    };
    if (isSubscription) {
      priceData['recurring'] = { interval: input.billingInterval === 'annual' ? 'year' : 'month' };
    }

    const fullyDiscounted = input.discountCents >= input.unitAmountCents;
    const params: Json = {
      mode: isSubscription ? 'subscription' : 'payment',
      client_reference_id: input.checkoutId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [{ quantity: 1, price_data: priceData }],
      metadata: meta,
      ...(isSubscription ? { subscription_data: { metadata: meta, trial_period_days: input.trialDays || undefined } } : {}),
      ...(!isSubscription ? { payment_intent_data: { metadata: meta } } : {}),
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      ...(fullyDiscounted && isSubscription ? { payment_method_collection: 'if_required' } : {}),
      ...(input.existingCustomerId
        ? { customer: input.existingCustomerId }
        : input.customerEmail
          ? { customer_email: input.customerEmail }
          : {}),
      ...(this.config.get<string>('STRIPE_AUTOMATIC_TAX') === 'true' ? { automatic_tax: { enabled: true } } : {}),
    };

    const session = await this.call<{ id: string; url: string }>(
      'POST',
      '/checkout/sessions',
      params,
      input.idempotencyKey,
    );
    if (!session.url) throw new PaymentProviderError('Payment provider did not return a checkout URL.');
    return { providerSessionId: session.id, url: session.url };
  }

  async cancelAtPeriodEnd(id: string): Promise<void> {
    await this.call('POST', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true });
  }

  async resume(id: string): Promise<void> {
    await this.call('POST', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: false });
  }

  async cancelNow(id: string): Promise<void> {
    await this.call('POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, { prorate: false, invoice_now: false });
  }

  async scheduleChangeAtPeriodEnd(input: ProviderScheduleChangeInput): Promise<void> {
    // A subscription schedule lets the current phase run to its end, then
    // switches the price — no proration, no immediate charge.
    const schedule = await this.call<Json>('POST', '/subscription_schedules', {
      from_subscription: input.providerSubscriptionId,
    });
    const current = schedule['phases']?.[0];
    const currentItem = current?.items?.[0];
    if (!current || !currentItem?.price) {
      throw new PaymentProviderError('Could not read the current subscription phase.');
    }
    const priceId = typeof currentItem.price === 'string' ? currentItem.price : currentItem.price.id;
    const price = await this.call<Json>('GET', `/prices/${encodeURIComponent(priceId)}`);
    await this.call('POST', `/subscription_schedules/${encodeURIComponent(schedule['id'])}`, {
      end_behavior: 'release',
      phases: [
        {
          start_date: current.start_date,
          end_date: current.end_date,
          items: [{ price: priceId, quantity: 1 }],
        },
        {
          items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.unitAmountCents,
                recurring: { interval: input.billingInterval === 'annual' ? 'year' : 'month' },
                product: price['product'],
              },
            },
          ],
          metadata: {
            workspaceId: input.workspaceId,
            planTier: input.planTier,
            billingInterval: input.billingInterval,
          },
        },
      ],
    });
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.call<{ url: string }>('POST', '/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  parseWebhook(rawBody: Buffer, signatureHeader: string | undefined): ProviderEvent {
    const secret = this.webhookSecret;
    if (!secret) throw new InvalidWebhookSignatureError('Webhook secret is not configured');
    verifyStripeSignature(rawBody, signatureHeader, secret);

    const event = JSON.parse(rawBody.toString('utf8')) as Json;
    const obj: Json = event?.data?.object ?? {};
    const base = { id: String(event.id), createdAt: toDate(event.created) ?? new Date() };

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return {
          ...base,
          type: 'checkout.completed',
          checkoutId: obj['client_reference_id'] ?? obj['metadata']?.checkoutId ?? null,
          providerSessionId: obj['id'],
          customerId: obj['customer'] ?? null,
          subscriptionId: obj['subscription'] ?? null,
          amountTotalCents: obj['amount_total'] ?? 0,
          paid: obj['payment_status'] === 'paid' || obj['payment_status'] === 'no_payment_required',
        };
      case 'checkout.session.expired':
        return {
          ...base,
          type: 'checkout.expired',
          checkoutId: obj['client_reference_id'] ?? obj['metadata']?.checkoutId ?? null,
          providerSessionId: obj['id'],
        };
      case 'invoice.paid': {
        const line = obj['lines']?.data?.[0];
        return {
          ...base,
          type: 'invoice.paid',
          providerInvoiceId: obj['id'],
          subscriptionId:
            obj['subscription'] ?? obj['parent']?.subscription_details?.subscription ?? line?.subscription ?? null,
          customerId: obj['customer'] ?? null,
          amountPaidCents: obj['amount_paid'] ?? 0,
          currency: String(obj['currency'] ?? 'usd').toUpperCase(),
          number: obj['number'] ?? null,
          periodStart: toDate(line?.period?.start ?? obj['period_start']),
          periodEnd: toDate(line?.period?.end ?? obj['period_end']),
          hostedUrl: obj['hosted_invoice_url'] ?? null,
          pdfUrl: obj['invoice_pdf'] ?? null,
          paidAt: toDate(obj['status_transitions']?.paid_at),
        };
      }
      case 'invoice.payment_failed':
        return {
          ...base,
          type: 'invoice.payment_failed',
          providerInvoiceId: obj['id'],
          subscriptionId: obj['subscription'] ?? obj['parent']?.subscription_details?.subscription ?? null,
          customerId: obj['customer'] ?? null,
          amountDueCents: obj['amount_due'] ?? 0,
        };
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const item = obj['items']?.data?.[0];
        return {
          ...base,
          type: 'subscription.updated',
          subscriptionId: obj['id'],
          customerId: obj['customer'] ?? null,
          status: obj['status'],
          cancelAtPeriodEnd: !!obj['cancel_at_period_end'],
          periodStart: toDate(obj['current_period_start'] ?? item?.current_period_start),
          periodEnd: toDate(obj['current_period_end'] ?? item?.current_period_end),
          workspaceId: obj['metadata']?.workspaceId ?? null,
        };
      }
      case 'customer.subscription.deleted':
        return {
          ...base,
          type: 'subscription.deleted',
          subscriptionId: obj['id'],
          customerId: obj['customer'] ?? null,
        };
      case 'charge.refunded':
        return {
          ...base,
          type: 'charge.refunded',
          providerInvoiceId: obj['invoice'] ?? null,
          amountRefundedCents: obj['amount_refunded'] ?? 0,
          fullyRefunded: obj['refunded'] === true,
        };
      default:
        return { ...base, type: 'ignored', rawType: String(event.type) };
    }
  }
}
