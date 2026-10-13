import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidWebhookSignatureError } from './payment-provider.js';
import { StripeProvider, encodeForm, verifyStripeSignature } from './stripe.provider.js';

const SECRET = 'whsec_test_secret';

function sign(body: string, timestamp: number, secret = SECRET) {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

function providerWith(env: Record<string, string> = {}) {
  const config = { get: (k: string) => ({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET, ...env })[k] };
  return new StripeProvider(config as never);
}

describe('verifyStripeSignature', () => {
  const body = JSON.stringify({ id: 'evt_1' });
  const now = 1_700_000_000;

  it('accepts a correct signature', () => {
    expect(() => verifyStripeSignature(Buffer.from(body), sign(body, now), SECRET, now)).not.toThrow();
  });

  it('rejects a tampered body', () => {
    expect(() => verifyStripeSignature(Buffer.from(body + ' '), sign(body, now), SECRET, now)).toThrow(
      InvalidWebhookSignatureError,
    );
  });

  it('rejects a wrong secret, missing header and malformed header', () => {
    expect(() => verifyStripeSignature(Buffer.from(body), sign(body, now, 'other'), SECRET, now)).toThrow(
      InvalidWebhookSignatureError,
    );
    expect(() => verifyStripeSignature(Buffer.from(body), undefined, SECRET, now)).toThrow(InvalidWebhookSignatureError);
    expect(() => verifyStripeSignature(Buffer.from(body), 'garbage', SECRET, now)).toThrow(InvalidWebhookSignatureError);
  });

  it('rejects replays outside the tolerance window', () => {
    expect(() => verifyStripeSignature(Buffer.from(body), sign(body, now), SECRET, now + 3600)).toThrow(
      InvalidWebhookSignatureError,
    );
  });

  it('accepts when any of several v1 signatures matches (secret rotation)', () => {
    const good = sign(body, now).split(',')[1];
    const header = `t=${now},v1=${'00'.repeat(32)},${good}`;
    expect(() => verifyStripeSignature(Buffer.from(body), header, SECRET, now)).not.toThrow();
  });
});

describe('StripeProvider.parseWebhook', () => {
  const t = Math.floor(Date.now() / 1000);
  const parse = (event: unknown) => {
    const raw = JSON.stringify(event);
    return providerWith().parseWebhook(Buffer.from(raw), sign(raw, t));
  };

  it('refuses unsigned payloads outright', () => {
    expect(() => providerWith().parseWebhook(Buffer.from('{}'), undefined)).toThrow(InvalidWebhookSignatureError);
  });

  it('maps checkout.session.completed', () => {
    const e = parse({
      id: 'evt_1',
      type: 'checkout.session.completed',
      created: t,
      data: {
        object: {
          id: 'cs_1',
          client_reference_id: 'chk_1',
          customer: 'cus_1',
          subscription: 'sub_1',
          amount_total: 3000,
          payment_status: 'paid',
        },
      },
    });
    expect(e).toMatchObject({ type: 'checkout.completed', checkoutId: 'chk_1', subscriptionId: 'sub_1', amountTotalCents: 3000, paid: true });
  });

  it('treats unpaid sessions as not paid', () => {
    const e = parse({
      id: 'evt_2',
      type: 'checkout.session.completed',
      created: t,
      data: { object: { id: 'cs_2', client_reference_id: 'c', amount_total: 3000, payment_status: 'unpaid' } },
    });
    expect(e).toMatchObject({ type: 'checkout.completed', paid: false });
  });

  it('maps invoice.paid including the newer parent.subscription_details shape', () => {
    const e = parse({
      id: 'evt_3',
      type: 'invoice.paid',
      created: t,
      data: {
        object: {
          id: 'in_1',
          parent: { subscription_details: { subscription: 'sub_9' } },
          customer: 'cus_1',
          amount_paid: 2700,
          currency: 'usd',
          number: 'N-1',
          lines: { data: [{ period: { start: t, end: t + 86400 } }] },
        },
      },
    });
    expect(e).toMatchObject({ type: 'invoice.paid', subscriptionId: 'sub_9', amountPaidCents: 2700, currency: 'USD' });
  });

  it('maps subscription period from items when absent at top level', () => {
    const e = parse({
      id: 'evt_4',
      type: 'customer.subscription.updated',
      created: t,
      data: {
        object: {
          id: 'sub_1',
          status: 'past_due',
          cancel_at_period_end: true,
          items: { data: [{ current_period_start: t, current_period_end: t + 100 }] },
        },
      },
    });
    expect(e).toMatchObject({ type: 'subscription.updated', status: 'past_due', cancelAtPeriodEnd: true });
    expect((e as { periodEnd: Date }).periodEnd.getTime()).toBe((t + 100) * 1000);
  });

  it('ignores unrelated event types without throwing', () => {
    expect(parse({ id: 'evt_5', type: 'customer.created', created: t, data: { object: {} } })).toMatchObject({
      type: 'ignored',
      rawType: 'customer.created',
    });
  });
});

describe('StripeProvider requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is unconfigured without both keys', () => {
    expect(new StripeProvider({ get: () => undefined } as never).isConfigured()).toBe(false);
    expect(providerWith().isConfigured()).toBe(true);
    expect(providerWith().mode).toBe('test');
    expect(providerWith({ STRIPE_SECRET_KEY: 'sk_live_abc' }).mode).toBe('live');
  });

  it('creates a discounted subscription session with a one-time coupon and metadata', async () => {
    const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body?: string; headers: Record<string, string> }) => {
        calls.push({ url, body: init.body ?? '', headers: init.headers });
        const json = url.endsWith('/coupons') ? { id: 'co_1' } : { id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' };
        return { ok: true, status: 200, json: async () => json };
      }),
    );

    const res = await providerWith().createCheckout({
      checkoutId: 'chk_1',
      workspaceId: 'ws_1',
      kind: 'SUBSCRIPTION',
      planTier: 'pro',
      billingInterval: 'annual',
      currency: 'USD',
      productName: 'Pro plan',
      unitAmountCents: 28800,
      discountCents: 28800,
      couponLabel: 'DEMO',
      customerEmail: 'a@b.co',
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/no',
      idempotencyKey: 'checkout:chk_1',
    });

    expect(res).toEqual({ providerSessionId: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });
    const [coupon, session] = calls;
    expect(coupon.body).toContain('amount_off=28800');
    expect(coupon.body).toContain('duration=once');
    const body = decodeURIComponent(session.body);
    expect(body).toContain('mode=subscription');
    expect(body).toContain('line_items[0][price_data][recurring][interval]=year');
    expect(body).toContain('line_items[0][price_data][unit_amount]=28800');
    expect(body).toContain('discounts[0][coupon]=co_1');
    expect(body).toContain('client_reference_id=chk_1');
    expect(body).toContain('payment_method_collection=if_required'); // 100% off still goes through the provider
    expect(session.headers['Idempotency-Key']).toBe('checkout:chk_1');
    expect(session.headers['Authorization']).toBe('Bearer sk_test_x');
  });

  it('surfaces provider failures as retryable/non-retryable errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'down' } }) })));
    await expect(providerWith().cancelAtPeriodEnd('sub_1')).rejects.toMatchObject({ retryable: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'bad' } }) })));
    await expect(providerWith().cancelAtPeriodEnd('sub_1')).rejects.toMatchObject({ retryable: false });
  });
});

describe('encodeForm', () => {
  it('encodes nested objects and arrays Stripe-style and skips undefined', () => {
    expect(
      encodeForm({ a: 1, b: { c: 'x y' }, d: [{ e: 2 }], f: undefined, g: null }).map(decodeURIComponent),
    ).toEqual(['a=1', 'b[c]=x y', 'd[0][e]=2']);
  });
});
