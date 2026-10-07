import { memo, type CSSProperties, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { resolveProviderIconComponent, type AIIconVariant } from './model-icon-map.js';
import { normalizeProvider } from './model-normalizer.js';

import type { AIIconSize } from './AIModelIcon.js';

const SIZE_PRESETS: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
};

/**
 * AIProviderIcon
 * Renders the official brand icon for an AI Provider (e.g. OpenAI, Anthropic, Google, NVIDIA, Mistral, Ollama)
 * using @lobehub/icons.
 *
 * @param {string} provider - Provider key (e.g. "openai", "anthropic", "google", "nvidia", "deepseek", etc.)
 * @param {'color'|'mono'} [variant='color'] - Color or Mono icon style
 * @param {number|string|'xs'|'sm'|'md'|'lg'|'xl'} [size='sm'] - Icon dimension
 * @param {string} [className] - Optional Tailwind class
 * @param {object} [style] - Optional inline style
 * @param {string} [ariaLabel] - Accessible label
 * @param {boolean} [ariaHidden] - Whether hidden from screen readers
 */
export interface AIProviderIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'style'> {
  provider?: string | null;
  /** Alias of `provider`. */
  providerId?: string | null;
  variant?: AIIconVariant;
  size?: AIIconSize;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaHidden?: boolean;
}

export const AIProviderIcon = memo(function AIProviderIcon({
  provider,
  providerId,
  variant = 'color',
  size = 'sm',
  className,
  style,
  ariaLabel,
  ariaHidden,
  ...props
}: AIProviderIconProps) {
  const targetProvider = provider || providerId;
  const { name } = normalizeProvider(targetProvider);
  const IconComponent = resolveProviderIconComponent(targetProvider, variant);

  const numericSize = typeof size === 'number'
    ? size
    : SIZE_PRESETS[size] || (typeof size === 'string' && !isNaN(Number(size)) ? Number(size) : 16);

  const accessibleName = ariaLabel || `${name} AI Provider`;
  const isDecorative = Boolean(ariaHidden);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center leading-none select-none transition-colors',
        className
      )}
      style={{
        width: numericSize,
        height: numericSize,
        ...style,
      }}
      role={isDecorative ? undefined : 'img'}
      aria-label={isDecorative ? undefined : accessibleName}
      aria-hidden={isDecorative ? true : undefined}
      {...props}
    >
      <IconComponent
        size={numericSize}
        className="size-full shrink-0"
        aria-hidden="true"
      />
    </span>
  );
});

AIProviderIcon.displayName = 'AIProviderIcon';
