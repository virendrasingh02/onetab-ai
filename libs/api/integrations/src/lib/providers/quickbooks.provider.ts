import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { connectorRequest } from '../core/connector-http.js';
import { OAuthRestConnector, oauthAction, type OAuthAction, type OAuthCall } from '../core/oauth-rest-connector.js';
import { num, str } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

const MINOR_VERSION = '75';

/** Entities the read-only `query` action may select from. */
const QUERYABLE = ['Invoice', 'Customer', 'Payment', 'Bill', 'Vendor', 'Item', 'Account', 'Estimate', 'SalesReceipt', 'CreditMemo', 'Purchase'];

/**
 * Only a single `SELECT … FROM <entity>` over a known entity is allowed — the
 * QuickBooks query language is read-only, but this also keeps an agent from
 * reaching entities nobody meant it to read.
 */
export function assertQuickBooksQuery(query: string): string {
  const q = query.trim().replace(/;+\s*$/, '');
  const match = /^select\s+[\w\s.,*()]+\s+from\s+(\w+)\b/i.exec(q);
  if (!match || /;/.test(q)) throw new BadRequestException('Only one “SELECT … FROM <entity>” query is allowed.');
  const entity = QUERYABLE.find((e) => e.toLowerCase() === match[1].toLowerCase());
  if (!entity) throw new BadRequestException(`QuickBooks entity '${match[1]}' isn’t available here. Use one of: ${QUERYABLE.join(', ')}.`);
  return q;
}

const compactInvoice = (i: any) => ({
  id: i.Id,
  number: i.DocNumber ?? null,
  customer: i.CustomerRef ? { id: i.CustomerRef.value, name: i.CustomerRef.name ?? null } : null,
  total: i.TotalAmt,
  balance: i.Balance,
  currency: i.CurrencyRef?.value ?? null,
  txnDate: i.TxnDate ?? null,
  dueDate: i.DueDate ?? null,
  emailStatus: i.EmailStatus ?? null,
  updatedAt: i.MetaData?.LastUpdatedTime ?? null,
});
const compactCustomer = (c: any) => ({
  id: c.Id,
  name: c.DisplayName,
  company: c.CompanyName ?? null,
  email: c.PrimaryEmailAddr?.Address ?? null,
  balance: c.Balance ?? 0,
  active: c.Active !== false,
});
const compactPayment = (p: any) => ({
  id: p.Id,
  customer: p.CustomerRef ? { id: p.CustomerRef.value, name: p.CustomerRef.name ?? null } : null,
  total: p.TotalAmt,
  unapplied: p.UnappliedAmt ?? 0,
  txnDate: p.TxnDate ?? null,
});

/**
 * QuickBooks Online accounting (Intuit OAuth 2.0). The company (`realmId`) is
 * the one the person picked on Intuit's consent screen. Reads are free;
 * creating or emailing an invoice asks for approval. `QUICKBOOKS_ENVIRONMENT=sandbox`
 * points at Intuit's sandbox companies.
 */
@Injectable()
export class QuickBooksProvider extends OAuthRestConnector {
  readonly providerId = 'QUICKBOOKS';
  protected readonly app = 'QuickBooks';
  protected readonly envPrefix = 'QUICKBOOKS';
  protected readonly callbackPath = 'quickbooks';
  protected readonly authorizeUrl = 'https://appcenter.intuit.com/connect/oauth2';
  protected readonly tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  protected readonly defaultScopes = ['com.intuit.quickbooks.accounting'];

  protected capabilities() {
    return {
      displayName: 'QuickBooks',
      description: 'QuickBooks Online accounting — invoices, customers, payments and bills; draft and email invoices with approval.',
      category: 'Finance',
      connectorCategory: 'finance' as const,
      scopes: [{ scope: 'com.intuit.quickbooks.accounting', description: 'Read and write accounting data (writes ask for approval)', required: true }],
    };
  }

