import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface WooAuth extends Record<string, string> {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

/** Only an https site origin is accepted; the SSRF-guarded agent blocks private addresses on top of this. */
export function wooOrigin(siteUrl: string): string {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`);
  } catch {
    throw new BadRequestException('Store address should look like https://shop.example.com.');
  }
  if (url.protocol !== 'https:') throw new BadRequestException('WooCommerce needs an https store address so the keys are encrypted in transit.');
  return url.origin;
}

const compactOrder = (o: any) => ({
  id: o.id,
  number: o.number,
  status: o.status,
  total: o.total,
  currency: o.currency,
  customer: [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ') || null,
  email: o.billing?.email ?? null,
  paymentMethod: o.payment_method_title ?? null,
  items: (o.line_items ?? []).map((i: any) => ({ name: i.name, quantity: i.quantity, total: i.total })),
  createdAt: o.date_created_gmt ? `${o.date_created_gmt}Z` : o.date_created,
});

const compactProduct = (p: any) => ({ id: p.id, name: p.name, sku: p.sku || null, price: p.price, stockStatus: p.stock_status, stockQuantity: p.stock_quantity ?? null, status: p.status, url: p.permalink });

/** WooCommerce REST API with consumer key/secret (WooCommerce → Settings → Advanced → REST API). */
@Injectable()
export class WooCommerceProvider extends RestConnector<WooAuth> {
  readonly providerId = 'WOOCOMMERCE';
  protected readonly app = 'WooCommerce';
  protected readonly requiredFields = ['siteUrl', 'consumerKey', 'consumerSecret'] as const;
  protected readonly secrets = ['consumerKey', 'consumerSecret'];

  protected capabilities() {
    return {
      displayName: 'WooCommerce',
      description: 'Ecommerce products and orders — check orders, update status and stock, add order notes.',
      category: 'Commerce',
      connectorCategory: 'commerce',
      authType: 'API_KEY_HEADER' as const,
      scopes: [
        { scope: 'read', description: 'Read orders, products and customers', required: true },
        { scope: 'write', description: 'Update orders and stock (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'siteUrl', label: 'Store address', placeholder: 'https://shop.example.com' },
        { key: 'consumerKey', label: 'Consumer key', secret: true, placeholder: 'ck_…' },
        { key: 'consumerSecret', label: 'Consumer secret', secret: true, placeholder: 'cs_…', help: 'WooCommerce → Settings → Advanced → REST API → Add key (Read/Write).' },
      ],
    };
  }

  protected override validate(auth: WooAuth) {
    wooOrigin(auth.siteUrl);
  }

  protected target(auth: WooAuth) {
    return { baseUrl: `${wooOrigin(auth.siteUrl)}/wp-json/wc/v3`, basic: { username: auth.consumerKey, password: auth.consumerSecret } };
  }

  protected async ping(auth: WooAuth, call: RestCall) {
    await call('GET', '/orders', { params: { per_page: 1 } });
    return { label: new URL(wooOrigin(auth.siteUrl)).host };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_order', label: 'New order', description: 'Starts the agent for each new order.', pollActionId: 'list_orders', itemsPath: 'orders', idField: 'id' }];
  }

  protected actions(): RestAction<WooAuth>[] {
    const orderId = str('The order id.');
    return [
      action({ id: 'list_orders', label: 'List orders', description: 'Orders, newest first. Optionally by status.', level: 'read', properties: { status: str('pending, processing, on-hold, completed, cancelled, refunded, failed.'), limit: num('Max results (default 20).') } }, async ({ input, call }) => {
        const data = await call('GET', '/orders', { params: { orderby: 'date', order: 'desc', per_page: boundedInt(input['limit'], 20, 1, 100), ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}) } });
        const orders = ((data ?? []) as any[]).map(compactOrder);
        return { message: `Found ${orders.length} order(s).`, data: { orders } };
      }),
      action({ id: 'get_order', label: 'Get order', description: 'Fetch one order.', level: 'read', properties: { orderId }, required: ['orderId'] }, async ({ input, call }) => {
        const { orderId } = requireText(input, 'orderId');
        return { message: 'Fetched the order.', data: { order: compactOrder(await call('GET', `/orders/${encodeURIComponent(orderId)}`)) } };
      }),
      action({ id: 'list_products', label: 'List products', description: 'Products; search by name or SKU.', level: 'read', properties: { search: str('Name or SKU.'), limit: num('Max results (default 20).') } }, async ({ input, call }) => {
        const data = await call('GET', '/products', { params: { per_page: boundedInt(input['limit'], 20, 1, 100), ...(textOf(input['search']) ? { search: textOf(input['search']) } : {}) } });
        const products = ((data ?? []) as any[]).map(compactProduct);
        return { message: `Found ${products.length} product(s).`, data: { products } };
      }),
      action({ id: 'list_customers', label: 'List customers', description: 'Customers; search by name or email.', level: 'read', properties: { search: str('Name or email.'), limit: num('Max results (default 20).') } }, async ({ input, call }) => {
        const data = await call('GET', '/customers', { params: { per_page: boundedInt(input['limit'], 20, 1, 100), ...(textOf(input['search']) ? { search: textOf(input['search']) } : {}) } });
        const customers = ((data ?? []) as any[]).map((c) => ({ id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(' '), email: c.email, ordersCount: c.orders_count ?? null, totalSpent: c.total_spent ?? null }));
        return { message: `Found ${customers.length} customer(s).`, data: { customers } };
      }),
      action(
        { id: 'update_order_status', label: 'Update order status', description: 'Move an order to another status (e.g. completed).', level: 'write', properties: { orderId, status: str('New status.', { enum: ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'] }) }, required: ['orderId', 'status'] },
        async ({ input, call }) => {
          const { orderId, status } = requireText(input, 'orderId', 'status');
          return { message: `Order is now ${status}.`, data: { order: compactOrder(await call('PUT', `/orders/${encodeURIComponent(orderId)}`, { data: { status } })) } };
        },
      ),
      action(
        { id: 'add_order_note', label: 'Add order note', description: 'Add a note to an order; optionally email it to the customer.', level: 'write', properties: { orderId, note: str('Note text.'), notifyCustomer: { type: 'boolean', description: 'Also email the customer.' } }, required: ['orderId', 'note'] },
        async ({ input, call }) => {
          const { orderId, note } = requireText(input, 'orderId', 'note');
          await call('POST', `/orders/${encodeURIComponent(orderId)}/notes`, { data: { note, customer_note: input['notifyCustomer'] === true } });
          return { message: 'Note added.', data: { orderId } };
        },
      ),
      action(
        { id: 'update_stock', label: 'Update stock', description: 'Set a product’s stock quantity.', level: 'write', properties: { productId: str('The product id.'), quantity: num('New stock quantity.') }, required: ['productId', 'quantity'] },
        async ({ input, call }) => {
          const { productId } = requireText(input, 'productId');
          const quantity = boundedInt(input['quantity'], NaN, 0, 1_000_000);
          if (Number.isNaN(quantity)) throw new BadRequestException('quantity must be a number.');
          const p = await call('PUT', `/products/${encodeURIComponent(productId)}`, { data: compactObject({ manage_stock: true, stock_quantity: quantity }) });
          return { message: `Stock is now ${quantity}.`, data: { product: compactProduct(p) } };
        },
      ),
    ];
  }
}
