import { cn } from '@org/utils';
import { AppSelect } from './app-select.js';
import { Filter, Plus, Trash2 } from 'lucide-react';

import {
  useState,
  type ComponentProps,
} from 'react';
import { Button } from './button.js';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  options?: { value: string; label: string }[];
}

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterBuilderProps extends ComponentProps<'div'> {
  fields: FilterField[];
  rules?: FilterRule[];
  onApply?: (rules: FilterRule[]) => void;
  onReset?: () => void;
}

export function FilterBuilder({
  fields,
  rules: initialRules = [],
  onApply,
  onReset,
  className,
  ...props
}: FilterBuilderProps) {
  const [rules, setRules] = useState<FilterRule[]>(() =>
    initialRules.length > 0
      ? initialRules
      : [{ id: 'rule-1', field: fields[0]?.id ?? '', operator: 'contains', value: '' }],
  );

  const operatorLabels: Record<FilterOperator, string> = {
    equals: 'equals',
    not_equals: 'does not equal',
    contains: 'contains',
    starts_with: 'starts with',
    greater_than: 'greater than',
    less_than: 'less than',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
  };

  const addRule = () => {
    const newRule: FilterRule = {
      id: `rule-${Date.now()}`,
      field: fields[0]?.id ?? '',
      operator: 'contains',
      value: '',
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<FilterRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleReset = () => {
    const defaultRule = [{ id: 'rule-1', field: fields[0]?.id ?? '', operator: 'contains' as FilterOperator, value: '' }];
    setRules(defaultRule);
    onReset?.();
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-3.5 shadow-xs text-xs',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Filter className="size-3.5 text-primary" />
          <span>Filter Rules</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
        >
          Reset all
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {rules.map((rule, idx) => {
          const selectedField = fields.find((f) => f.id === rule.field);

          return (
            <div key={rule.id} className="flex flex-wrap items-center gap-2">
              <span className="w-12 text-[11px] font-mono text-subtle">
                {idx === 0 ? 'Where' : 'And'}
              </span>

              {/* Field Select */}
              <AppSelect
                size="sm"
                className="w-36"
                value={rule.field}
                onValueChange={(v) => updateRule(rule.id, { field: v })}
                aria-label="Field"
                options={fields.map((f) => ({ value: f.id, label: f.label }))}
              />

              {/* Operator Select */}
              <AppSelect
                size="sm"
                className="w-36"
                value={rule.operator}
                onValueChange={(v) => updateRule(rule.id, { operator: v as FilterOperator })}
                aria-label="Operator"
                options={Object.entries(operatorLabels).map(([op, label]) => ({ value: op, label }))}
              />

              {/* Value Input */}
              {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
                selectedField?.type === 'select' && selectedField.options ? (
                  <AppSelect
                    size="sm"
                    className="w-40"
                    value={rule.value}
                    onValueChange={(v) => updateRule(rule.id, { value: v })}
                    placeholder="Select value..."
                    aria-label="Value"
                    options={selectedField.options.map((opt) => ({ value: opt.value, label: opt.label }))}
                  />
                ) : (
                  <input
                    type={selectedField?.type === 'number' ? 'number' : 'text'}
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="Value..."
                    className="h-7 min-w-32 flex-1 rounded-btn border border-input bg-surface px-2 text-xs text-foreground placeholder:text-subtle outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                  />
                )
              )}

              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="size-7 rounded-btn flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
        <Button
          variant="outline"
          size="xs"
          onClick={addRule}
          leadingIcon={<Plus className="size-3" />}
        >
          Add condition
        </Button>

        {onApply && (
          <Button size="xs" variant="primary" onClick={() => onApply(rules)}>
            Apply filter
          </Button>
        )}
      </div>
    </div>
  );
}
