import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface StripeAuth extends Record<string, string> {
  apiKey: string;
}

const at = (s?: number) => (s ? new Date(s * 1000).toISOString() : null);
const money = (amount: number, currency: string) => `${(amount / 100).toFixed(2)} ${String(currency).toUpperCase()}`;

const compactCustomer = (c: any) => ({ id: c.id, name: c.name ?? null, email: c.email ?? null, createdAt: at(c.created), balance: c.balance ?? 0, currency: c.currency ?? null });
const compactCharge = (c: any) => ({ id: c.id, amount: c.amount, currency: c.currency, display: money(c.amount, c.currency), status: c.status, paid: c.paid, refunded: c.refunded, customer: c.customer ?? null, description: c.description ?? null, receiptUrl: c.receipt_url ?? null, createdAt: at(c.created) });
const compactIntent = (p: any) => ({ id: p.id, amount: p.amount, currency: p.currency, display: money(p.amount, p.currency), status: p.status, customer: p.customer ?? null, description: p.description ?? null, createdAt: at(p.created) });
const compactSubscription = (s: any) => ({ id: s.id, status: s.status, customer: s.customer, cancelAtPeriodEnd: s.cancel_at_period_end, currentPeriodEnd: at(s.current_period_end ?? s.items?.data?.[0]?.current_period_end), items: (s.items?.data ?? []).map((i: any) => ({ price: i.price?.id, product: i.price?.product, quantity: i.quantity })) });
const compactInvoice = (i: any) => ({ id: i.id, number: i.number ?? null, status: i.status, amountDue: i.amount_due, display: money(i.amount_due ?? 0, i.currency ?? 'usd'), customer: i.customer, hostedUrl: i.hosted_invoice_url ?? null, createdAt: at(i.created) });

/**
 * Stripe with a restricted API key (Developers → API keys → Create restricted key).
 * Reads are free. Anything that changes money or customers asks for approval,
 * and a restricted key lets the account owner grant only what agents may do.
 */
@Injectable()
export class StripeProvider extends RestConnector<StripeAuth> {
  readonly providerId = 'STRIPE';
  protected readonly app = 'Stripe';
  protected readonly requiredFields = ['apiKey'] as const;
  protected readonly secrets = ['apiKey'];

