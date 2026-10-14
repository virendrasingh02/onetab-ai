/**
 * Custom connectors: an app the workspace describes itself (a REST API plus
 * the named actions it offers), which then behaves like any built-in
 * connector — its actions are agent tools, workflow steps and, for reads,
 * event triggers.
 *
 * Pure and dependency-free so the API, the Studio and tests share it.
 */
import type { AppActionDefinition } from './integrations.js';
import type { ConnectorCategory, ConnectorTriggerDefinition } from './connectors.js';

export type CustomConnectorAuthType = 'NONE' | 'BEARER' | 'API_KEY_HEADER' | 'API_KEY_QUERY' | 'BASIC';
export type CustomConnectorMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type CustomConnectorParamType = 'string' | 'number' | 'boolean' | 'json';

/** One value an agent or workflow passes when it runs the action. */
export interface CustomConnectorParam {
  /** `{{name}}` in the path, query or body is replaced by this value. */
  name: string;
  type: CustomConnectorParamType;
  required: boolean;
  description?: string;
}

/** One request the connector can make. */
export interface CustomConnectorAction {
  /** Stable id (snake_case); part of the agent tool name. */
  id: string;
  label: string;
  description: string;
  method: CustomConnectorMethod;
  /** Relative to the base URL; may hold `{{param}}` placeholders, e.g. `/orders/{{orderId}}`. */
  path: string;
  /** Query parameters; values may hold `{{param}}` placeholders. */
  query?: Record<string, string>;
  /** JSON body template for POST / PUT / PATCH; strings may hold `{{param}}` placeholders. */
  body?: string;
  params: CustomConnectorParam[];
  /**
   * Overrides what the method implies (GET reads; POST/PUT/PATCH write; DELETE
   * deletes) — e.g. a POST search endpoint that only reads.
   */
  permissionLevel?: AppActionDefinition['permissionLevel'];
}

/** An event that starts an agent: a read action is polled and each new item fires one run. */
export interface CustomConnectorTrigger {
  id: string;
  label: string;
  description?: string;
  /** A read action of this connector. */
  actionId: string;
  /** Dotted path from the response to the item list; empty when the response is the list. */
  itemsPath: string;
  /** Field that identifies an item. */
  idField: string;
}

/** What is stored (without secrets) and shown for a custom connector. */
export interface CustomConnectorDefinition {
  name: string;
  description: string;
  category: ConnectorCategory;
  baseUrl: string;
  authType: CustomConnectorAuthType;
  apiKeyHeader?: string;
  apiKeyQueryParam?: string;
  basicUsername?: string;
  /** Header names only — values are secrets and live encrypted. */
  customHeaderNames?: string[];
  actions: CustomConnectorAction[];
  triggers: CustomConnectorTrigger[];
}

/** Everything the builder sends, secrets included. */
export interface CustomConnectorInput extends Omit<CustomConnectorDefinition, 'customHeaderNames'> {
  apiKey?: string;
  bearerToken?: string;
  basicPassword?: string;
  customHeaders?: Record<string, string>;
  scopeType?: 'WORKSPACE' | 'USER';
}

/** Marks a provider key as one a workspace defined (`CUSTOM_ORDERS_1A2B3C4D`), as opposed to the generic `CUSTOM_API`. */
export function isCustomConnectorProvider(provider: string): boolean {
  return /^CUSTOM_[A-Z0-9_]+_[A-Z0-9]{8}$/.test(provider.toUpperCase());
}

export function customConnectorProviderKey(name: string, uniqueId: string): string {
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'APP';
  const suffix = uniqueId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase().padEnd(8, '0');
  return `CUSTOM_${slug}_${suffix}`;
}

const ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const PARAM_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function actionPermission(action: Pick<CustomConnectorAction, 'method' | 'permissionLevel'>): AppActionDefinition['permissionLevel'] {
  if (action.permissionLevel) return action.permissionLevel;
  if (action.method === 'GET') return 'read';
  if (action.method === 'DELETE') return 'destructive';
  return 'write';
}

