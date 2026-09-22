import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
} from '@org/ui';
import {
  PLANS_CONFIG,
  PLAN_TIERS,
  type PlanFeatureItem,
  type PlanTier,
} from '@org/types';
import { Check, ChevronDown, ChevronUp, Minus } from 'lucide-react';

export interface PlanComparisonTableProps {
  currentPlan?: PlanTier;
  onSelectPlan?: (tier: PlanTier) => void;
}

export function PlanComparisonTable({
  currentPlan,
  onSelectPlan,
}: PlanComparisonTableProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Group features by category from all plan definitions
  const groupedFeatures = useMemo(() => {
    const categoriesMap = new Map<
      string,
      Map<string, { label: string; planValues: Record<PlanTier, PlanFeatureItem | undefined> }>
    >();

    for (const tier of PLAN_TIERS) {
      const plan = PLANS_CONFIG[tier];
      for (const item of plan.expandedFeatures) {
        if (!categoriesMap.has(item.category)) {
          categoriesMap.set(item.category, new Map());
        }
        const catItems = categoriesMap.get(item.category)!;
        if (!catItems.has(item.id)) {
          catItems.set(item.id, {
            label: item.label,
            planValues: {
              starter: undefined,
              pro: undefined,
              business: undefined,
              enterprise: undefined,
            },
          });
        }
        catItems.get(item.id)!.planValues[tier] = item;
      }
    }

    return Array.from(categoriesMap.entries()).map(([category, itemsMap]) => ({
      category,
      items: Array.from(itemsMap.values()),
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            Compare Plan Features & Entitlements
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Complete technical breakdown of compute limits, micro agents, security, and enterprise support.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-border bg-surface-muted/60">
              <th className="p-4 md:p-5 font-semibold text-foreground min-w-[240px] sticky left-0 bg-surface-muted/95 backdrop-blur-xs z-10">
                Capability / Feature
              </th>
              {PLAN_TIERS.map((tier) => {
                const plan = PLANS_CONFIG[tier];
                const isCurrent = currentPlan === tier;
                return (
                  <th
                    key={tier}
                    className={`p-4 md:p-5 text-center min-w-[170px] ${
                      plan.isPopular ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-sm md:text-base">
                          {plan.name}
                        </span>
                        {plan.isPopular && (
                          <Badge
                            variant="primary"
                            className="text-[9px] px-1.5 py-0 uppercase"
                          >
                            Popular
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 uppercase"
                          >
                            Current
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {plan.isCustomQuote
                          ? 'Custom'
                          : `$${plan.pricing.monthly}/mo`}
                      </span>
                      {onSelectPlan && (
                        <Button
                          variant={
                            isCurrent
                              ? 'outline'
                              : plan.isPopular
                                ? 'primary'
                                : 'secondary'
                          }
                          size="xs"
                          disabled={isCurrent}
                          onClick={() => onSelectPlan(tier)}
                          className="mt-2 w-full max-w-[130px] text-[11px] font-medium"
                        >
                          {isCurrent ? 'Current' : 'Select'}
                        </Button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body by Category */}
          <tbody>
            {groupedFeatures.map(({ category, items }) => {
              const isCollapsed = collapsedCategories[category];

              return (
                <React.Fragment key={category}>
                  {/* Category Header Row */}
                  <tr
                    onClick={() => toggleCategory(category)}
                    className="border-b border-border/80 bg-surface-muted/40 hover:bg-surface-muted/80 cursor-pointer transition-colors"
                  >
                    <td
                      colSpan={5}
                      className="p-3 md:p-3.5 font-bold text-foreground text-xs uppercase tracking-wider"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {category}
                          <span className="text-[10px] lowercase font-normal text-muted-foreground">
                            ({items.length} items)
                          </span>
                        </span>
                        {isCollapsed ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Feature Rows */}
                  {!isCollapsed &&
                    items.map(({ label, planValues }) => (
                      <tr
                        key={label}
                        className="border-b border-border/40 hover:bg-surface-muted/20 transition-colors"
                      >
                        {/* Feature Name Column (Sticky) */}
                        <td className="p-3.5 md:p-4 text-foreground font-medium sticky left-0 bg-card/95 backdrop-blur-xs z-10">
                          {label}
                        </td>

                        {/* Tiers Columns */}
                        {PLAN_TIERS.map((tier) => {
                          const item = planValues[tier];
                          const isPopular = PLANS_CONFIG[tier].isPopular;

                          return (
                            <td
                              key={tier}
                              className={`p-3.5 md:p-4 text-center ${
                                isPopular ? 'bg-primary/5' : ''
                              }`}
                            >
                              {item ? (
                                item.valueText ? (
                                  <span className="font-semibold text-foreground text-xs">
                                    {item.valueText}
                                  </span>
                                ) : item.included ? (
                                  <Check className="size-4 mx-auto text-emerald-500 shrink-0" />
                                ) : (
                                  <Minus className="size-4 mx-auto text-muted-foreground/50 shrink-0" />
                                )
                              ) : (
                                <Minus className="size-4 mx-auto text-muted-foreground/50 shrink-0" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