  protected capabilities() {
    return {
      displayName: 'Stripe',
      description: 'Payments, customers and subscriptions — look up charges and customers, issue refunds, cancel subscriptions.',
      category: 'Finance',
      connectorCategory: 'finance',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'read', description: 'Read customers, charges, invoices and subscriptions', required: true },
        { scope: 'write', description: 'Create customers, refund and cancel (each asks for approval)' },
      ],
      credentialFields: [{ key: 'apiKey', label: 'Restricted API key', secret: true, placeholder: 'rk_live_… or rk_test_…', help: 'Use a restricted key (rk_…) limited to what agents need. Start with a test-mode key.' }],
    };
  }

  protected override validate(auth: StripeAuth) {
    if (!/^(sk|rk)_(live|test)_/.test(auth.apiKey)) throw new BadRequestException('That doesn’t look like a Stripe secret or restricted key (sk_… / rk_…).');
  }

  protected target(auth: StripeAuth) {
    return { baseUrl: 'https://api.stripe.com/v1', headers: { Authorization: `Bearer ${auth.apiKey}` } };
  }

  protected async ping(auth: StripeAuth, call: RestCall) {
    const balance = await call('GET', '/balance');
    return { label: balance.livemode === false || /_test_/.test(auth.apiKey) ? 'test mode' : 'live mode' };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      { id: 'new_charge', label: 'New payment', description: 'Starts the agent for each new charge.', pollActionId: 'list_charges', itemsPath: 'charges', idField: 'id' },
      { id: 'new_customer', label: 'New customer', description: 'Starts the agent for each new customer.', pollActionId: 'list_customers', itemsPath: 'customers', idField: 'id' },
    ];
  }

  protected actions(): RestAction<StripeAuth>[] {
    const limit = { limit: num('Max results (default 10).') };
    const lim = (input: Record<string, unknown>) => boundedInt(input['limit'], 10, 1, 100);
    return [
      action({ id: 'get_balance', label: 'Get balance', description: 'Available and pending balance.', level: 'read' }, async ({ call }) => {
        const b = await call('GET', '/balance');
        return { message: 'Fetched the balance.', data: { available: (b.available ?? []).map((x: any) => money(x.amount, x.currency)), pending: (b.pending ?? []).map((x: any) => money(x.amount, x.currency)) } };
      }),
      action({ id: 'list_customers', label: 'List customers', description: 'Customers, newest first. Optionally by exact email.', level: 'read', properties: { ...limit, email: str('Exact email to match.') } }, async ({ input, call }) => {
        const data = await call('GET', '/customers', { params: { limit: lim(input), ...(textOf(input['email']) ? { email: textOf(input['email']) } : {}) } });
        const customers = ((data.data ?? []) as any[]).map(compactCustomer);
        return { message: `Found ${customers.length} customer(s).`, data: { customers } };
      }),
      action({ id: 'get_customer', label: 'Get customer', description: 'Fetch one customer.', level: 'read', properties: { customerId: str('cus_…') }, required: ['customerId'] }, async ({ input, call }) => {
        const { customerId } = requireText(input, 'customerId');
        return { message: 'Fetched the customer.', data: { customer: compactCustomer(await call('GET', `/customers/${encodeURIComponent(customerId)}`)) } };
      }),
      action({ id: 'list_charges', label: 'List charges', description: 'Payments, newest first. Optionally for one customer.', level: 'read', properties: { ...limit, customerId: str('Only this customer.') } }, async ({ input, call }) => {
        const data = await call('GET', '/charges', { params: { limit: lim(input), ...(textOf(input['customerId']) ? { customer: textOf(input['customerId']) } : {}) } });
        const charges = ((data.data ?? []) as any[]).map(compactCharge);
        return { message: `Found ${charges.length} charge(s).`, data: { charges } };
      }),
      action({ id: 'list_payment_intents', label: 'List payment intents', description: 'Payment attempts, newest first.', level: 'read', properties: limit }, async ({ input, call }) => {
        const data = await call('GET', '/payment_intents', { params: { limit: lim(input) } });
        const paymentIntents = ((data.data ?? []) as any[]).map(compactIntent);
        return { message: `Found ${paymentIntents.length} payment intent(s).`, data: { paymentIntents } };
      }),
      action({ id: 'list_subscriptions', label: 'List subscriptions', description: 'Subscriptions; filter by customer or status.', level: 'read', properties: { ...limit, customerId: str('Only this customer.'), status: str('active, past_due, canceled, all…') } }, async ({ input, call }) => {
        const data = await call('GET', '/subscriptions', { params: { limit: lim(input), ...(textOf(input['customerId']) ? { customer: textOf(input['customerId']) } : {}), ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}) } });
        const subscriptions = ((data.data ?? []) as any[]).map(compactSubscription);
        return { message: `Found ${subscriptions.length} subscription(s).`, data: { subscriptions } };
      }),
      action({ id: 'list_invoices', label: 'List invoices', description: 'Invoices, newest first.', level: 'read', properties: { ...limit, customerId: str('Only this customer.'), status: str('draft, open, paid, uncollectible, void.') } }, async ({ input, call }) => {
        const data = await call('GET', '/invoices', { params: { limit: lim(input), ...(textOf(input['customerId']) ? { customer: textOf(input['customerId']) } : {}), ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}) } });
        const invoices = ((data.data ?? []) as any[]).map(compactInvoice);
        return { message: `Found ${invoices.length} invoice(s).`, data: { invoices } };
      }),
      action({ id: 'create_customer', label: 'Create customer', description: 'Add a customer.', level: 'write', properties: { email: str('Email.'), name: str('Name.'), description: str('Note.') }, required: ['email'] }, async ({ input, call }) => {
        const { email } = requireText(input, 'email');
        const c = await call('POST', '/customers', { form: true, data: compactObject({ email, name: textOf(input['name']), description: textOf(input['description']) }) });
        return { message: `Created customer ${email}.`, data: { customer: compactCustomer(c) } };
      }),
      action(
        { id: 'create_refund', label: 'Refund payment', description: 'Refund a charge, fully or partly. Money leaves your balance.', level: 'destructive', properties: { chargeId: str('ch_… to refund.'), amount: num('Amount in the smallest currency unit (cents). Empty = full refund.'), reason: str('duplicate, fraudulent or requested_by_customer.', { enum: ['duplicate', 'fraudulent', 'requested_by_customer'] }) }, required: ['chargeId'] },
        async ({ input, call }) => {
          const { chargeId } = requireText(input, 'chargeId');
          const r = await call('POST', '/refunds', { form: true, data: compactObject({ charge: chargeId, amount: input['amount'] === undefined ? undefined : boundedInt(input['amount'], 0, 1, 99_999_999), reason: textOf(input['reason']) }) });
          return { message: `Refunded ${money(r.amount, r.currency)}.`, data: { refund: { id: r.id, status: r.status, amount: r.amount, currency: r.currency } } };
        },
      ),
      action({ id: 'cancel_subscription', label: 'Cancel subscription', description: 'Cancel a subscription immediately.', level: 'destructive', properties: { subscriptionId: str('sub_…') }, required: ['subscriptionId'] }, async ({ input, call }) => {
        const { subscriptionId } = requireText(input, 'subscriptionId');
        return { message: 'Subscription canceled.', data: { subscription: compactSubscription(await call('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`)) } };
      }),
    ];
  }
}
