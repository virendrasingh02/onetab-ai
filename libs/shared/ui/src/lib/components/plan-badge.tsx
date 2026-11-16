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
  plan = 'free',
  size = 'sm',
  variant = 'subtle',
  showIcon = true,
  className,
}: PlanBadgeProps) {
  // Legacy tier names (starter/business) still arrive from older rows and clients.
  const raw = plan?.toLowerCase().trim() || 'free';
  const normalized: PlanTier =
    raw === 'business' ? 'max' : raw === 'starter' ? 'free' : (raw as PlanTier);

  const sizeClasses = {
    xs: 'text-2xs px-1.5 py-0 gap-1 h-4',
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
          ? 'bg-gradient-to-r from-warning/20 via-accent-orange/20 to-warning/10 text-warning-text border-warning/30'
          : variant === 'solid'
            ? 'bg-warning text-white border-transparent'
            : 'bg-warning/10 text-warning-text border-warning/25';
      break;

    case 'max':
      label = 'Max';
      Icon = Building2;
      styleClasses =
        variant === 'gradient'
          ? 'bg-gradient-to-r from-accent-indigo/20 via-accent-violet/20 to-accent-pink/15 text-accent-indigo border-accent-indigo/30'
          : variant === 'solid'
            ? 'bg-accent-indigo text-white border-transparent'
            : 'bg-accent-indigo/10 text-accent-indigo border-accent-indigo/25';
      break;

    case 'pro':
      label = 'Pro';
      Icon = Sparkles;
      styleClasses =
        variant === 'gradient'
          ? 'bg-gradient-to-r from-brand/20 via-brand/10 to-transparent text-brand-text border-brand/30'
          : variant === 'solid'
            ? 'bg-brand text-brand-foreground border-transparent'
            : 'bg-brand/10 text-brand-text border-brand/25';
      break;

    case 'free':
    default:
      label = 'Free';
      Icon = Bot;
      styleClasses = 'bg-surface-muted text-muted-foreground border-border';
      break;
  }

  return (
    <span
      className={cn(
        'font-medium tracking-wide inline-flex items-center justify-center rounded-md border uppercase',
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
