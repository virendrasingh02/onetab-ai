import { cn } from '@org/utils';
import { AppSelect } from './app-select.js';
import { Filter, Plus, Trash2 } from 'lucide-react';

import { useState, type ComponentProps } from 'react';
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
      : [
          {
            id: 'rule-1',
            field: fields[0]?.id ?? '',
            operator: 'contains',
            value: '',
          },
        ],
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
    const defaultRule = [
      {
        id: 'rule-1',
        field: fields[0]?.id ?? '',
        operator: 'contains' as FilterOperator,
        value: '',
      },
    ];
    setRules(defaultRule);
    onReset?.();
  };

  return (
    <div
      className={cn(
        'gap-3 p-3.5 text-xs flex flex-col rounded-card border border-border bg-surface shadow-xs',
        className,
      )}
      {...props}
    >
      <div className="pb-2 flex items-center justify-between border-b border-border">
        <div className="gap-1.5 font-semibold flex items-center text-foreground">
          <Filter className="size-3.5 text-brand-text" />
          <span>Filter Rules</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="font-medium text-meta text-muted-foreground hover:text-foreground"
        >
          Reset all
        </button>
      </div>

      <div className="gap-2 flex flex-col">
        {rules.map((rule, idx) => {
          const selectedField = fields.find((f) => f.id === rule.field);

          return (
            <div key={rule.id} className="gap-2 flex flex-wrap items-center">
              <span className="w-12 font-mono text-meta text-subtle">
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
                onValueChange={(v) =>
                  updateRule(rule.id, { operator: v as FilterOperator })
                }
                aria-label="Operator"
                options={Object.entries(operatorLabels).map(([op, label]) => ({
                  value: op,
                  label,
                }))}
              />

              {/* Value Input */}
              {rule.operator !== 'is_empty' &&
                rule.operator !== 'is_not_empty' &&
                (selectedField?.type === 'select' && selectedField.options ? (
                  <AppSelect
                    size="sm"
                    className="w-40"
                    value={rule.value}
                    onValueChange={(v) => updateRule(rule.id, { value: v })}
                    placeholder="Select value..."
                    aria-label="Value"
                    options={selectedField.options.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                  />
                ) : (
                  <input
                    type={selectedField?.type === 'number' ? 'number' : 'text'}
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(rule.id, { value: e.target.value })
                    }
                    placeholder="Value..."
                    className="h-7 min-w-32 theme-fixed px-2 text-xs flex-1 rounded-btn border border-input bg-field text-foreground outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ))}

              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="size-7 flex items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 mt-1 flex items-center justify-between border-t border-border">
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
