/**
 * What a step's output looks like, as a (small) JSON Schema, and the
 * `{{variable}}` paths it offers. A connector action declares the schema of
 * the `data` it returns; the engine spreads that data into the step's output,
 * so `{{<stepId>.<path>}}` reads a field of it.
 */

export interface OutputField {
  /** Dotted path under the step: `messages`, `messages.0.subject`. */
  path: string;
  type: string;
  description?: string;
}

type Schema = Record<string, unknown>;

const isSchema = (value: unknown): value is Schema => !!value && typeof value === 'object' && !Array.isArray(value);

const MAX_FIELDS = 80;

/**
 * The fields a schema declares, flattened to dotted paths. Objects expand to
 * their properties; a list shows as itself plus its first item's fields
 * (`messages.0.subject`), because the engine reads `0` as the first index.
 * Depth and count are capped so a large schema stays pickable.
 */
export function outputSchemaFields(schema: unknown, maxDepth = 3): OutputField[] {
  const out: OutputField[] = [];
  const walk = (node: unknown, prefix: string, depth: number) => {
    if (!isSchema(node) || out.length >= MAX_FIELDS) return;
    const props = node['properties'];
    if (isSchema(props)) {
      for (const [key, raw] of Object.entries(props)) {
        if (!isSchema(raw) || out.length >= MAX_FIELDS) continue;
        const path = prefix ? `${prefix}.${key}` : key;
        const type = typeof raw['type'] === 'string' ? raw['type'] : isSchema(raw['items']) ? 'array' : 'object';
        out.push({
          path,
          type,
          ...(typeof raw['description'] === 'string' ? { description: raw['description'] } : {}),
        });
        if (depth >= maxDepth) continue;
        if (type === 'object') walk(raw, path, depth + 1);
        else if (type === 'array' && isSchema(raw['items'])) walk(raw['items'], `${path}.0`, depth + 1);
      }
    }
  };
  walk(schema, '', 1);
  return out;
}

/** Shorthand builders so adapters can declare a schema without the noise. */
export const out = {
  string: (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) }),
  number: (description?: string): Schema => ({ type: 'number', ...(description ? { description } : {}) }),
  boolean: (description?: string): Schema => ({ type: 'boolean', ...(description ? { description } : {}) }),
  array: (items: Schema, description?: string): Schema => ({ type: 'array', items, ...(description ? { description } : {}) }),
  object: (properties: Record<string, Schema>, description?: string): Schema => ({
    type: 'object',
    properties,
    ...(description ? { description } : {}),
  }),
};
