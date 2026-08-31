import type { CSSProperties, ReactNode } from 'react';
import { generateCssGradient } from './gradient-engine.js';
import type { GradientConfig } from '@org/types';

/** Helper utility to retrieve CSS variable string for inline styles. */
export function getThemeColor(token: string, fallback?: string): string {
  const normalized = token.startsWith('--') ? token : `--color-${token}`;
  return fallback ? `var(${normalized}, ${fallback})` : `var(${normalized})`;
}

/** Helper utility to retrieve named gradient token CSS variable. */
export function getThemeGradient(name: 'primary' | 'secondary' | 'accent' | 'hero' | 'sidebar' | 'button' | 'surface' | 'background' = 'primary', fallback = 'none'): string {
  return `var(--gradient-${name}, ${fallback})`;
}

/** Helper utility to generate comprehensive surface styling (flat, gradient, glassmorphism). */
export function getSurfaceStyle(
  variant: 'default' | 'raised' | 'muted' | 'inset' | 'gradient' | 'glass' = 'default',
  options?: { blur?: number; opacity?: number; border?: boolean; customGradient?: GradientConfig | string },
): CSSProperties {
  const style: CSSProperties = {};

  if (variant === 'gradient') {
    style.background = options?.customGradient ? generateCssGradient(options.customGradient) : 'var(--gradient-surface, var(--surface))';
  } else if (variant === 'glass') {
    const blur = options?.blur ?? 12;
    const opacity = options?.opacity ?? 0.8;
    style.background = `color-mix(in srgb, var(--surface) ${Math.round(opacity * 100)}%, transparent)`;
    style.backdropFilter = `blur(${blur}px)`;
    style.WebkitBackdropFilter = `blur(${blur}px)`;
  } else if (variant === 'raised') {
    style.background = 'var(--surface-raised)';
  } else if (variant === 'muted') {
    style.background = 'var(--surface-muted)';
  } else if (variant === 'inset') {
    style.background = 'var(--surface-inset)';
  } else {
    style.background = 'var(--surface)';
  }

  if (options?.border !== false) {
    style.borderColor = 'var(--border)';
  }

  return style;
}

/**
 * Returns structured object of theme token CSS variable references for easy access.
 */
export function getThemeTokens() {
  return {
    colors: {
      primary: 'var(--color-primary, var(--primary))',
      primaryForeground: 'var(--color-primary-foreground, var(--primary-foreground))',
      secondary: 'var(--color-secondary, var(--secondary))',
      secondaryForeground: 'var(--color-secondary-foreground, var(--secondary-foreground))',
      background: 'var(--color-background, var(--background))',
      foreground: 'var(--color-foreground, var(--foreground))',
      card: 'var(--color-card, var(--card))',
      cardForeground: 'var(--color-card-foreground, var(--card-foreground))',
      muted: 'var(--color-muted, var(--muted))',
      mutedForeground: 'var(--color-muted-foreground, var(--muted-foreground))',
      accent: 'var(--color-accent, var(--accent))',
      accentForeground: 'var(--color-accent-foreground, var(--accent-foreground))',
      border: 'var(--color-border, var(--border))',
      ring: 'var(--color-ring, var(--ring))',
      destructive: 'var(--color-destructive, var(--destructive))',
      success: 'var(--color-success, var(--success))',
      warning: 'var(--color-warning, var(--warning))',
      info: 'var(--color-info, var(--info))',
    },
    gradients: {
      primary: 'var(--gradient-primary)',
      secondary: 'var(--gradient-secondary)',
      accent: 'var(--gradient-accent)',
      hero: 'var(--gradient-hero)',
      sidebar: 'var(--gradient-sidebar)',
      button: 'var(--gradient-button)',
      surface: 'var(--gradient-surface)',
    },
    radius: {
      btn: 'var(--radius-btn, var(--radius-sm))',
      card: 'var(--radius-card, var(--radius-md))',
      input: 'var(--radius-input, var(--radius-sm))',
      dialog: 'var(--radius-dialog, var(--radius-xl))',
    },
  };
}

export interface ThemeSurfaceProps {
  children?: ReactNode;
  variant?: 'default' | 'raised' | 'muted' | 'inset' | 'gradient' | 'glass';
  className?: string;
  style?: CSSProperties;
  glassBlur?: number;
  glassOpacity?: number;
  customGradient?: GradientConfig | string;
  onClick?: () => void;
}

