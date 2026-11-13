import { cn } from '@org/utils';
import { AlertCircle, Sparkles, Zap } from 'lucide-react';

import type { ComponentProps } from 'react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import { Progress } from './progress.js';

export interface AIUsageWidgetProps extends ComponentProps<'div'> {
  usedTokens: number;
  maxTokens: number;
  usedCredits: number;
  totalCredits: number;
  billingPeriod?: string;
  onUpgrade?: () => void;
}

export function AIUsageWidget({
  usedTokens,
  maxTokens,
  usedCredits,
  totalCredits,
  billingPeriod = 'Monthly Plan',
  onUpgrade,
  className,
  ...props
}: AIUsageWidgetProps) {
  const tokenPercentage = Math.min(
    100,
    Math.round((usedTokens / maxTokens) * 100),
  );
  const creditPercentage = Math.min(
    100,
    Math.round((usedCredits / totalCredits) * 100),
  );

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
          <Sparkles className="size-3.5 text-primary" />
          <span>AI Usage &amp; Credits</span>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {billingPeriod}
        </Badge>
      </div>

      {/* Token Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Token Quota</span>
          <span className="font-medium font-mono text-foreground">
            {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} (
            {tokenPercentage}%)
          </span>
        </div>
        <Progress value={tokenPercentage} className="h-1.5" />
      </div>

      {/* Credit Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Credits Balance</span>
          <span className="font-medium font-mono text-foreground">
            ${(totalCredits - usedCredits).toFixed(2)} remaining
          </span>
        </div>
        <Progress value={creditPercentage} className="h-1.5" />
      </div>

      {tokenPercentage >= 85 && (
        <div className="gap-1.5 p-2 flex items-center rounded-sm bg-warning/10 text-[11px] text-warning-text">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>Approaching plan quota limit for this cycle.</span>
        </div>
      )}

      {onUpgrade && (
        <Button
          size="xs"
          variant="outline"
          onClick={onUpgrade}
          className="mt-1 w-full"
          leadingIcon={<Zap className="size-3" />}
        >
          Upgrade Capacity
        </Button>
      )}
    </div>
  );
}
