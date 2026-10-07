import { memo, type CSSProperties, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { resolveModelIconComponent, type AIIconVariant } from './model-icon-map.js';
import { normalizeModel, type ModelInput } from './model-normalizer.js';

export type AIIconSize = number | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | (string & {});

const SIZE_PRESETS: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
};

/**
 * AIModelIcon
 * Renders the official brand icon for an AI Model (e.g. GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash)
 * using @lobehub/icons with guaranteed fallback to provider or generic AI icon.
 *
 * @param {string|object} modelId - Model ID string (or object)
 * @param {string} [provider] - Optional provider hint
 * @param {'color'|'mono'} [variant='color'] - Color or Mono icon style
 * @param {number|string|'xs'|'sm'|'md'|'lg'|'xl'} [size='sm'] - Icon dimension
 * @param {string} [className] - Optional Tailwind class
 * @param {object} [style] - Optional inline style
 * @param {string} [ariaLabel] - Accessible label (defaults to model name)
 * @param {boolean} [ariaHidden] - Whether hidden from screen readers
 */
export interface AIModelIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'style'> {
  modelId?: ModelInput;
  /** Alias of `modelId`. */
  model?: ModelInput;
  provider?: string | null;
  variant?: AIIconVariant;
  size?: AIIconSize;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaHidden?: boolean;
}

export const AIModelIcon = memo(function AIModelIcon({
  modelId,
  model,
  provider,
  variant = 'color',
  size = 'sm',
  className,
  style,
  ariaLabel,
  ariaHidden,
  ...props
}: AIModelIconProps) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider ?? null);
  const IconComponent = resolveModelIconComponent(targetModel, provider ?? null, variant);

  const numericSize = typeof size === 'number'
    ? size
    : SIZE_PRESETS[size] || (typeof size === 'string' && !isNaN(Number(size)) ? Number(size) : 16);

  const accessibleName = ariaLabel || `${meta.displayName} by ${meta.providerName}`;
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

AIModelIcon.displayName = 'AIModelIcon';
