import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { connectorRequest } from '../core/connector-http.js';
import { OAuthRestConnector, oauthAction, type OAuthAction, type OAuthCall } from '../core/oauth-rest-connector.js';
import { num, str } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'accounting.transactions', 'accounting.contacts', 'accounting.settings.read'];

const compactInvoice = (i: any) => ({
  id: i.InvoiceID,
  number: i.InvoiceNumber ?? null,
  type: i.Type,
  status: i.Status,
  contact: i.Contact ? { id: i.Contact.ContactID, name: i.Contact.Name ?? null } : null,
  total: i.Total,
  amountDue: i.AmountDue,
  currency: i.CurrencyCode ?? null,
  date: i.DateString ?? null,
  dueDate: i.DueDateString ?? null,
  updatedAt: i.UpdatedDateUTC ?? null,
});
const compactContact = (c: any) => ({
  id: c.ContactID,
  name: c.Name,
  email: c.EmailAddress ?? null,
  status: c.ContactStatus ?? null,
  isCustomer: !!c.IsCustomer,
  isSupplier: !!c.IsSupplier,
});
const compactPayment = (p: any) => ({
  id: p.PaymentID,
  amount: p.Amount,
  date: p.Date ?? null,
  status: p.Status,
  invoice: p.Invoice ? { id: p.Invoice.InvoiceID, number: p.Invoice.InvoiceNumber ?? null } : null,
});

/**
 * Xero accounting (OAuth 2.0). One connection is one Xero organisation —
 * the first tenant the person authorised. Xero rotates refresh tokens on every
 * use, which the integration manager stores. Writes (draft invoices) ask for
 * approval; nothing here approves, voids or pays an invoice.
 * `XERO_SCOPES` overrides the scope list for apps on Xero's granular scopes.
 */
@Injectable()
export class XeroProvider extends OAuthRestConnector {
  readonly providerId = 'XERO';
  protected readonly app = 'Xero';
  protected readonly envPrefix = 'XERO';
  protected readonly callbackPath = 'xero';
  protected readonly authorizeUrl = 'https://login.xero.com/identity/connect/authorize';
  protected readonly tokenUrl = 'https://identity.xero.com/connect/token';
  protected get defaultScopes(): readonly string[] {
    const custom = this.config.get<string>('XERO_SCOPES');
    return custom ? custom.split(/[ ,]+/).filter(Boolean) : DEFAULT_SCOPES;
  }

  protected capabilities() {
    return {
      displayName: 'Xero',
      description: 'Xero accounting — invoices, contacts and payments; draft invoices with approval.',
      category: 'Finance',
      connectorCategory: 'finance' as const,
      scopes: [
        { scope: 'accounting.transactions', description: 'Read invoices and payments; draft invoices (asks for approval)', required: true },
        { scope: 'accounting.contacts', description: 'Read contacts', required: true },
      ],
    };
  }

  private tenant(metadata: Record<string, unknown>) {
    const tenantId = textOf(metadata['tenantId']);
    if (!tenantId) throw new UnauthorizedException('This Xero connection has no organisation on record — reconnect it.');
    return tenantId;
  }

  protected target(accessToken: string, metadata: Record<string, unknown>) {
    return {
      baseUrl: 'https://api.xero.com/api.xro/2.0',
      headers: { Authorization: `Bearer ${accessToken}`, 'xero-tenant-id': this.tenant(metadata) },
    };
  }

