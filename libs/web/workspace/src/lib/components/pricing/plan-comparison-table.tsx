import React, { useMemo, useState } from 'react';
import { Badge, Button } from '@org/ui';
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
      Map<
        string,
        {
          label: string;
          planValues: Record<PlanTier, PlanFeatureItem | undefined>;
        }
      >
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
              free: undefined,
              pro: undefined,
              max: undefined,
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
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Compare Plan Features & Entitlements
          </h3>
          <p className="text-sm mt-1 text-muted-foreground">
            Complete technical breakdown of compute limits, micro agents,
            security, and enterprise support.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="text-xs md:text-sm w-full border-collapse text-left">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-border bg-surface-muted/60">
              <th className="p-4 md:p-5 font-semibold left-0 backdrop-blur-xs sticky z-10 min-w-[240px] bg-surface-muted/95 text-foreground">
                Capability / Feature
              </th>
              {PLAN_TIERS.map((tier) => {
                const plan = PLANS_CONFIG[tier];
                const isCurrent = currentPlan === tier;
                return (
                  <th
                    key={tier}
                    className={`p-4 md:p-5 min-w-[170px] text-center ${
                      plan.isPopular ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="gap-1 flex flex-col items-center">
                      <div className="gap-1.5 flex items-center">
                        <span className="font-semibold text-sm md:text-base text-foreground">
                          {plan.name}
                        </span>
                        {plan.isPopular && (
                          <Badge
                            variant="primary"
                            className="px-1.5 py-0 text-3xs uppercase"
                          >
                            Popular
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-3xs uppercase"
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
                          className="mt-2 font-medium w-full max-w-[130px] text-meta"
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
                    className="cursor-pointer border-b border-border/80 bg-surface-muted/40 transition-colors hover:bg-surface-muted/80"
                  >
                    <td
                      colSpan={5}
                      className="p-3 md:p-3.5 font-bold text-xs tracking-wider text-foreground uppercase"
                    >
                      <div className="flex items-center justify-between">
                        <span className="gap-2 flex items-center">
                          {category}
                          <span className="font-normal text-2xs text-muted-foreground lowercase">
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
                        className="border-b border-border/40 transition-colors hover:bg-surface-muted/20"
                      >
                        {/* Feature Name Column (Sticky) */}
                        <td className="p-3.5 md:p-4 font-medium left-0 backdrop-blur-xs sticky z-10 bg-card/95 text-foreground">
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
                                  <span className="font-semibold text-xs text-foreground">
                                    {item.valueText}
                                  </span>
                                ) : item.included ? (
                                  <Check className="size-4 mx-auto shrink-0 text-success-text" />
                                ) : (
                                  <Minus className="size-4 mx-auto shrink-0 text-muted-foreground/50" />
                                )
                              ) : (
                                <Minus className="size-4 mx-auto shrink-0 text-muted-foreground/50" />
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
