import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { createHash } from 'node:crypto';
import { connectorRequest } from '../core/connector-http.js';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, textOf } from './credential-json.js';

interface ZohoAuth extends Record<string, string> {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Zoho data centre TLD: com, eu, in, com.au, jp, ca, sa, com.cn. */
  dataCenter: string;
}

const DATA_CENTERS = ['com', 'eu', 'in', 'com.au', 'jp', 'ca', 'sa', 'com.cn'];

export function zohoDataCenter(value: string | undefined): string {
  const dc = (value || 'com').trim().toLowerCase().replace(/^\./, '');
  if (!DATA_CENTERS.includes(dc)) throw new BadRequestException(`Data centre must be one of: ${DATA_CENTERS.join(', ')}.`);
  return dc;
}

/**
 * Zoho's bulk `getRecords` returns `result: [{ <zohoId>: [record] }]`; this
 * flattens it to records carrying their Zoho id.
 */
export function flattenZohoRecords(data: any): Array<Record<string, any>> {
  const response = data?.response ?? {};
  if (response.status !== undefined && response.status !== 0) {
    const code = response.errors?.code;
    // 7024: "No records found" is an empty result, not a failure.
    if (code === 7024 || /no records/i.test(String(response.errors?.message ?? ''))) return [];
    throw new BadRequestException(`Zoho People: ${response.errors?.message ?? response.message ?? 'request failed'}`);
  }
  const rows: Array<Record<string, any>> = [];
  for (const entry of (response.result ?? []) as any[]) {
    for (const [zohoId, records] of Object.entries(entry ?? {})) {
      for (const record of (records as any[]) ?? []) rows.push({ zohoId, ...record });
    }
  }
  return rows;
}

const compactEmployee = (e: Record<string, any>) => ({
  id: e['zohoId'],
  employeeId: e['EmployeeID'] ?? null,
  name: [e['FirstName'], e['LastName']].filter(Boolean).join(' ') || null,
  email: e['EmailID'] ?? null,
  department: e['Department'] ?? null,
  designation: e['Designation'] ?? null,
  reportingTo: e['Reporting_To'] ?? null,
  status: e['Employeestatus'] ?? null,
  dateOfJoining: e['Dateofjoining'] ?? null,
});

const compactLeave = (l: Record<string, any>) => ({
  id: l['zohoId'],
  employee: l['Employee_ID'] ?? l['Employee'] ?? null,
  type: l['Leavetype'] ?? null,
  from: l['From'] ?? null,
  to: l['To'] ?? null,
  days: l['Daystaken'] ?? null,
  status: l['ApprovalStatus'] ?? null,
  reason: l['Reasonforleave'] ?? null,
});

/** Access tokens by credential fingerprint — Zoho's last an hour and the refresh token doesn't rotate. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Zoho People through a Zoho API Console "Self Client": client id, secret and
 * a refresh token generated with ZOHOPEOPLE.forms.READ (and
 * ZOHOPEOPLE.employee.READ). Read-only — HR record changes stay in Zoho.
 */
@Injectable()
export class ZohoPeopleProvider extends RestConnector<ZohoAuth> {
  readonly providerId = 'ZOHO_PEOPLE';
  protected readonly app = 'Zoho People';
  protected readonly requiredFields = ['clientId', 'clientSecret', 'refreshToken'] as const;
  protected readonly secrets = ['clientSecret', 'refreshToken'];

  protected capabilities() {
    return {
      displayName: 'Zoho People',
      description: 'Employee records and leave from Zoho People — read-only directory and time-off lookups.',
      category: 'HR & People',
      connectorCategory: 'hr' as const,
      authType: 'API_KEY_HEADER' as const,
      scopes: [{ scope: 'ZOHOPEOPLE.forms.READ', description: 'Read employee and leave forms', required: true }],
      credentialFields: [
        { key: 'clientId', label: 'Client ID', help: 'api-console.zoho.com → Self Client.' },
        { key: 'clientSecret', label: 'Client secret', secret: true },
        { key: 'refreshToken', label: 'Refresh token', secret: true, help: 'Generate a code with scope ZOHOPEOPLE.forms.READ, then exchange it for a refresh token.' },
        { key: 'dataCenter', label: 'Data centre', optional: true, placeholder: 'com', help: 'com, eu, in, com.au, jp, ca, sa or com.cn — where your Zoho account lives.' },
      ],
    };
  }

