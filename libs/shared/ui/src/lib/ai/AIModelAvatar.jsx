import React, { memo } from 'react';
import { cn } from '@org/utils';
import { AIModelIcon } from './AIModelIcon.jsx';
import { normalizeModel } from './model-normalizer.js';

const AVATAR_SIZES = {
  inline: { container: 16, icon: 10 },
  compact: { container: 20, icon: 12 },
  standard: { container: 24, icon: 14 },
  list: { container: 28, icon: 16 },
  card: { container: 32, icon: 18 },
  hero: { container: 40, icon: 22 },
};

const SHAPES = {
  circle: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded-md',
};

/**
 * AIModelAvatar
 * Displays an AI Model in avatar format with dedicated container and border contrast.
 * Compatible with dark and light themes.
 *
 * @param {string} modelId - Model ID string
 * @param {string} [provider] - Optional provider hint
 * @param {'inline'|'compact'|'standard'|'list'|'card'|'hero'} [size='standard'] - Scale preset
 * @param {'circle'|'rounded'|'square'} [shape='circle'] - Avatar shape
 * @param {'color'|'mono'} [variant='color'] - Color vs Mono
 * @param {string} [className] - Optional container classes
 */
export const AIModelAvatar = memo(function AIModelAvatar({
  modelId,
  model,
  provider,
  size = 'standard',
  shape = 'circle',
  variant = 'color',
  className,
  style,
  ...props
}) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider);
  const sizeConfig = AVATAR_SIZES[size] || AVATAR_SIZES.standard;
  const shapeClass = SHAPES[shape] || SHAPES.circle;

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center bg-surface-raised border border-border/80 shadow-2xs select-none transition-transform overflow-hidden',
        shapeClass,
        className
      )}
      style={{
        width: sizeConfig.container,
        height: sizeConfig.container,
        ...style,
      }}
      title={`${meta.displayName} (${meta.providerName})`}
      {...props}
    >
      <AIModelIcon
        modelId={meta.canonicalId}
        provider={meta.providerId}
        variant={variant}
        size={sizeConfig.icon}
        ariaHidden
      />
    </div>
  );
});

AIModelAvatar.displayName = 'AIModelAvatar';