/** Container element styled automatically with theme tokens and surface treatments. */
export function ThemeSurface({
  children,
  variant = 'default',
  className = '',
  style,
  glassBlur,
  glassOpacity,
  customGradient,
  onClick,
}: ThemeSurfaceProps) {
  const surfaceStyle = getSurfaceStyle(variant, {
    blur: glassBlur,
    opacity: glassOpacity,
    customGradient,
  });

  return (
    <div
      onClick={onClick}
      style={{ ...surfaceStyle, ...style }}
      className={`border rounded-(--radius-card,8px) text-foreground transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export interface GradientSurfaceProps {
  children?: ReactNode;
  gradient?: 'primary' | 'secondary' | 'accent' | 'hero' | 'sidebar' | 'button' | 'surface' | GradientConfig | string;
  className?: string;
  style?: CSSProperties;
}

/** Container with gradient background. */
export function GradientSurface({
  children,
  gradient = 'primary',
  className = '',
  style,
}: GradientSurfaceProps) {
  const bg = typeof gradient === 'string' && ['primary', 'secondary', 'accent', 'hero', 'sidebar', 'button', 'surface'].includes(gradient)
    ? getThemeGradient(gradient as any)
    : generateCssGradient(gradient);

  return (
    <div
      style={{ background: bg, ...style }}
      className={`text-foreground transition-all ${className}`}
    >
      {children}
    </div>
  );
}

export interface ThemeCardProps {
  children?: ReactNode;
  variant?: 'default' | 'raised' | 'glass' | 'gradient';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** Reusable card component adhering to platform geometry and elevation tokens. */
export function ThemeCard({
  children,
  variant = 'default',
  className = '',
  style,
  onClick,
}: ThemeCardProps) {
  return (
    <ThemeSurface
      variant={variant}
      onClick={onClick}
      style={style}
      className={`p-4 sm:p-5 shadow-(--shadow-elevated-value,var(--shadow-xs)) ${className}`}
    >
      {children}
    </ThemeSurface>
  );
}

export interface ThemeButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'gradient' | 'outline' | 'ghost' | 'secondary';
  gradientType?: 'primary' | 'secondary' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/** Reusable button supporting flat or gradient styling. */
export function ThemeButton({
  children,
  variant = 'primary',
  gradientType = 'primary',
  size = 'md',
  className = '',
  style,
  disabled,
  type = 'button',
  onClick,
}: ThemeButtonProps) {
  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] h-7',
    sm: 'px-3 py-1.5 text-xs h-8',
    md: 'px-4 py-2 text-xs font-medium h-9',
    lg: 'px-5 py-2.5 text-sm font-semibold h-10',
  }[size];

  const variantStyle: CSSProperties = {};
  let baseClasses = 'inline-flex items-center justify-center gap-2 rounded-(--radius-btn,6px) transition-all cursor-pointer select-none font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none';

  if (variant === 'gradient') {
    variantStyle.background = getThemeGradient(gradientType);
    variantStyle.color = 'var(--primary-foreground, #ffffff)';
    baseClasses += ' shadow-xs hover:brightness-105 active:scale-[0.98] border-0';
  } else if (variant === 'primary') {
    variantStyle.background = 'var(--primary)';
    variantStyle.color = 'var(--primary-foreground)';
    baseClasses += ' shadow-xs hover:brightness-95 active:scale-[0.98] border-0';
  } else if (variant === 'secondary') {
    variantStyle.background = 'var(--secondary)';
    variantStyle.color = 'var(--secondary-foreground)';
    baseClasses += ' border border-border hover:bg-accent/80';
  } else if (variant === 'outline') {
    variantStyle.background = 'transparent';
    variantStyle.borderColor = 'var(--border)';
    variantStyle.color = 'var(--foreground)';
    baseClasses += ' border hover:bg-accent/60';
  } else if (variant === 'ghost') {
    variantStyle.background = 'transparent';
    variantStyle.color = 'var(--foreground)';
    baseClasses += ' hover:bg-accent/60';
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...variantStyle, ...style }}
      className={`${sizeClasses} ${baseClasses} ${className}`}
    >
      {children}
    </button>
  );
}

export interface ThemeBadgeProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'gradient' | 'outline' | 'success' | 'warning' | 'destructive' | 'info';
  className?: string;
  style?: CSSProperties;
}

/** Reusable badge adhering to theme palette and gradients. */
export function ThemeBadge({
  children,
  variant = 'primary',
  className = '',
  style,
}: ThemeBadgeProps) {
  const variantStyle: CSSProperties = {};
  let baseClass = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border';

  if (variant === 'gradient') {
    variantStyle.background = getThemeGradient('primary');
    variantStyle.color = 'var(--primary-foreground, #ffffff)';
    baseClass += ' border-transparent shadow-2xs';
  } else if (variant === 'primary') {
    variantStyle.background = 'color-mix(in srgb, var(--primary) 15%, transparent)';
    variantStyle.color = 'var(--primary-text, var(--primary))';
    variantStyle.borderColor = 'color-mix(in srgb, var(--primary) 25%, transparent)';
  } else if (variant === 'secondary') {
    variantStyle.background = 'var(--secondary)';
    variantStyle.color = 'var(--secondary-foreground)';
    variantStyle.borderColor = 'var(--border)';
  } else if (variant === 'outline') {
    variantStyle.background = 'transparent';
    variantStyle.color = 'var(--foreground)';
    variantStyle.borderColor = 'var(--border)';
  } else if (variant === 'success') {
    variantStyle.background = 'color-mix(in srgb, var(--success) 15%, transparent)';
    variantStyle.color = 'var(--success-text, var(--success))';
    variantStyle.borderColor = 'color-mix(in srgb, var(--success) 25%, transparent)';
  } else if (variant === 'warning') {
    variantStyle.background = 'color-mix(in srgb, var(--warning) 15%, transparent)';
    variantStyle.color = 'var(--warning-text, var(--warning))';
    variantStyle.borderColor = 'color-mix(in srgb, var(--warning) 25%, transparent)';
  } else if (variant === 'destructive') {
    variantStyle.background = 'color-mix(in srgb, var(--destructive) 15%, transparent)';
    variantStyle.color = 'var(--destructive-text, var(--destructive))';
    variantStyle.borderColor = 'color-mix(in srgb, var(--destructive) 25%, transparent)';
  } else if (variant === 'info') {
    variantStyle.background = 'color-mix(in srgb, var(--info) 15%, transparent)';
    variantStyle.color = 'var(--info-text, var(--info))';
    variantStyle.borderColor = 'color-mix(in srgb, var(--info) 25%, transparent)';
  }

  return (
    <span style={{ ...variantStyle, ...style }} className={`${baseClass} ${className}`}>
      {children}
    </span>
  );
}
