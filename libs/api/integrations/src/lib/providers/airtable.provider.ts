import { Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { BadRequestException } from '@nestjs/common';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface AirtableAuth extends Record<string, string> {
  token: string;
}

const compactRecord = (r: any) => ({ id: r.id, createdTime: r.createdTime, fields: r.fields ?? {} });

function fieldsOf(input: Record<string, unknown>): Record<string, unknown> {
  const raw = input['fields'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  throw new BadRequestException('fields must be an object of field names to values.');
}

/** Airtable with a personal access token (airtable.com/create/tokens). */
@Injectable()
export class AirtableProvider extends RestConnector<AirtableAuth> {
  readonly providerId = 'AIRTABLE';
  protected readonly app = 'Airtable';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'Airtable',
      description: 'Structured data and lightweight databases — list, create, update and delete records.',
      category: 'Database',
      connectorCategory: 'database',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'data.records:read', description: 'Read records', required: true },
        { scope: 'data.records:write', description: 'Create, update and delete records (each asks for approval)' },
        { scope: 'schema.bases:read', description: 'List bases and tables' },
      ],
      credentialFields: [{ key: 'token', label: 'Personal access token', secret: true, help: 'airtable.com/create/tokens — grant only the bases and scopes agents need.' }],
    };
  }

  protected target(auth: AirtableAuth) {
    return { baseUrl: 'https://api.airtable.com/v0', headers: { Authorization: `Bearer ${auth.token}` } };
  }

  protected async ping(_auth: AirtableAuth, call: RestCall) {
    const me = await call('GET', '/meta/whoami');
    return { label: me.email ?? me.id ?? 'your account', accountId: me.id, email: me.email };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_record',
        label: 'New record',
        description: 'Starts the agent for each new record in a table.',
        pollActionId: 'list_records',
        inputSchema: { type: 'object', properties: { baseId: str('Base id (app…).'), table: str('Table name or id.') }, required: ['baseId', 'table'] },
        itemsPath: 'records',
        idField: 'id',
      },
    ];
  }

  protected actions(): RestAction<AirtableAuth>[] {
    const base = { baseId: str('Base id, starts with app.'), table: str('Table name or id.') };
    const rec = { ...base, recordId: str('Record id, starts with rec.') };
    return [
      action({ id: 'list_bases', label: 'List bases', description: 'Bases this token can access.', level: 'read' }, async ({ call }) => {
        const data = await call('GET', '/meta/bases');
        const bases = ((data.bases ?? []) as any[]).map((b) => ({ id: b.id, name: b.name }));
        return { message: `Found ${bases.length} base(s).`, data: { bases } };
      }),
      action({ id: 'list_tables', label: 'List tables', description: 'Tables and their fields in a base.', level: 'read', properties: { baseId: base.baseId }, required: ['baseId'] }, async ({ input, call }) => {
        const { baseId } = requireText(input, 'baseId');
        const data = await call('GET', `/meta/bases/${encodeURIComponent(baseId)}/tables`);
        const tables = ((data.tables ?? []) as any[]).map((t) => ({ id: t.id, name: t.name, fields: (t.fields ?? []).map((f: any) => ({ name: f.name, type: f.type })) }));
        return { message: `Found ${tables.length} table(s).`, data: { tables } };
      }),
      action(
        { id: 'list_records', label: 'List records', description: 'Records in a table. Optionally filter with an Airtable formula.', level: 'read', properties: { ...base, filterByFormula: str('Airtable formula, e.g. {Status}="Open".'), view: str('View name.'), limit: num('Max records (default 25).') }, required: ['baseId', 'table'] },
        async ({ input, call }) => {
          const { baseId, table } = requireText(input, 'baseId', 'table');
          const data = await call('GET', `/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`, {
            params: { maxRecords: boundedInt(input['limit'], 25, 1, 100), ...(textOf(input['filterByFormula']) ? { filterByFormula: textOf(input['filterByFormula']) } : {}), ...(textOf(input['view']) ? { view: textOf(input['view']) } : {}) },
          });
          const records = ((data.records ?? []) as any[]).map(compactRecord);
          return { message: `Found ${records.length} record(s).`, data: { records } };
        },
      ),
      action({ id: 'get_record', label: 'Get record', description: 'Fetch one record.', level: 'read', properties: rec, required: ['baseId', 'table', 'recordId'] }, async ({ input, call }) => {
        const { baseId, table, recordId } = requireText(input, 'baseId', 'table', 'recordId');
        const data = await call('GET', `/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`);
        return { message: 'Fetched the record.', data: { record: compactRecord(data) } };
      }),
      action(
        { id: 'create_record', label: 'Create record', description: 'Add a record. `fields` maps field names to values.', level: 'write', properties: { ...base, fields: { type: 'object', description: 'Field names to values.' } }, required: ['baseId', 'table', 'fields'] },
        async ({ input, call }) => {
          const { baseId, table } = requireText(input, 'baseId', 'table');
          const data = await call('POST', `/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`, { data: { fields: fieldsOf(input), typecast: true } });
          return { message: 'Created the record.', data: { record: compactRecord(data) } };
        },
      ),
      action(
        { id: 'update_record', label: 'Update record', description: 'Change fields on a record. Only the fields given are changed.', level: 'write', properties: { ...rec, fields: { type: 'object', description: 'Field names to new values.' } }, required: ['baseId', 'table', 'recordId', 'fields'] },
        async ({ input, call }) => {
          const { baseId, table, recordId } = requireText(input, 'baseId', 'table', 'recordId');
          const data = await call('PATCH', `/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`, { data: { fields: fieldsOf(input), typecast: true } });
          return { message: 'Updated the record.', data: { record: compactRecord(data) } };
        },
      ),
      action({ id: 'delete_record', label: 'Delete record', description: 'Permanently delete a record.', level: 'destructive', properties: rec, required: ['baseId', 'table', 'recordId'] }, async ({ input, call }) => {
        const { baseId, table, recordId } = requireText(input, 'baseId', 'table', 'recordId');
        await call('DELETE', `/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`);
        return { message: 'Deleted the record.', data: { recordId } };
      }),
    ];
  }
}
