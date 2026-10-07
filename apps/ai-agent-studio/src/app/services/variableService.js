import { storage } from './storage.js';
import { INITIAL_VARIABLES } from './mockData.js';

const STORAGE_KEY = 'variables_list';

function loadVariables() {
  const cached = storage.get(STORAGE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  storage.set(STORAGE_KEY, INITIAL_VARIABLES);
  return INITIAL_VARIABLES;
}

export const variableService = {
  async getVariables(scope = 'ALL') {
    const list = loadVariables();
    if (!scope || scope === 'ALL') return list;
    return list.filter((v) => v.scope === scope);
  },

  async saveVariable(varData) {
    const list = loadVariables();
    const isEdit = !!varData.id;
    const id = varData.id || `v-${Date.now().toString(36)}`;
    const saved = { ...varData, id };
    const updated = isEdit ? list.map((v) => (v.id === id ? saved : v)) : [saved, ...list];
    storage.set(STORAGE_KEY, updated);
    return saved;
  },

  async deleteVariable(id) {
    const list = loadVariables();
    const updated = list.filter((v) => v.id !== id);
    storage.set(STORAGE_KEY, updated);
    return { success: true };
  },

  getFunctionsCatalog() {
    return [
      { name: '$string.toUpperCase()', category: 'String', example: '$string.toUpperCase($json.name)', desc: 'Converts string to uppercase' },
      { name: '$string.trim()', category: 'String', example: '$string.trim($json.email)', desc: 'Removes leading/trailing whitespace' },
      { name: '$string.slugify()', category: 'String', example: '$string.slugify($json.title)', desc: 'Converts string to URL slug' },
      { name: '$math.round()', category: 'Math', example: '$math.round($json.price * 1.1)', desc: 'Rounds number to nearest integer' },
      { name: '$math.sum()', category: 'Math', example: '$math.sum($json.items.map(x => x.cost))', desc: 'Sums array of numbers' },
      { name: '$date.now()', category: 'Date/Time', example: '$date.now()', desc: 'Returns current ISO timestamp' },
      { name: '$date.format()', category: 'Date/Time', example: '$date.format($date.now(), "YYYY-MM-DD")', desc: 'Formats date to string' },
      { name: '$json.parse()', category: 'JSON', example: '$json.parse($vars.RAW_PAYLOAD)', desc: 'Parses string to JSON object' },
      { name: '$json.stringify()', category: 'JSON', example: '$json.stringify($json.result, null, 2)', desc: 'Serializes object to JSON string' },
    ];
  },

  evaluateExpression(expression, context = {}) {
    try {
      if (!expression || typeof expression !== 'string') return '';
      // Simple mock evaluator replacing {{ $vars.KEY }}
      const evaluated = expression.replace(/\{\{\s*\$vars\.([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const v = loadVariables().find((x) => x.key === key);
        return v ? v.value : `[undefined var: ${key}]`;
      });
      return evaluated;
    } catch {
      return expression;
    }
  },
};
