import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall, type RestTarget } from '../core/rest-connector.js';
import { connectorRequest } from '../core/connector-http.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface SalesforceAuth extends Record<string, string> {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
}

const API_VERSION = 'v60.0';
const SOBJECT = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const RECORD_ID = /^[A-Za-z0-9]{15,18}$/;

/** Only a Salesforce-owned https host is accepted, so the secret can't be sent anywhere else. */
export function salesforceOrigin(instanceUrl: string): string {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(instanceUrl) ? instanceUrl : `https://${instanceUrl}`);
  } catch {
    throw new BadRequestException('Instance URL should look like https://acme.my.salesforce.com.');
  }
  if (url.protocol !== 'https:' || !/(\.salesforce\.com|\.force\.com)$/.test(url.hostname)) {
    throw new BadRequestException('Instance URL must be your Salesforce My Domain (…my.salesforce.com).');
  }
  return url.origin;
}

/** Only a single read-only SOQL query may run — no semicolons, no DML. */
export function assertSelectOnly(soql: string): string {
  const q = soql.trim().replace(/;+\s*$/, '');
  if (!/^select\s/i.test(q) || q.includes(';')) throw new BadRequestException('Only a single SOQL SELECT query is allowed.');
  return q;
}

const strip = ({ attributes, ...rest }: any) => ({ type: attributes?.type, ...rest });

/**
 * Salesforce through a Connected App using the client-credentials flow, so the
 * connection keeps working without anyone re-pasting a session token.
 * Setup → App Manager → New Connected App → enable OAuth, "Client Credentials
 * Flow", a run-as user, and the `api` scope.
 */
@Injectable()
export class SalesforceProvider extends RestConnector<SalesforceAuth> {
  readonly providerId = 'SALESFORCE';
  protected readonly app = 'Salesforce';
  protected readonly requiredFields = ['instanceUrl', 'clientId', 'clientSecret'] as const;
  protected readonly secrets = ['clientId', 'clientSecret'];
  /** Access tokens by connected app; they live ~2h, so reuse one until shortly before it ends. */
  private readonly tokens = new Map<string, { token: string; until: number }>();

