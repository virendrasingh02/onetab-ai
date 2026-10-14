import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { connectorRequest, ConnectorHttpError } from '../core/connector-http.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import type {
  ConnectorInboundEvent,
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { boundedInt, parseCredentialBundle, requireText, textOf } from './credential-json.js';

const APP = 'Shopify';
export const SHOPIFY_API_VERSION = '2025-01';
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

interface ShopifyAuth extends Record<string, string> {
  shopDomain: string;
  accessToken: string;
  apiSecret: string;
  apiVersion: string;
}

/** `https://My-Shop.myshopify.com/admin` → `my-shop.myshopify.com`. Only Shopify's own hosts are accepted. */
export function normalizeShopDomain(raw: string): string {
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '');
  if (!SHOP_DOMAIN.test(host)) {
    throw new BadRequestException('Enter the shop’s myshopify.com address, for example my-store.myshopify.com.');
  }
  return host;
}

function readAuth(accessToken: string): ShopifyAuth {
  const auth = parseCredentialBundle<ShopifyAuth>(accessToken, APP, ['shopDomain', 'accessToken']);
  return { ...auth, shopDomain: normalizeShopDomain(auth.shopDomain), apiVersion: auth.apiVersion || SHOPIFY_API_VERSION };
}

/** Order fields agents need — not the whole payload, which carries far more personal data. */
export function compactOrder(o: any) {
  return {
    id: o.id,
    name: o.name,
    orderNumber: o.order_number,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status,
    cancelledAt: o.cancelled_at,
    currency: o.currency,
    totalPrice: o.total_price,
    email: o.email ?? o.customer?.email,
    phone: o.phone ?? o.shipping_address?.phone ?? o.customer?.phone,
    note: o.note,
    tags: o.tags,
    customer: o.customer
      ? {
          id: o.customer.id,
          firstName: o.customer.first_name,
          lastName: o.customer.last_name,
          email: o.customer.email,
          phone: o.customer.phone,
          smsConsent: o.customer.sms_marketing_consent?.state,
          emailConsent: o.customer.email_marketing_consent?.state,
        }
      : undefined,
    lineItems: Array.isArray(o.line_items)
      ? o.line_items.map((l: any) => ({ title: l.title, quantity: l.quantity, price: l.price, sku: l.sku }))
      : [],
    shippingCity: o.shipping_address?.city,
    shippingCountry: o.shipping_address?.country,
  };
}

function compactProduct(p: any) {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    vendor: p.vendor,
    productType: p.product_type,
    tags: p.tags,
    variants: Array.isArray(p.variants)
      ? p.variants.map((v: any) => ({ id: v.id, title: v.title, price: v.price, sku: v.sku, inventoryQuantity: v.inventory_quantity }))
      : [],
  };
}

function compactCustomer(c: any) {
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    email: c.email,
    phone: c.phone,
    ordersCount: c.orders_count,
    totalSpent: c.total_spent,
    smsConsent: c.sms_marketing_consent?.state,
    emailConsent: c.email_marketing_consent?.state,
  };
}

/**
 * Shopify Admin REST API, connected with a custom app's Admin API access
 * token (the shop owner creates it under Settings → Apps → Develop apps, with
 * only the scopes they want agents to have). The token, and the app's API
 * secret used to verify webhooks, are stored encrypted like every manual
 * credential; the shop address is restricted to `*.myshopify.com`.
 */
@Injectable()
export class ShopifyProvider implements ProviderAdapter {
  readonly providerId = 'SHOPIFY';
  private readonly logger = new Logger(ShopifyProvider.name);