  private apiHost() {
    return this.config.get<string>('QUICKBOOKS_ENVIRONMENT') === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  private realm(metadata: Record<string, unknown>) {
    const realmId = textOf(metadata['realmId']);
    if (!/^\d+$/.test(realmId)) throw new UnauthorizedException('This QuickBooks connection has no company on record — reconnect it.');
    return realmId;
  }

  protected target(accessToken: string, metadata: Record<string, unknown>) {
    return {
      baseUrl: `${this.apiHost()}/v3/company/${this.realm(metadata)}`,
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { minorversion: MINOR_VERSION },
    };
  }

  protected async describeAccount(accessToken: string, params: Record<string, string>) {
    const realmId = textOf(params['realmId']);
    if (!/^\d+$/.test(realmId)) throw new UnauthorizedException('QuickBooks didn’t say which company was picked. Try connecting again.');
    const res = await connectorRequest<any>(this.app, {
      method: 'GET',
      url: `${this.apiHost()}/v3/company/${realmId}/companyinfo/${realmId}`,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      params: { minorversion: MINOR_VERSION },
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
    const info = res.data?.CompanyInfo ?? {};
    return {
      label: info.CompanyName || `Company ${realmId}`,
      accountId: realmId,
      email: info.Email?.Address,
      metadata: { realmId, companyName: info.CompanyName ?? null },
    };
  }

  protected async ping(call: OAuthCall, metadata: Record<string, unknown>) {
    const realmId = this.realm(metadata);
    const res = await call('GET', `/companyinfo/${realmId}`);
    return String(res?.CompanyInfo?.CompanyName ?? `Company ${realmId}`);
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      { id: 'new_invoice', label: 'New invoice', description: 'Starts the agent for each new invoice.', pollActionId: 'list_invoices', itemsPath: 'invoices', idField: 'id' },
      { id: 'new_payment', label: 'New payment', description: 'Starts the agent for each payment received.', pollActionId: 'list_payments', itemsPath: 'payments', idField: 'id' },
    ];
  }

  protected actions(): OAuthAction[] {
    const limit = { limit: num('Max results (default 20, up to 100).') };
    const select = async (call: OAuthCall, query: string) => {
      const res = await call('GET', '/query', { params: { query } });
      return res?.QueryResponse ?? {};
    };
    return [
      oauthAction({ id: 'get_company', label: 'Get company', description: 'Company name, address and fiscal settings.', level: 'read' }, async ({ call, metadata }) => {
        const realmId = this.realm(metadata);
        const info = (await call('GET', `/companyinfo/${realmId}`))?.CompanyInfo ?? {};
        return { message: 'Fetched the company.', data: { company: { id: realmId, name: info.CompanyName, legalName: info.LegalName ?? null, country: info.Country ?? null, fiscalYearStartMonth: info.FiscalYearStartMonth ?? null } } };
      }),
      oauthAction({ id: 'list_invoices', label: 'List invoices', description: 'Invoices, most recently changed first. Optionally only unpaid ones.', level: 'read', properties: { ...limit, unpaidOnly: { type: 'boolean', description: 'Only invoices with a balance.' } } }, async ({ input, call }) => {
        const where = input['unpaidOnly'] === true ? ' WHERE Balance > \'0\'' : '';
        const res = await select(call, `SELECT * FROM Invoice${where} ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS ${boundedInt(input['limit'], 20, 1, 100)}`);
        const invoices = ((res.Invoice ?? []) as any[]).map(compactInvoice);
        return { message: `Found ${invoices.length} invoice(s).`, data: { invoices } };
      }),
      oauthAction({ id: 'get_invoice', label: 'Get invoice', description: 'One invoice with its lines.', level: 'read', properties: { invoiceId: str('Invoice Id.') }, required: ['invoiceId'] }, async ({ input, call }) => {
        const { invoiceId } = requireText(input, 'invoiceId');
        const i = (await call('GET', `/invoice/${encodeURIComponent(invoiceId)}`))?.Invoice ?? {};
        return { message: 'Fetched the invoice.', data: { invoice: { ...compactInvoice(i), lines: (i.Line ?? []).map((l: any) => ({ description: l.Description ?? null, amount: l.Amount, type: l.DetailType })) } } };
      }),
      oauthAction({ id: 'list_customers', label: 'List customers', description: 'Customers, optionally matching a name.', level: 'read', properties: { ...limit, name: str('Part of the display name.') } }, async ({ input, call }) => {
        const name = textOf(input['name']).replace(/'/g, "\\'");
        const res = await select(call, `SELECT * FROM Customer${name ? ` WHERE DisplayName LIKE '%${name}%'` : ''} MAXRESULTS ${boundedInt(input['limit'], 20, 1, 100)}`);
        const customers = ((res.Customer ?? []) as any[]).map(compactCustomer);
        return { message: `Found ${customers.length} customer(s).`, data: { customers } };
      }),
      oauthAction({ id: 'list_payments', label: 'List payments', description: 'Payments received, newest first.', level: 'read', properties: limit }, async ({ input, call }) => {
        const res = await select(call, `SELECT * FROM Payment ORDERBY MetaData.CreateTime DESC MAXRESULTS ${boundedInt(input['limit'], 20, 1, 100)}`);
        const payments = ((res.Payment ?? []) as any[]).map(compactPayment);
        return { message: `Found ${payments.length} payment(s).`, data: { payments } };
      }),
      oauthAction({ id: 'query', label: 'Run a report query', description: `A read-only QuickBooks query, e.g. SELECT * FROM Bill WHERE Balance > '0'. Entities: ${QUERYABLE.join(', ')}.`, level: 'read', properties: { query: str('SELECT … FROM <entity> …') }, required: ['query'] }, async ({ input, call }) => {
        const { query } = requireText(input, 'query');
        const res = await select(call, assertQuickBooksQuery(query));
        const [entity] = Object.keys(res).filter((k) => Array.isArray(res[k]));
        const rows = entity ? (res[entity] as unknown[]) : [];
        return { message: `Returned ${rows.length} row(s).`, data: { entity: entity ?? null, rows } };
      }),
      oauthAction(
        {
          id: 'create_invoice',
          label: 'Create invoice',
          description: 'Create an invoice for a customer from one product/service line.',
          level: 'write',
          properties: { customerId: str('Customer Id.'), itemId: str('Product/service Id.'), amount: num('Line amount.'), description: str('Line description.'), dueDate: str('YYYY-MM-DD.') },
          required: ['customerId', 'itemId', 'amount'],
        },
        async ({ input, call }) => {
          const { customerId, itemId } = requireText(input, 'customerId', 'itemId');
          const amount = Number(input['amount']);
          if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('amount must be a positive number.');
          const res = await call('POST', '/invoice', {
            data: {
              CustomerRef: { value: customerId },
              ...(textOf(input['dueDate']) ? { DueDate: textOf(input['dueDate']) } : {}),
              Line: [{ Amount: amount, DetailType: 'SalesItemLineDetail', Description: textOf(input['description']) || undefined, SalesItemLineDetail: { ItemRef: { value: itemId } } }],
            },
          });
          const invoice = compactInvoice(res?.Invoice ?? {});
          return { message: `Created invoice ${invoice.number ?? invoice.id}.`, data: { invoice } };
        },
      ),
      oauthAction({ id: 'send_invoice', label: 'Email invoice', description: 'Email an invoice to the customer (or another address).', level: 'write', properties: { invoiceId: str('Invoice Id.'), sendTo: str('Override email address.') }, required: ['invoiceId'] }, async ({ input, call }) => {
        const { invoiceId } = requireText(input, 'invoiceId');
        const res = await call('POST', `/invoice/${encodeURIComponent(invoiceId)}/send`, { params: textOf(input['sendTo']) ? { sendTo: textOf(input['sendTo']) } : {} });
        return { message: 'Invoice emailed.', data: { invoice: compactInvoice(res?.Invoice ?? {}) } };
      }),
    ];
  }
}