  protected override validate(auth: ZohoAuth) {
    zohoDataCenter(auth.dataCenter);
  }

  private async accessToken(auth: ZohoAuth): Promise<string> {
    const key = createHash('sha256').update(`${auth.clientId}:${auth.refreshToken}`).digest('hex');
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await connectorRequest<any>(this.app, {
      method: 'POST',
      url: `https://accounts.zoho.${zohoDataCenter(auth.dataCenter)}/oauth/v2/token`,
      params: { grant_type: 'refresh_token', client_id: auth.clientId, client_secret: auth.clientSecret, refresh_token: auth.refreshToken },
      retries: 0,
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
    if (!res.data?.access_token) throw new UnauthorizedException(`Zoho refused the refresh token${res.data?.error ? ` (${res.data.error})` : ''} — generate a new one and reconnect.`);
    tokenCache.set(key, { token: res.data.access_token, expiresAt: Date.now() + Number(res.data.expires_in ?? 3600) * 1000 });
    return res.data.access_token;
  }

  protected async target(auth: ZohoAuth) {
    return {
      baseUrl: `https://people.zoho.${zohoDataCenter(auth.dataCenter)}/people/api`,
      headers: { Authorization: `Zoho-oauthtoken ${await this.accessToken(auth)}` },
    };
  }

  protected async ping(auth: ZohoAuth, call: RestCall) {
    flattenZohoRecords(await call('GET', '/forms/employee/getRecords', { params: { sIndex: 1, limit: 1 } }));
    return { label: `Zoho People (${zohoDataCenter(auth.dataCenter)})` };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_leave_record', label: 'New leave request', description: 'Starts the agent for each new leave record.', pollActionId: 'list_leave_records', itemsPath: 'leaves', idField: 'id' }];
  }

  protected actions(): RestAction<ZohoAuth>[] {
    return [
      action({ id: 'list_employees', label: 'List employees', description: 'Employee records (up to 200), recently changed first when “since” is set.', level: 'read', properties: { limit: num('Max results (default 50, up to 200).'), start: num('Start index, from 1.'), since: str('Only records changed after this ISO date.') } }, async ({ input, call }) => {
        const since = Date.parse(textOf(input['since']));
        const data = await call('GET', '/forms/employee/getRecords', {
          params: { sIndex: boundedInt(input['start'], 1, 1, 1_000_000), limit: boundedInt(input['limit'], 50, 1, 200), ...(Number.isFinite(since) ? { modifiedtime: since } : {}) },
        });
        const employees = flattenZohoRecords(data).map(compactEmployee);
        return { message: `Found ${employees.length} employee(s).`, data: { employees } };
      }),
      action({ id: 'find_employee', label: 'Find employee', description: 'One employee by email or employee id.', level: 'read', properties: { email: str('Work email.'), employeeId: str('Employee id.') } }, async ({ input, call }) => {
        const email = textOf(input['email']);
        const employeeId = textOf(input['employeeId']);
        if (!email && !employeeId) throw new BadRequestException('Give an email or an employee id.');
        const data = await call('GET', '/forms/employee/getRecords', {
          params: email ? { SearchColumn: 'EMPLOYEEMAILALIAS', SearchValue: email } : { SearchColumn: 'EMPLOYEEID', SearchValue: employeeId },
        });
        const employees = flattenZohoRecords(data).map(compactEmployee);
        return { message: employees.length ? 'Found the employee.' : 'No employee matched.', data: { employee: employees[0] ?? null } };
      }),
      action({ id: 'list_leave_records', label: 'List leave records', description: 'Leave requests and their approval status.', level: 'read', properties: { limit: num('Max results (default 50, up to 200).'), since: str('Only records changed after this ISO date.') } }, async ({ input, call }) => {
        const since = Date.parse(textOf(input['since']));
        const data = await call('GET', '/forms/leave/getRecords', { params: { sIndex: 1, limit: boundedInt(input['limit'], 50, 1, 200), ...(Number.isFinite(since) ? { modifiedtime: since } : {}) } });
        const leaves = flattenZohoRecords(data).map(compactLeave);
        return { message: `Found ${leaves.length} leave record(s).`, data: { leaves } };
      }),
    ];
  }
}
