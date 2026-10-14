import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface RazorpayAuth extends Record<string, string> {
  keyId: string;
  keySecret: string;
}

const at = (s?: number) => (s ? new Date(s * 1000).toISOString() : null);
const show = (amount: number, currency: string) => `${(amount / 100).toFixed(2)} ${currency}`;

const compactOrder = (o: any) => ({ id: o.id, amount: o.amount, currency: o.currency, display: show(o.amount, o.currency), status: o.status, receipt: o.receipt ?? null, amountPaid: o.amount_paid, createdAt: at(o.created_at) });
const compactPayment = (p: any) => ({ id: p.id, amount: p.amount, currency: p.currency, display: show(p.amount, p.currency), status: p.status, method: p.method, orderId: p.order_id ?? null, email: p.email ?? null, contact: p.contact ?? null, captured: p.captured, refunded: p.amount_refunded ?? 0, errorDescription: p.error_description ?? null, createdAt: at(p.created_at) });

/** Razorpay with an API key pair (Dashboard → Account & Settings → API keys). Amounts are in paise. */
@Injectable()
export class RazorpayProvider extends RestConnector<RazorpayAuth> {
  readonly providerId = 'RAZORPAY';
  protected readonly app = 'Razorpay';
  protected readonly requiredFields = ['keyId', 'keySecret'] as const;
  protected readonly secrets = ['keySecret'];

  protected capabilities() {
    return {
      displayName: 'Razorpay',
      description: 'Payment orders, payments and payment links — check payment status, create orders and links, refund.',
      category: 'Finance',
      connectorCategory: 'finance',
      authType: 'API_KEY_HEADER' as const,
      scopes: [
        { scope: 'read', description: 'Read orders and payments', required: true },
        { scope: 'write', description: 'Create orders, payment links and refunds (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'keyId', label: 'Key ID', placeholder: 'rzp_test_… or rzp_live_…', help: 'Dashboard → Account & Settings → API keys. Start with test mode.' },
        { key: 'keySecret', label: 'Key secret', secret: true },
      ],
    };
  }

  protected target(auth: RazorpayAuth) {
    return { baseUrl: 'https://api.razorpay.com/v1', basic: { username: auth.keyId, password: auth.keySecret } };
  }

  protected async ping(auth: RazorpayAuth, call: RestCall) {
    await call('GET', '/orders', { params: { count: 1 } });
    return { label: auth.keyId.startsWith('rzp_test_') ? 'test mode' : 'live mode', accountId: auth.keyId };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_payment', label: 'New payment', description: 'Starts the agent for each new payment.', pollActionId: 'list_payments', itemsPath: 'payments', idField: 'id' }];
  }

  protected actions(): RestAction<RazorpayAuth>[] {
    const paging = { limit: num('Max results (default 10).') };
    const page = (input: Record<string, unknown>) => ({ count: boundedInt(input['limit'], 10, 1, 100) });
    return [
      action({ id: 'list_orders', label: 'List orders', description: 'Orders, newest first.', level: 'read', properties: paging }, async ({ input, call }) => {
        const data = await call('GET', '/orders', { params: page(input) });
        const orders = ((data.items ?? []) as any[]).map(compactOrder);
        return { message: `Found ${orders.length} order(s).`, data: { orders } };
      }),
      action({ id: 'get_order', label: 'Get order', description: 'Fetch one order.', level: 'read', properties: { orderId: str('order_…') }, required: ['orderId'] }, async ({ input, call }) => {
        const { orderId } = requireText(input, 'orderId');
        return { message: 'Fetched the order.', data: { order: compactOrder(await call('GET', `/orders/${encodeURIComponent(orderId)}`)) } };
      }),
      action({ id: 'list_payments', label: 'List payments', description: 'Payments, newest first.', level: 'read', properties: paging }, async ({ input, call }) => {
        const data = await call('GET', '/payments', { params: page(input) });
        const payments = ((data.items ?? []) as any[]).map(compactPayment);
        return { message: `Found ${payments.length} payment(s).`, data: { payments } };
      }),
      action({ id: 'get_payment', label: 'Get payment', description: 'Fetch one payment and its status.', level: 'read', properties: { paymentId: str('pay_…') }, required: ['paymentId'] }, async ({ input, call }) => {
        const { paymentId } = requireText(input, 'paymentId');
        return { message: 'Fetched the payment.', data: { payment: compactPayment(await call('GET', `/payments/${encodeURIComponent(paymentId)}`)) } };
      }),
      action(
        { id: 'create_order', label: 'Create order', description: 'Create a payment order. Amount is in paise (₹1 = 100).', level: 'write', properties: { amount: num('Amount in paise.'), currency: str('Currency (default INR).'), receipt: str('Your reference.') }, required: ['amount'] },
        async ({ input, call }) => {
          const amount = boundedInt(input['amount'], 0, 0, 99_999_999_99);
          if (amount < 100) throw new BadRequestException('amount must be at least 100 paise.');
          const o = await call('POST', '/orders', { data: compactObject({ amount, currency: textOf(input['currency']) || 'INR', receipt: textOf(input['receipt']) }) });
          return { message: `Created order ${o.id}.`, data: { order: compactOrder(o) } };
        },
      ),
      action(
        { id: 'create_payment_link', label: 'Create payment link', description: 'Make a shareable link to collect a payment. Amount is in paise.', level: 'write', properties: { amount: num('Amount in paise.'), description: str('What it is for.'), customerName: str('Customer name.'), customerEmail: str('Customer email.'), customerContact: str('Customer phone.') }, required: ['amount', 'description'] },
        async ({ input, call }) => {
          const { description } = requireText(input, 'description');
          const link = await call('POST', '/payment_links', {
            data: { amount: boundedInt(input['amount'], 0, 100, 99_999_999_99), currency: 'INR', description, customer: compactObject({ name: textOf(input['customerName']), email: textOf(input['customerEmail']), contact: textOf(input['customerContact']) }) },
          });
          return { message: 'Created the payment link.', data: { paymentLink: { id: link.id, url: link.short_url, status: link.status, amount: link.amount } } };
        },
      ),
      action(
        { id: 'refund_payment', label: 'Refund payment', description: 'Refund a captured payment, fully or partly (paise).', level: 'destructive', properties: { paymentId: str('pay_…'), amount: num('Amount in paise. Empty = full refund.') }, required: ['paymentId'] },
        async ({ input, call }) => {
          const { paymentId } = requireText(input, 'paymentId');
          const r = await call('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { data: compactObject({ amount: input['amount'] === undefined ? undefined : boundedInt(input['amount'], 0, 1, 99_999_999_99) }) });
          return { message: `Refund ${r.status}.`, data: { refund: { id: r.id, status: r.status, amount: r.amount } } };
        },
      ),
    ];
  }
}
