import { cn } from '@org/utils';
import { Bot, Building2, Crown, Sparkles } from 'lucide-react';
import type { PlanTier } from '@org/types';


export interface PlanBadgeProps {
  plan?: PlanTier | string | null;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'solid' | 'subtle' | 'outline' | 'gradient';
  showIcon?: boolean;
  className?: string;
}

export function PlanBadge({
  plan = 'starter',
  size = 'sm',
  variant = 'subtle',
  showIcon = true,
  className,
}: PlanBadgeProps) {
  const normalized = (plan?.toLowerCase().trim() || 'starter') as PlanTier;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0 gap-1 h-4',
    sm: 'text-xs px-2 py-0.5 gap-1.5 h-5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold h-6',
  }[size];

  const iconSizes = {
    xs: 'size-2.5',
    sm: 'size-3',
    md: 'size-3.5',
  }[size];

  let label: string;
  let Icon: typeof Bot;
  let styleClasses: string;

  switch (normalized) {
    case 'enterprise':
      label = 'Enterprise';
      Icon = Crown;
      styleClasses =
        variant === 'gradient'
          ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          : variant === 'solid'
            ? 'bg-amber-500 text-white border-transparent'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25';
      break;

    case 'business':
      label = 'Business';
      Icon = Building2;
      styleClasses =
        variant === 'gradient'
          ? 'bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
          : variant === 'solid'
            ? 'bg-indigo-600 text-white border-transparent'
            : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25';
      break;

    case 'pro':
      label = 'Pro';
      Icon = Sparkles;
      styleClasses =
        variant === 'gradient'
          ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-primary border-primary/30'
          : variant === 'solid'
            ? 'bg-primary text-primary-foreground border-transparent'
            : 'bg-primary/10 text-primary border-primary/25';
      break;

    case 'starter':
    default:
      label = 'Starter';
      Icon = Bot;
      styleClasses = 'bg-surface-muted text-muted-foreground border-border';
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md border tracking-wide uppercase',
        sizeClasses,
        styleClasses,
        className,
      )}
    >
      {showIcon ? <Icon className={cn('shrink-0', iconSizes)} /> : null}
      <span>{label}</span>
    </span>
  );
}