/** snake_case id from a label. */
export function slugifyActionId(label: string): string {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(id) ? id : id ? `a_${id}`.slice(0, 40) : '';
}

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

function bodyPlaceholders(body: string | undefined): string[] {
  return body ? placeholdersIn(body) : [];
}

/** Problems that stop a definition being saved, each one readable on its own. */
export function validateCustomConnector(input: Pick<CustomConnectorInput, 'name' | 'baseUrl' | 'actions' | 'triggers' | 'authType'> & Partial<CustomConnectorInput>): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('Give the connector a name.');
  if (!input.baseUrl?.trim()) errors.push('Enter the API’s base URL.');
  else if (!/^https?:\/\//i.test(input.baseUrl.trim())) errors.push('The base URL must start with http:// or https://.');
  if (input.authType === 'API_KEY_HEADER' && !input.apiKeyHeader?.trim()) errors.push('Name the header that carries the API key.');
  if (input.authType === 'BASIC' && !input.basicUsername?.trim()) errors.push('Enter the username for basic sign-in.');
  if (!input.actions?.length) errors.push('Add at least one action, so agents have something to do.');

  const seen = new Set<string>();
  for (const action of input.actions ?? []) {
    const where = action.label?.trim() ? `“${action.label.trim()}”` : 'An action';
    if (!action.label?.trim()) errors.push('Every action needs a name.');
    if (!ID_PATTERN.test(action.id ?? '')) errors.push(`${where} needs an id of lowercase letters, numbers and underscores.`);
    else if (seen.has(action.id)) errors.push(`Two actions share the id “${action.id}”.`);
    seen.add(action.id);
    if (!action.description?.trim()) errors.push(`${where} needs a description — it tells agents when to use it.`);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(action.method)) errors.push(`${where} needs a method.`);
    if (/^[a-z]+:\/\//i.test(action.path ?? '')) errors.push(`${where}: the path is added to the base URL — don’t include the host.`);

    const names = new Set<string>();
    for (const p of action.params ?? []) {
      if (!PARAM_PATTERN.test(p.name ?? '')) errors.push(`${where}: “${p.name || '(blank)'}” isn’t a valid input name (letters, numbers, underscores).`);
      else if (names.has(p.name)) errors.push(`${where}: the input “${p.name}” is listed twice.`);
      names.add(p.name);
    }
    const used = [
      ...placeholdersIn(action.path ?? ''),
      ...Object.values(action.query ?? {}).flatMap(placeholdersIn),
      ...bodyPlaceholders(action.body),
    ];
    for (const name of new Set(used)) {
      if (!names.has(name)) errors.push(`${where} uses {{${name}}} but has no input called “${name}”.`);
    }
    if (action.body?.trim()) {
      if (action.method === 'GET') errors.push(`${where}: a GET request can’t have a body.`);
      else {
        try {
          JSON.parse(action.body);
        } catch {
          errors.push(`${where}: the body must be valid JSON (placeholders go inside quotes, e.g. "{{name}}").`);
        }
      }
    }
  }

  const triggerIds = new Set<string>();
  for (const t of input.triggers ?? []) {
    if (!ID_PATTERN.test(t.id ?? '')) errors.push('Every event needs an id of lowercase letters, numbers and underscores.');
    else if (triggerIds.has(t.id)) errors.push(`Two events share the id “${t.id}”.`);
    triggerIds.add(t.id);
    const source = input.actions?.find((a) => a.id === t.actionId);
    if (!source) errors.push(`The event “${t.label || t.id}” watches an action that doesn’t exist.`);
    else if (actionPermission(source) !== 'read') errors.push(`The event “${t.label || t.id}” watches “${source.label}”, which changes data. Events can only watch reads.`);
    else if (source.params.some((p) => p.required)) errors.push(`The event “${t.label || t.id}” watches “${source.label}”, which needs inputs. Pick a read with no required inputs.`);
    if (!t.idField?.trim()) errors.push(`The event “${t.label || t.id}” needs the field that identifies each item.`);
  }
  return errors;
}

