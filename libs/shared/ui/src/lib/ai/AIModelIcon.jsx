import React, { memo } from 'react';
import { cn } from '@org/utils';
import { resolveModelIconComponent } from './model-icon-map.js';
import { normalizeModel } from './model-normalizer.js';

const SIZE_PRESETS = {
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
}) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider);
  const IconComponent = resolveModelIconComponent(targetModel, provider, variant);

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