  protected async describeAccount(accessToken: string) {
    const res = await connectorRequest<any[]>(this.app, {
      method: 'GET',
      url: 'https://api.xero.com/connections',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
    const org = (res.data ?? []).find((t) => t.tenantType === 'ORGANISATION') ?? res.data?.[0];
    if (!org?.tenantId) throw new UnauthorizedException('No Xero organisation was authorised. Pick one on the consent screen.');
    return { label: org.tenantName || 'Xero organisation', accountId: org.tenantId, metadata: { tenantId: org.tenantId, tenantName: org.tenantName ?? null } };
  }

  protected async ping(call: OAuthCall) {
    const res = await call('GET', '/Organisation');
    return String(res?.Organisations?.[0]?.Name ?? 'Xero organisation');
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      { id: 'new_invoice', label: 'New invoice', description: 'Starts the agent for each new invoice or bill.', pollActionId: 'list_invoices', itemsPath: 'invoices', idField: 'id' },
      { id: 'new_payment', label: 'New payment', description: 'Starts the agent for each payment.', pollActionId: 'list_payments', itemsPath: 'payments', idField: 'id' },
    ];
  }

  protected actions(): OAuthAction[] {
    const limit = { limit: num('Max results (default 20, up to 100).') };
    return [
      oauthAction({ id: 'get_organisation', label: 'Get organisation', description: 'Name, base currency and financial year end.', level: 'read' }, async ({ call }) => {
        const o = (await call('GET', '/Organisation'))?.Organisations?.[0] ?? {};
        return { message: 'Fetched the organisation.', data: { organisation: { id: o.OrganisationID, name: o.Name, baseCurrency: o.BaseCurrency ?? null, countryCode: o.CountryCode ?? null, financialYearEnd: o.FinancialYearEndMonth ? `${o.FinancialYearEndDay}/${o.FinancialYearEndMonth}` : null } } };
      }),
      oauthAction(
        { id: 'list_invoices', label: 'List invoices', description: 'Sales invoices and bills, most recently changed first.', level: 'read', properties: { ...limit, statuses: str('Comma-separated: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED.'), type: str('ACCREC (sales) or ACCPAY (bills).', { enum: ['ACCREC', 'ACCPAY'] }) } },
        async ({ input, call }) => {
          const type = textOf(input['type']);
          const res = await call('GET', '/Invoices', {
            params: { order: 'UpdatedDateUTC DESC', page: 1, pageSize: boundedInt(input['limit'], 20, 1, 100), summaryOnly: true, ...(textOf(input['statuses']) ? { Statuses: textOf(input['statuses']).toUpperCase() } : {}), ...(type ? { where: `Type=="${type === 'ACCPAY' ? 'ACCPAY' : 'ACCREC'}"` } : {}) },
          });
          const invoices = ((res?.Invoices ?? []) as any[]).map(compactInvoice);
          return { message: `Found ${invoices.length} invoice(s).`, data: { invoices } };
        },
      ),
      oauthAction({ id: 'get_invoice', label: 'Get invoice', description: 'One invoice with its line items.', level: 'read', properties: { invoiceId: str('InvoiceID (GUID) or invoice number.') }, required: ['invoiceId'] }, async ({ input, call }) => {
        const { invoiceId } = requireText(input, 'invoiceId');
        const i = (await call('GET', `/Invoices/${encodeURIComponent(invoiceId)}`))?.Invoices?.[0] ?? {};
        return { message: 'Fetched the invoice.', data: { invoice: { ...compactInvoice(i), lines: (i.LineItems ?? []).map((l: any) => ({ description: l.Description ?? null, quantity: l.Quantity, unitAmount: l.UnitAmount, lineAmount: l.LineAmount, accountCode: l.AccountCode ?? null })) } } };
      }),
      oauthAction({ id: 'list_contacts', label: 'List contacts', description: 'Customers and suppliers, optionally matching a name.', level: 'read', properties: { ...limit, search: str('Name, email or account number to search.') } }, async ({ input, call }) => {
        const res = await call('GET', '/Contacts', { params: { page: 1, pageSize: boundedInt(input['limit'], 20, 1, 100), ...(textOf(input['search']) ? { searchTerm: textOf(input['search']) } : {}) } });
        const contacts = ((res?.Contacts ?? []) as any[]).map(compactContact);
        return { message: `Found ${contacts.length} contact(s).`, data: { contacts } };
      }),
      oauthAction({ id: 'list_payments', label: 'List payments', description: 'Payments, most recently changed first.', level: 'read', properties: limit }, async ({ input, call }) => {
        const res = await call('GET', '/Payments', { params: { order: 'UpdatedDateUTC DESC', page: 1, pageSize: boundedInt(input['limit'], 20, 1, 100) } });
        const payments = ((res?.Payments ?? []) as any[]).map(compactPayment);
        return { message: `Found ${payments.length} payment(s).`, data: { payments } };
      }),
      oauthAction(
        {
          id: 'create_draft_invoice',
          label: 'Draft invoice',
          description: 'Create a DRAFT sales invoice for a contact (nothing is sent or approved).',
          level: 'write',
          properties: { contactId: str('ContactID.'), description: str('Line description.'), quantity: num('Quantity (default 1).'), unitAmount: num('Unit price.'), accountCode: str('Revenue account code, e.g. 200.'), dueDate: str('YYYY-MM-DD.') },
          required: ['contactId', 'description', 'unitAmount', 'accountCode'],
        },
        async ({ input, call }) => {
          const { contactId, description, accountCode } = requireText(input, 'contactId', 'description', 'accountCode');
          const unitAmount = Number(input['unitAmount']);
          if (!Number.isFinite(unitAmount) || unitAmount < 0) throw new BadRequestException('unitAmount must be a number.');
          const res = await call('POST', '/Invoices', {
            data: {
              Invoices: [
                {
                  Type: 'ACCREC',
                  Status: 'DRAFT',
                  Contact: { ContactID: contactId },
                  ...(textOf(input['dueDate']) ? { DueDate: textOf(input['dueDate']) } : {}),
                  LineItems: [{ Description: description, Quantity: input['quantity'] === undefined ? 1 : Number(input['quantity']), UnitAmount: unitAmount, AccountCode: accountCode }],
                },
              ],
            },
          });
          const invoice = compactInvoice(res?.Invoices?.[0] ?? {});
          return { message: `Drafted invoice ${invoice.number ?? invoice.id}.`, data: { invoice } };
        },
      ),
    ];
  }
}