  constructor(private readonly ssrf: SSRFGuardService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Shopify',
      description: 'Read orders, products and customers, and act on orders in your Shopify store through the Admin API.',
      category: 'Commerce',
      connectorCategory: 'commerce',
      authType: 'BEARER',
      supportsSync: false,
      supportsWebhooks: true,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'read_orders', description: 'Read orders and transactions', required: true },
        { scope: 'read_products', description: 'Read products and inventory' },
        { scope: 'read_customers', description: 'Read customers (needed to see contact details and consent)' },
        { scope: 'write_orders', description: 'Add order notes, cancel orders and issue refunds (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'shopDomain', label: 'Shop address', placeholder: 'my-store.myshopify.com' },
        {
          key: 'accessToken',
          label: 'Admin API access token',
          secret: true,
          help: 'Create a custom app in Shopify admin (Settings → Apps and sales channels → Develop apps) and install it with only the scopes you need.',
        },
        {
          key: 'apiSecret',
          label: 'API secret key',
          secret: true,
          optional: true,
          help: 'Only needed to receive Shopify webhooks (order paid, cancelled). Found next to the token.',
        },
      ],
    };
  }

  secretFields(): string[] {
    return ['accessToken', 'apiSecret'];
  }

  private async call<T = any>(
    auth: ShopifyAuth,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ) {
    const url = `https://${auth.shopDomain}/admin/api/${auth.apiVersion}${path}`;
    return connectorRequest<T>(APP, {
      method,
      url,
      headers: { 'X-Shopify-Access-Token': auth.accessToken, Accept: 'application/json' },
      params: options.params,
      data: options.data,
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const auth = readAuth(credential.accessToken);
    const { data } = await this.call(auth, 'GET', '/shop.json');
    const shop = data.shop ?? {};
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: String(shop.id ?? auth.shopDomain),
      email: shop.email,
      name: shop.name ?? auth.shopDomain,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { shopDomain: auth.shopDomain, plan: shop.plan_name, currency: shop.currency },
    };
  }

  async disconnect(): Promise<void> {
    // The token belongs to the shop owner's custom app; they revoke it in Shopify admin.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'shopify.webhook', data: payload };
  }

  async testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const auth = credential
        ? readAuth(credential.accessToken)
        : readAuth(JSON.stringify({ ...config, shopDomain: normalizeShopDomain(String(config['shopDomain'] ?? '')) }));
      const { data } = await this.call(auth, 'GET', '/shop.json');
      return { success: true, message: `Connected to ${data.shop?.name ?? auth.shopDomain}.`, details: { name: data.shop?.name, displayName: data.shop?.name ?? auth.shopDomain } };
    } catch (error) {
      return { success: false, message: `Shopify connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /* ----------------------------------------------------------- webhooks -- */

  verifyWebhook(credential: ResolvedCredential, rawBody: string, headers: Record<string, string>): boolean {
    const auth = readAuth(credential.accessToken);
    const given = headers['x-shopify-hmac-sha256'];
    if (!auth.apiSecret || !given) return false;
    const expected = createHmac('sha256', auth.apiSecret).update(rawBody, 'utf8').digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhookEvents(_credential: ResolvedCredential, payload: unknown, headers: Record<string, string>): ConnectorInboundEvent[] {
    const topic = headers['x-shopify-topic'];
    const triggerId = topic === 'orders/paid' ? 'order_paid' : topic === 'orders/cancelled' ? 'order_cancelled' : null;
    if (!triggerId || !payload || typeof payload !== 'object') return [];
    const order = payload as Record<string, any>;
    return [
      {
        eventId: headers['x-shopify-webhook-id'] || `${topic}:${order['id']}:${order['updated_at'] ?? ''}`,
        triggerId,
        item: compactOrder(order),
      },
    ];
  }

  /* ------------------------------------------------------------ triggers -- */

  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_order',
        label: 'New order',
        description: 'Starts the agent for each new order.',
        pollActionId: 'list_orders',
        itemsPath: 'orders',
        idField: 'id',
      },
      {
        id: 'order_paid',
        label: 'Order paid (instant)',
        description: 'Starts the agent the moment Shopify reports an order as paid. Needs the API secret and a Shopify webhook.',
        delivery: 'webhook',
        itemsPath: '',
        idField: 'id',
      },
      {
        id: 'order_cancelled',
        label: 'Order cancelled (instant)',
        description: 'Starts the agent when an order is cancelled. Needs the API secret and a Shopify webhook.',
        delivery: 'webhook',
        itemsPath: '',
        idField: 'id',
      },
    ];
  }

  /* ------------------------------------------------------------- actions -- */

  getActions(): AppActionDefinition[] {
    const orderId = { type: 'string', description: 'The Shopify order id (a number, not the #1001 name).' };
    return [
      {
        id: 'list_orders',
        label: 'List orders',
        description: 'List recent orders, newest first. Filter by payment or fulfilment status.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['any', 'open', 'closed', 'cancelled'] },
            financialStatus: { type: 'string', description: 'paid, pending, refunded…' },
            fulfillmentStatus: { type: 'string', description: 'shipped, partial, unshipped, any' },
            createdAtMin: { type: 'string', description: 'ISO date; only orders created after it.' },
            limit: { type: 'number' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_order',
        label: 'Get order',
        description: 'Fetch one order with its customer and line items.',
        inputSchema: { type: 'object', properties: { orderId }, required: ['orderId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_products',
        label: 'List products',
        description: 'List products with their variants and stock.',
        inputSchema: {
          type: 'object',
          properties: { status: { type: 'string', enum: ['active', 'draft', 'archived'] }, title: { type: 'string' }, limit: { type: 'number' } },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_customers',
        label: 'Search customers',
        description: 'Find customers by name, email or phone.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'add_order_note',
        label: 'Add order note',
        description: 'Set the internal note on an order (replaces the existing note).',
        inputSchema: { type: 'object', properties: { orderId, note: { type: 'string' } }, required: ['orderId', 'note'] },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'cancel_order',
        label: 'Cancel order',
        description: 'Cancel an unfulfilled order. This cannot be undone.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId,
            reason: { type: 'string', enum: ['customer', 'inventory', 'fraud', 'declined', 'other'] },
            notifyCustomer: { type: 'boolean' },
          },
          required: ['orderId'],
        },
        permissionLevel: 'destructive',
        requiresConfirmation: true,
      },
      {
        id: 'refund_order',
        label: 'Refund order',
        description: 'Refund an order’s payment, in full or by an amount. Returns the money to the customer.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId,
            amount: { type: 'number', description: 'Leave empty to refund everything not yet refunded.' },
            reason: { type: 'string' },
            notifyCustomer: { type: 'boolean' },
          },
          required: ['orderId'],
        },
        permissionLevel: 'destructive',
        requiresConfirmation: true,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const auth = readAuth(credential.accessToken);
    try {
      switch (actionId) {
        case 'list_orders': {
          const { data } = await this.call(auth, 'GET', '/orders.json', {
            params: {
              status: textOf(input['status']) || 'any',
              order: 'created_at desc',
              limit: boundedInt(input['limit'], 25, 1, 100),
              ...(textOf(input['financialStatus']) ? { financial_status: textOf(input['financialStatus']) } : {}),
              ...(textOf(input['fulfillmentStatus']) ? { fulfillment_status: textOf(input['fulfillmentStatus']) } : {}),
              ...(textOf(input['createdAtMin']) ? { created_at_min: textOf(input['createdAtMin']) } : {}),
            },
          });
          const orders = (data.orders ?? []).map(compactOrder);
          return { success: true, message: `Found ${orders.length} order(s).`, data: { orders } };
        }
        case 'get_order': {
          const { orderId } = requireText(input, 'orderId');
          const { data } = await this.call(auth, 'GET', `/orders/${encodeURIComponent(orderId)}.json`);
          return { success: true, message: `Fetched order ${data.order?.name ?? orderId}.`, data: { order: compactOrder(data.order) } };
        }
        case 'list_products': {
          const { data } = await this.call(auth, 'GET', '/products.json', {
            params: {
              limit: boundedInt(input['limit'], 25, 1, 100),
              ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}),
              ...(textOf(input['title']) ? { title: textOf(input['title']) } : {}),
            },
          });
          const products = (data.products ?? []).map(compactProduct);
          return { success: true, message: `Found ${products.length} product(s).`, data: { products } };
        }
        case 'search_customers': {
          const { query } = requireText(input, 'query');
          const { data } = await this.call(auth, 'GET', '/customers/search.json', {
            params: { query, limit: boundedInt(input['limit'], 10, 1, 50) },
          });
          const customers = (data.customers ?? []).map(compactCustomer);
          return { success: true, message: `Found ${customers.length} customer(s).`, data: { customers } };
        }
        case 'add_order_note': {
          const { orderId, note } = requireText(input, 'orderId', 'note');
          const { data } = await this.call(auth, 'PUT', `/orders/${encodeURIComponent(orderId)}.json`, {
            data: { order: { id: Number(orderId), note } },
          });
          return { success: true, message: 'Order note saved.', data: { order: compactOrder(data.order) } };
        }
        case 'cancel_order': {
          const { orderId } = requireText(input, 'orderId');
          await this.call(auth, 'POST', `/orders/${encodeURIComponent(orderId)}/cancel.json`, {
            data: { reason: textOf(input['reason']) || 'other', email: input['notifyCustomer'] === true || input['notifyCustomer'] === 'true' },
          });
          return { success: true, message: `Order ${orderId} cancelled.`, data: { orderId } };
        }
        case 'refund_order':
          return await this.refund(auth, input);
        default:
          throw new BadRequestException(`Unknown Shopify action '${actionId}'.`);
      }
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: error.message };
      throw error;
    }
  }

  /** Refunds against the order's successful payment, never more than what is left to refund. */
  private async refund(auth: ShopifyAuth, input: Record<string, unknown>): Promise<AppActionResult> {
    const { orderId } = requireText(input, 'orderId');
    const { data } = await this.call(auth, 'GET', `/orders/${encodeURIComponent(orderId)}/transactions.json`);
    const transactions: any[] = data.transactions ?? [];
    const payment = transactions.find((t) => (t.kind === 'sale' || t.kind === 'capture') && t.status === 'success');
    if (!payment) return { success: false, message: 'This order has no successful payment to refund.' };
    const refunded = transactions
      .filter((t) => t.kind === 'refund' && t.status === 'success')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const remaining = Math.round((Number(payment.amount) - refunded) * 100) / 100;
    if (remaining <= 0) return { success: false, message: 'This order has already been fully refunded.' };
    const asked = typeof input['amount'] === 'number' ? input['amount'] : Number(input['amount']);
    const amount = Number.isFinite(asked) && asked > 0 ? Math.round(asked * 100) / 100 : remaining;
    if (amount > remaining) {
      return { success: false, message: `Only ${remaining} ${payment.currency ?? ''} can still be refunded on this order.`.trim() };
    }
    const res = await this.call(auth, 'POST', `/orders/${encodeURIComponent(orderId)}/refunds.json`, {
      data: {
        refund: {
          currency: payment.currency,
          notify: input['notifyCustomer'] === true || input['notifyCustomer'] === 'true',
          note: textOf(input['reason']) || undefined,
          transactions: [{ parent_id: payment.id, amount: String(amount), kind: 'refund', gateway: payment.gateway }],
        },
      },
    });
    this.logger.log(`Shopify refund of ${amount} created for order ${orderId}.`);
    return {
      success: true,
      message: `Refunded ${amount} ${payment.currency ?? ''}.`.trim(),
      data: { orderId, refundId: res.data.refund?.id, amount, currency: payment.currency },
    };
  }
}
