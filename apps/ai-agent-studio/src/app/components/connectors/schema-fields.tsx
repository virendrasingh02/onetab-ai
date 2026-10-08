import { AppSelect, Input, Switch, Textarea } from '@org/ui';

/** One input of a JSON-Schema object, as the connector manifest declares it. */
interface SchemaProperty {
  type?: string | string[];
  description?: string;
  label?: string;
  enum?: unknown[];
  items?: { type?: string };
  default?: unknown;
}

export interface ObjectSchema {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

export function schemaProperties(schema: unknown): Array<[string, SchemaProperty]> {
  const props = (schema as ObjectSchema | undefined)?.properties;
  return props && typeof props === 'object' ? Object.entries(props) : [];
}

function typeOf(prop: SchemaProperty): string {
  return Array.isArray(prop.type) ? (prop.type.find((t) => t !== 'null') ?? 'string') : (prop.type ?? 'string');
}

/** Field values are edited as text (so `{{variables}}` fit anywhere); this turns them into the action's input. */
export function coerceSchemaInput(schema: unknown, values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, prop] of schemaProperties(schema)) {
    const raw = values[key];
    if (raw === undefined || raw === '') continue;
    // A variable resolves at run time, whatever the declared type.
    if (/\{\{[^}]+\}\}/.test(raw)) {
      out[key] = raw;
      continue;
    }
    const type = typeOf(prop);
    if (type === 'number' || type === 'integer') {
      const n = Number(raw);
      out[key] = Number.isFinite(n) ? n : raw;
    } else if (type === 'boolean') {
      out[key] = raw === 'true';
    } else if (type === 'array') {
      out[key] = raw.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (type === 'object') {
      try {
        out[key] = JSON.parse(raw);
      } catch {
        out[key] = raw;
      }
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/** The reverse: a saved input shown back as editable text. */
export function inputToFieldValues(input: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v === undefined || v === null) continue;
    out[k] = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return out;
}

export function missingRequired(schema: unknown, values: Record<string, string>): string[] {
  const required = (schema as ObjectSchema | undefined)?.required ?? [];
  return required.filter((k) => !values[k]?.trim());
}

function humanize(key: string): string {
  const text = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Inputs for a connector action or trigger, generated from its schema.
 * Every text field also accepts `{{variables}}` from earlier steps.
 */
export function SchemaFields({
  schema,
  values,
  onChange,
  idPrefix,
  allowVariables = false,
}: {
  schema: unknown;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  idPrefix: string;
  allowVariables?: boolean;
}) {
  const props = schemaProperties(schema);
  const required = new Set((schema as ObjectSchema | undefined)?.required ?? []);
  if (props.length === 0) {
    return <p className="text-xs text-muted-foreground">This needs no input.</p>;
  }
  const set = (key: string, value: string) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-3">
      {props.map(([key, prop]) => {
        const id = `${idPrefix}-${key}`;
        const type = typeOf(prop);
        const label = prop.label ?? humanize(key);
        const hint = prop.description;
        const value = values[key] ?? '';
        let control;
        if (Array.isArray(prop.enum) && prop.enum.length > 0) {
          control = (
            <AppSelect
              value={value}
              onValueChange={(v) => set(key, v)}
              placeholder="Choose…"
              options={prop.enum.map((e) => ({ value: String(e), label: String(e) }))}
            />
          );
        } else if (type === 'boolean' && !allowVariables) {
          control = (
            <Switch id={id} checked={value === 'true'} onCheckedChange={(checked) => set(key, checked ? 'true' : 'false')} />
          );
        } else if (type === 'object' || /body|text|content|message|description|markdown|query/i.test(key)) {
          control = (
            <Textarea
              id={id}
              value={value}
              rows={type === 'object' ? 4 : 3}
              onChange={(e) => set(key, e.target.value)}
              placeholder={type === 'object' ? '{ }' : allowVariables ? 'Text, or {{steps.previous.output}}' : undefined}
              className="font-mono text-xs"
            />
          );
        } else {
          control = (
            <Input
              id={id}
              value={value}
              inputMode={type === 'number' || type === 'integer' ? 'decimal' : undefined}
              onChange={(e) => set(key, e.target.value)}
              placeholder={type === 'array' ? 'Comma-separated' : allowVariables ? 'Value or {{variable}}' : undefined}
              className="text-xs"
            />
          );
        }
        return (
          <div key={key} className="space-y-1">
            <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-foreground">
              {label}
              {required.has(key) && <span className="text-destructive" aria-label="required">*</span>}
            </label>
            {control}
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