const JSON_TYPE: Record<CustomConnectorParamType, Record<string, unknown>> = {
  string: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  json: { type: 'object' },
};

/** The runtime's action definition for one custom action. */
export function customActionDefinition(action: CustomConnectorAction): AppActionDefinition {
  const permissionLevel = actionPermission(action);
  const properties: Record<string, unknown> = {};
  for (const p of action.params) {
    properties[p.name] = { ...JSON_TYPE[p.type], ...(p.description ? { description: p.description } : {}) };
  }
  const required = action.params.filter((p) => p.required).map((p) => p.name);
  return {
    id: action.id,
    label: action.label,
    description: action.description,
    inputSchema: { type: 'object', properties, ...(required.length ? { required } : {}) },
    permissionLevel,
    requiresConfirmation: permissionLevel !== 'read',
  };
}

export function customTriggerDefinitions(triggers: ReadonlyArray<CustomConnectorTrigger>): ConnectorTriggerDefinition[] {
  return triggers.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description || `Starts the agent for each new item ${t.label.toLowerCase()} returns.`,
    pollActionId: t.actionId,
    itemsPath: t.itemsPath ?? '',
    idField: t.idField,
  }));
}

const WHOLE_PLACEHOLDER = /^\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}$/;

function asText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function coerce(param: CustomConnectorParam | undefined, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (!param) return value;
  if (param.type === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (param.type === 'boolean') return typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
  if (param.type === 'json' && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function fillTemplate(node: unknown, values: Map<string, unknown>): unknown {
  if (typeof node === 'string') {
    const whole = WHOLE_PLACEHOLDER.exec(node);
    if (whole) return values.get(whole[1]);
    return node.replace(PLACEHOLDER, (_m, name: string) => asText(values.get(name)));
  }
  if (Array.isArray(node)) return node.map((n) => fillTemplate(n, values)).filter((n) => n !== undefined);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const filled = fillTemplate(v, values);
      if (filled !== undefined) out[k] = filled;
    }
    return out;
  }
  return node;
}

export interface RenderedCustomRequest {
  method: CustomConnectorMethod;
  path: string;
  query: Record<string, string>;
  body?: unknown;
}

/**
 * Turns an action plus the input an agent supplied into the request to send.
 * Throws a readable error when a required input is missing.
 */
export function renderCustomRequest(action: CustomConnectorAction, input: Record<string, unknown>): RenderedCustomRequest {
  const values = new Map<string, unknown>();
  for (const p of action.params) {
    const v = coerce(p, input[p.name]);
    if (v === undefined && p.required) throw new Error(`“${p.name}” is required to run ${action.label}.`);
    if (v !== undefined) values.set(p.name, v);
  }

  const path = action.path.replace(PLACEHOLDER, (_m, name: string) => encodeURIComponent(asText(values.get(name))));
  const query: Record<string, string> = {};
  for (const [key, template] of Object.entries(action.query ?? {})) {
    const whole = WHOLE_PLACEHOLDER.exec(template);
    // A query value that is just an input nobody supplied is left out, not sent blank.
    if (whole && !values.has(whole[1])) continue;
    const text = template.replace(PLACEHOLDER, (_m, name: string) => asText(values.get(name)));
    if (text !== '') query[key] = text;
  }

  let body: unknown;
  if (action.method !== 'GET' && action.body?.trim()) {
    body = fillTemplate(JSON.parse(action.body), values);
  } else if (action.method !== 'GET' && action.method !== 'DELETE') {
    // No template: the inputs that aren't in the path or query form the body.
    const inPath = new Set([...placeholdersIn(action.path), ...Object.values(action.query ?? {}).flatMap(placeholdersIn)]);
    const rest = Object.fromEntries([...values].filter(([k]) => !inPath.has(k)));
    if (Object.keys(rest).length) body = rest;
  }
  return { method: action.method, path, query, ...(body !== undefined ? { body } : {}) };
}
