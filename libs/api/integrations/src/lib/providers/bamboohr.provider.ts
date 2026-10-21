import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface BambooAuth extends Record<string, string> {
  apiKey: string;
  subdomain: string;
}

/** The `<company>` of `<company>.bamboohr.com`. */
export function bambooSubdomain(value: string): string {
  const s = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.bamboohr\.com.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(s)) throw new BadRequestException('Company domain must be the part before .bamboohr.com.');
  return s;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * BambooHR with an API key (the key acts as the user who created it, with
 * that user's access). Directory, time off and who's out are reads; adding a
 * time-off request asks for approval.
 */
@Injectable()
export class BambooHRProvider extends RestConnector<BambooAuth> {
  readonly providerId = 'BAMBOOHR';
  protected readonly app = 'BambooHR';
  protected readonly requiredFields = ['apiKey', 'subdomain'] as const;
  protected readonly secrets = ['apiKey'];

  protected capabilities() {
    return {
      displayName: 'BambooHR',
      description: 'Employee directory, time off and who’s out — answer people questions from your HR system of record.',
      category: 'HR & People',
      connectorCategory: 'hr' as const,
      authType: 'BASIC' as const,
      scopes: [
        { scope: 'read', description: 'Directory, employee profiles and time off', required: true },
        { scope: 'time_off', description: 'Request time off for an employee (asks for approval)' },
      ],
      credentialFields: [
        { key: 'subdomain', label: 'Company domain', placeholder: 'acme', help: 'The part before .bamboohr.com.' },
        { key: 'apiKey', label: 'API key', secret: true, help: 'Your name → API Keys. The key has the same access as you — use an account limited to what agents should see.' },
      ],
    };
  }

  protected override validate(auth: BambooAuth) {
    bambooSubdomain(auth.subdomain);
  }

  protected target(auth: BambooAuth) {
    return { baseUrl: `https://api.bamboohr.com/api/gateway.php/${bambooSubdomain(auth.subdomain)}/v1`, basic: { username: auth.apiKey, password: 'x' } };
  }

  protected async ping(auth: BambooAuth, call: RestCall) {
    await call('GET', '/meta/fields');
    return { label: `${bambooSubdomain(auth.subdomain)}.bamboohr.com` };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'new_time_off_request', label: 'New time-off request', description: 'Starts the agent for each new time-off request.', pollActionId: 'list_time_off_requests', itemsPath: 'requests', idField: 'id' }];
  }

  protected actions(): RestAction<BambooAuth>[] {
    return [
      action({ id: 'list_employees', label: 'Employee directory', description: 'Everyone in the directory, optionally matching a name or department.', level: 'read', properties: { search: str('Name, email or department to match.'), limit: num('Max results (default 50).') } }, async ({ input, call }) => {
        const res = await call('GET', '/employees/directory');
        const needle = textOf(input['search']).toLowerCase();
        const employees = ((res.employees ?? []) as any[])
          .map((e) => ({ id: e.id, name: e.displayName, jobTitle: e.jobTitle ?? null, department: e.department ?? null, location: e.location ?? null, workEmail: e.workEmail ?? null, supervisor: e.supervisor ?? null }))
          .filter((e) => !needle || [e.name, e.workEmail, e.department, e.jobTitle].some((v) => String(v ?? '').toLowerCase().includes(needle)))
          .slice(0, boundedInt(input['limit'], 50, 1, 500));
        return { message: `Found ${employees.length} employee(s).`, data: { employees } };
      }),
      action({ id: 'get_employee', label: 'Get employee', description: 'Job, department, manager and hire date of one employee.', level: 'read', properties: { employeeId: str('Employee id.') }, required: ['employeeId'] }, async ({ input, call }) => {
        const { employeeId } = requireText(input, 'employeeId');
        const fields = 'firstName,lastName,displayName,jobTitle,department,division,location,workEmail,hireDate,supervisor,employmentHistoryStatus,status';
        const e = await call('GET', `/employees/${encodeURIComponent(employeeId)}`, { params: { fields } });
        return { message: 'Fetched the employee.', data: { employee: e } };
      }),
      action({ id: 'whos_out', label: 'Who’s out', description: 'People on time off (and holidays) between two dates.', level: 'read', properties: { start: str('YYYY-MM-DD (default today).'), end: str('YYYY-MM-DD (default in 14 days).') } }, async ({ input, call }) => {
        const start = DATE.test(textOf(input['start'])) ? textOf(input['start']) : isoDay(0);
        const end = DATE.test(textOf(input['end'])) ? textOf(input['end']) : isoDay(14);
        const rows = (await call('GET', '/time_off/whos_out/', { params: { start, end } })) as any[];
        const out = rows.map((r) => ({ type: r.type, name: r.name, employeeId: r.employeeId ?? null, start: r.start, end: r.end }));
        return { message: `${out.length} entr${out.length === 1 ? 'y' : 'ies'} between ${start} and ${end}.`, data: { out } };
      }),
      action({ id: 'list_time_off_requests', label: 'Time-off requests', description: 'Time-off requests in a date range.', level: 'read', properties: { start: str('YYYY-MM-DD (default 30 days ago).'), end: str('YYYY-MM-DD (default in 90 days).'), status: str('requested, approved, denied, canceled.') } }, async ({ input, call }) => {
        const start = DATE.test(textOf(input['start'])) ? textOf(input['start']) : isoDay(-30);
        const end = DATE.test(textOf(input['end'])) ? textOf(input['end']) : isoDay(90);
        const rows = (await call('GET', '/time_off/requests/', { params: { start, end, ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}) } })) as any[];
        const requests = rows.map((r) => ({ id: r.id, employeeId: r.employeeId, name: r.name, status: r.status?.status ?? null, type: r.type?.name ?? null, start: r.start, end: r.end, amount: r.amount ? `${r.amount.amount} ${r.amount.unit}` : null }));
        return { message: `Found ${requests.length} request(s).`, data: { requests } };
      }),
      action(
        {
          id: 'request_time_off',
          label: 'Request time off',
          description: 'Add a time-off request for an employee (it then follows BambooHR’s approval flow).',
          level: 'write',
          properties: { employeeId: str('Employee id.'), timeOffTypeId: str('Time-off type id.'), start: str('YYYY-MM-DD.'), end: str('YYYY-MM-DD.'), note: str('Note for the approver.') },
          required: ['employeeId', 'timeOffTypeId', 'start', 'end'],
        },
        async ({ input, call }) => {
          const { employeeId, timeOffTypeId, start, end } = requireText(input, 'employeeId', 'timeOffTypeId', 'start', 'end');
          if (!DATE.test(start) || !DATE.test(end)) throw new BadRequestException('start and end must be YYYY-MM-DD.');
          const res = await call('PUT', `/employees/${encodeURIComponent(employeeId)}/time_off/request`, {
            data: { status: 'requested', start, end, timeOffTypeId, ...(textOf(input['note']) ? { notes: [{ from: 'employee', note: textOf(input['note']) }] } : {}) },
          });
          return { message: `Requested time off ${start} → ${end}.`, data: { request: { id: res?.id ?? null, status: res?.status?.status ?? 'requested' } } };
        },
      ),
    ];
  }
}