  protected capabilities() {
    return {
      displayName: 'Salesforce',
      description: 'CRM records and sales operations — query leads, accounts, opportunities and cases; create and update records.',
      category: 'CRM',
      connectorCategory: 'crm',
      authType: 'OAUTH2' as const,
      scopes: [
        { scope: 'api', description: 'Query and read records', required: true },
        { scope: 'write', description: 'Create and update records (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'instanceUrl', label: 'My Domain URL', placeholder: 'https://acme.my.salesforce.com' },
        { key: 'clientId', label: 'Consumer key', secret: true },
        { key: 'clientSecret', label: 'Consumer secret', secret: true, help: 'Connected App with the Client Credentials Flow enabled and a run-as user.' },
      ],
    };
  }

  protected override validate(auth: SalesforceAuth) {
    salesforceOrigin(auth.instanceUrl);
  }

  private async accessToken(auth: SalesforceAuth): Promise<string> {
    const key = `${salesforceOrigin(auth.instanceUrl)}|${auth.clientId}`;
    const cached = this.tokens.get(key);
    if (cached && cached.until > Date.now()) return cached.token;
    const res = await connectorRequest<{ access_token: string }>('Salesforce', {
      method: 'POST',
      url: `${salesforceOrigin(auth.instanceUrl)}/services/oauth2/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({ grant_type: 'client_credentials', client_id: auth.clientId, client_secret: auth.clientSecret }).toString(),
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
    this.tokens.set(key, { token: res.data.access_token, until: Date.now() + 25 * 60_000 });
    return res.data.access_token;
  }

  protected async target(auth: SalesforceAuth): Promise<RestTarget> {
    return {
      baseUrl: `${salesforceOrigin(auth.instanceUrl)}/services/data/${API_VERSION}`,
      headers: { Authorization: `Bearer ${await this.accessToken(auth)}` },
    };
  }

  protected async ping(auth: SalesforceAuth, call: RestCall) {
    await call('GET', '/limits');
    return { label: new URL(salesforceOrigin(auth.instanceUrl)).host };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    const trigger = (id: string, label: string, object: string, fields: string): ConnectorTriggerDefinition => ({
      id,
      label,
      description: `Starts the agent for each new ${object.toLowerCase()}.`,
      pollActionId: 'query',
      defaultInput: { soql: `SELECT ${fields} FROM ${object} ORDER BY CreatedDate DESC LIMIT 20` },
      itemsPath: 'records',
      idField: 'Id',
    });
    return [
      trigger('new_lead', 'New lead', 'Lead', 'Id, Name, Company, Email, Status, CreatedDate'),
      trigger('new_opportunity', 'New opportunity', 'Opportunity', 'Id, Name, Amount, StageName, CloseDate, CreatedDate'),
      trigger('new_case', 'New case', 'Case', 'Id, CaseNumber, Subject, Status, Priority, CreatedDate'),
    ];
  }

  protected actions(): RestAction<SalesforceAuth>[] {
    const objectType = str('Object API name, e.g. Lead, Account, Contact, Opportunity, Case.');
    const kind = (input: Record<string, unknown>) => {
      const { objectType } = requireText(input, 'objectType');
      if (!SOBJECT.test(objectType)) throw new BadRequestException('objectType must be an object API name such as Lead or Custom__c.');
      return objectType;
    };
    const recordId = (input: Record<string, unknown>) => {
      const { recordId } = requireText(input, 'recordId');
      if (!RECORD_ID.test(recordId)) throw new BadRequestException('recordId must be a 15 or 18 character Salesforce id.');
      return recordId;
    };
    const fieldsOf = (input: Record<string, unknown>) => {
      const raw = input['fields'];
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
      throw new BadRequestException('fields must be an object of field API names to values.');
    };
    return [
      action(
        { id: 'query', label: 'Run SOQL query', description: 'Run one read-only SOQL SELECT, e.g. SELECT Id, Name FROM Account WHERE Industry = \'Retail\' LIMIT 10.', level: 'read', properties: { soql: str('A single SELECT query.'), limit: num('Optional cap on rows returned (default 50).') }, required: ['soql'] },
        async ({ input, call }) => {
          const q = assertSelectOnly(textOf(input['soql']));
          const data = await call('GET', '/query', { params: { q } });
          const cap = boundedInt(input['limit'], 50, 1, 200);
          const records = ((data.records ?? []) as any[]).slice(0, cap).map(strip);
          return { message: `Found ${data.totalSize ?? records.length} record(s).`, data: { records, totalSize: data.totalSize ?? records.length, done: data.done } };
        },
      ),
      action({ id: 'get_record', label: 'Get record', description: 'Fetch one record by object type and id.', level: 'read', properties: { objectType, recordId: str('15 or 18 character record id.') }, required: ['objectType', 'recordId'] }, async ({ input, call }) => {
        const data = await call('GET', `/sobjects/${kind(input)}/${recordId(input)}`);
        return { message: 'Fetched the record.', data: { record: strip(data) } };
      }),
      action({ id: 'create_record', label: 'Create record', description: 'Create a record, e.g. a Lead with LastName and Company.', level: 'write', properties: { objectType, fields: { type: 'object', description: 'Field API names to values.' } }, required: ['objectType', 'fields'] }, async ({ input, call }) => {
        const type = kind(input);
        const data = await call('POST', `/sobjects/${type}`, { data: fieldsOf(input) });
        return { message: `Created ${type} ${data.id}.`, data: { id: data.id, success: data.success } };
      }),
      action({ id: 'update_record', label: 'Update record', description: 'Change fields on a record. Only the fields given are changed.', level: 'write', properties: { objectType, recordId: str('Record id.'), fields: { type: 'object', description: 'Field API names to new values.' } }, required: ['objectType', 'recordId', 'fields'] }, async ({ input, call }) => {
        await call('PATCH', `/sobjects/${kind(input)}/${recordId(input)}`, { data: fieldsOf(input) });
        return { message: 'Updated the record.', data: { id: recordId(input) } };
      }),
    ];
  }
}
