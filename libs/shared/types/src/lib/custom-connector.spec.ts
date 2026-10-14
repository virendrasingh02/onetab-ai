import { describe, expect, it } from 'vitest';
import { connectorToolName } from './connectors.js';
import {
  actionPermission,
  customActionDefinition,
  customConnectorProviderKey,
  isCustomConnectorProvider,
  renderCustomRequest,
  slugifyActionId,
  validateCustomConnector,
  type CustomConnectorAction,
  type CustomConnectorInput,
} from './custom-connector.js';

const getOrder: CustomConnectorAction = {
  id: 'get_order',
  label: 'Get order',
  description: 'Fetch one order.',
  method: 'GET',
  path: '/orders/{{orderId}}',
  query: { expand: '{{expand}}', fixed: 'yes' },
  params: [
    { name: 'orderId', type: 'string', required: true },
    { name: 'expand', type: 'string', required: false },
  ],
};

const createOrder: CustomConnectorAction = {
  id: 'create_order',
  label: 'Create order',
  description: 'Create an order.',
  method: 'POST',
  path: '/orders',
  body: '{"customer":"{{customer}}","qty":"{{qty}}","note":"for {{customer}}","tags":["{{tag}}"]}',
  params: [
    { name: 'customer', type: 'string', required: true },
    { name: 'qty', type: 'number', required: true },
    { name: 'tag', type: 'string', required: false },
  ],
};

const base: CustomConnectorInput = {
  name: 'Orders',
  description: 'Orders API',
  category: 'commerce',
  baseUrl: 'https://api.example.com/v1',
  authType: 'BEARER',
  actions: [getOrder, createOrder],
  triggers: [],
};

describe('custom connector provider keys', () => {
  it('makes a unique, recognisable key', () => {
    const key = customConnectorProviderKey('My Orders (EU)!', 'a1b2c3d4-0000');
    expect(key).toBe('CUSTOM_MY_ORDERS_EU_A1B2C3D4');
    expect(isCustomConnectorProvider(key)).toBe(true);
    expect(isCustomConnectorProvider('CUSTOM_API')).toBe(false);
    expect(isCustomConnectorProvider('SLACK')).toBe(false);
  });

  it('yields valid agent tool names', () => {
    expect(connectorToolName(customConnectorProviderKey('Orders', 'abcdef12'), 'get_order')).toBe('custom_orders_abcdef12_get_order');
  });
});

describe('renderCustomRequest', () => {
  it('fills the path (url-encoded) and drops unsupplied query inputs', () => {
    expect(renderCustomRequest(getOrder, { orderId: 'a/b 1' })).toEqual({
      method: 'GET',
      path: '/orders/a%2Fb%201',
      query: { fixed: 'yes' },
    });
    expect(renderCustomRequest(getOrder, { orderId: '7', expand: 'items' }).query).toEqual({ expand: 'items', fixed: 'yes' });
  });

  it('keeps types for whole-value placeholders and interpolates embedded ones', () => {
    const req = renderCustomRequest(createOrder, { customer: 'Ana', qty: '3' });
    expect(req.body).toEqual({ customer: 'Ana', qty: 3, note: 'for Ana', tags: [] });
  });

  it('refuses a missing required input with a readable error', () => {
    expect(() => renderCustomRequest(getOrder, {})).toThrow('“orderId” is required to run Get order.');
  });

  it('sends the leftover inputs as the body when there is no template', () => {
    const action: CustomConnectorAction = {
      id: 'update_order',
      label: 'Update order',
      description: 'Update.',
      method: 'PATCH',
      path: '/orders/{{id}}',
      params: [
        { name: 'id', type: 'string', required: true },
        { name: 'status', type: 'string', required: true },
      ],
    };
    expect(renderCustomRequest(action, { id: '9', status: 'shipped' })).toMatchObject({ path: '/orders/9', body: { status: 'shipped' } });
  });
});

describe('action definitions', () => {
  it('derives permission and confirmation from the method', () => {
    expect(actionPermission(getOrder)).toBe('read');
    expect(actionPermission(createOrder)).toBe('write');
    expect(actionPermission({ method: 'DELETE' })).toBe('destructive');
    expect(actionPermission({ method: 'POST', permissionLevel: 'read' })).toBe('read');
    expect(customActionDefinition(getOrder).requiresConfirmation).toBe(false);
    expect(customActionDefinition(createOrder).requiresConfirmation).toBe(true);
  });

  it('builds a JSON schema from the inputs', () => {
    expect(customActionDefinition(createOrder).inputSchema).toEqual({
      type: 'object',
      properties: { customer: { type: 'string' }, qty: { type: 'number' }, tag: { type: 'string' } },
      required: ['customer', 'qty'],
    });
  });

  it('slugifies labels into ids', () => {
    expect(slugifyActionId('Get Order #1')).toBe('get_order_1');
    expect(slugifyActionId('1st try')).toBe('a_1st_try');
  });
});

describe('validateCustomConnector', () => {
  it('accepts a sound definition', () => {
    expect(validateCustomConnector(base)).toEqual([]);
  });

  it('explains what is wrong', () => {
    const errors = validateCustomConnector({
      ...base,
      name: ' ',
      baseUrl: 'ftp://x',
      authType: 'API_KEY_HEADER',
      actions: [
        { ...getOrder, params: [] },
        { ...createOrder, id: 'get_order', body: '{bad' },
      ],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'Give the connector a name.',
        'The base URL must start with http:// or https://.',
        'Name the header that carries the API key.',
        '“Get order” uses {{orderId}} but has no input called “orderId”.',
        'Two actions share the id “get_order”.',
      ]),
    );
    expect(errors.some((e) => e.includes('valid JSON'))).toBe(true);
  });

  it('only lets events watch input-free reads', () => {
    const watch = (actionId: string) =>
      validateCustomConnector({ ...base, triggers: [{ id: 'new_order', label: 'New order', actionId, itemsPath: '', idField: 'id' }] });
    expect(watch('create_order').join(' ')).toContain('changes data');
    expect(watch('get_order').join(' ')).toContain('needs inputs');
    expect(
      validateCustomConnector({
        ...base,
        actions: [{ ...getOrder, id: 'list_orders', path: '/orders', query: {}, params: [] }],
        triggers: [{ id: 'new_order', label: 'New order', actionId: 'list_orders', itemsPath: 'orders', idField: 'id' }],
      }),
    ).toEqual([]);
  });
});
