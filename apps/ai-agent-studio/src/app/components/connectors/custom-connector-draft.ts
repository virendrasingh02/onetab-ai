import {
  slugifyActionId,
  type ConnectorCategory,
  type CustomConnectorAction,
  type CustomConnectorAuthType,
  type CustomConnectorDefinition,
  type CustomConnectorInput,
  type CustomConnectorMethod,
  type CustomConnectorParam,
  type CustomConnectorTrigger,
} from '@org/types';

/** What a stored header value shows as; sending it back keeps the saved value. */
export const MASKED = '••••';

export interface Row {
  k: string;
  v: string;
}

/** An action as the builder edits it: the query as rows, plus bookkeeping. */
export interface ActionDraft extends Omit<CustomConnectorAction, 'query'> {
  key: string;
  /** Once the person edits the id by hand, the label stops rewriting it. */
  idTouched: boolean;
  queryRows: Row[];
}

export interface TriggerDraft extends CustomConnectorTrigger {
  key: string;
}

/** The whole builder form. */
export interface Draft {
  name: string;
  description: string;
  category: ConnectorCategory;
  baseUrl: string;
  authType: CustomConnectorAuthType;
  apiKey: string;
  apiKeyHeader: string;
  apiKeyQueryParam: string;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  headerRows: Row[];
  scope: 'WORKSPACE' | 'USER';
  actions: ActionDraft[];
  triggers: TriggerDraft[];
}

let counter = 0;
export const newKey = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`;

export function blankAction(method: CustomConnectorMethod = 'GET'): ActionDraft {
  return {
    key: newKey(),
    id: '',
    idTouched: false,
    label: '',
    description: '',
    method,
    path: '',
    queryRows: [],
    body: '',
    params: [],
  };
}

export function blankDraft(): Draft {
  return {
    name: '',
    description: '',
    category: 'custom',
    baseUrl: '',
    authType: 'BEARER',
    apiKey: '',
    apiKeyHeader: 'X-API-Key',
    apiKeyQueryParam: 'api_key',
    bearerToken: '',
    basicUsername: '',
    basicPassword: '',
    headerRows: [],
    scope: 'WORKSPACE',
    actions: [{ ...blankAction('GET'), label: 'List items', id: 'list_items', description: 'Returns the items from this API.', path: '/items' }],
    triggers: [],
  };
}

/** A stored definition back into the form. Secrets stay blank: leaving them blank keeps the saved ones. */
export function draftFromDefinition(def: CustomConnectorDefinition): Draft {
  return {
    ...blankDraft(),
    name: def.name,
    description: def.description,
    category: def.category,
    baseUrl: def.baseUrl,
    authType: def.authType,
    apiKeyHeader: def.apiKeyHeader ?? 'X-API-Key',
    apiKeyQueryParam: def.apiKeyQueryParam ?? 'api_key',
    basicUsername: def.basicUsername ?? '',
    headerRows: (def.customHeaderNames ?? []).map((k) => ({ k, v: MASKED })),
    actions: def.actions.map((a) => ({
      ...a,
      key: newKey(),
      idTouched: true,
      body: a.body ?? '',
      queryRows: Object.entries(a.query ?? {}).map(([k, v]) => ({ k, v })),
    })),
    triggers: def.triggers.map((t) => ({ ...t, key: newKey() })),
  };
}

const rowsToRecord = (rows: Row[]) =>
  Object.fromEntries(rows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]));

export function actionFromDraft(a: ActionDraft): CustomConnectorAction {
  const { key: _key, idTouched: _touched, queryRows, ...rest } = a;
  const query = rowsToRecord(queryRows);
  return {
    ...rest,
    id: a.id.trim() || slugifyActionId(a.label),
    query,
    body: a.method === 'GET' || !a.body?.trim() ? undefined : a.body,
    params: a.params.filter((p) => p.name.trim()),
  };
}

export function inputFromDraft(d: Draft): CustomConnectorInput {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    category: d.category,
    baseUrl: d.baseUrl.trim(),
    authType: d.authType,
    apiKeyHeader: d.apiKeyHeader,
    apiKeyQueryParam: d.apiKeyQueryParam,
    basicUsername: d.basicUsername,
    ...(d.apiKey ? { apiKey: d.apiKey } : {}),
    ...(d.bearerToken ? { bearerToken: d.bearerToken } : {}),
    ...(d.basicPassword ? { basicPassword: d.basicPassword } : {}),
    customHeaders: rowsToRecord(d.headerRows),
    scopeType: d.scope,
    actions: d.actions.map(actionFromDraft),
    triggers: d.triggers.map(({ key: _key, ...t }) => t),
  };
}

/** `{{names}}` used in an action's path, query and body. */
export function usedPlaceholders(a: Pick<ActionDraft, 'path' | 'queryRows' | 'body'>): string[] {
  const text = [a.path, ...a.queryRows.map((r) => r.v), a.body ?? ''].join('\n');
  return [...new Set([...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g)].map((m) => m[1]))];
}

/** Placeholders the action uses that it has no input for yet. */
export function missingInputs(a: Pick<ActionDraft, 'path' | 'queryRows' | 'body' | 'params'>): string[] {
  const have = new Set(a.params.map((p) => p.name));
  return usedPlaceholders(a).filter((n) => !have.has(n));
}

export function newParam(name: string): CustomConnectorParam {
  return { name, type: 'string', required: true };
}
