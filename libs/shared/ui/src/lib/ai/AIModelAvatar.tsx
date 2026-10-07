import { memo, type CSSProperties, type HTMLAttributes } from 'react';
import { cn } from '@org/utils';
import { AIModelIcon } from './AIModelIcon.js';
import type { AIIconVariant } from './model-icon-map.js';
import { normalizeModel, type ModelInput } from './model-normalizer.js';

export type AIModelAvatarSize = 'inline' | 'compact' | 'standard' | 'list' | 'card' | 'hero';
export type AIModelAvatarShape = 'circle' | 'rounded' | 'square';

const AVATAR_SIZES: Record<AIModelAvatarSize, { container: number; icon: number }> = {
  inline: { container: 16, icon: 10 },
  compact: { container: 20, icon: 12 },
  standard: { container: 24, icon: 14 },
  list: { container: 28, icon: 16 },
  card: { container: 32, icon: 18 },
  hero: { container: 40, icon: 22 },
};

const SHAPES: Record<AIModelAvatarShape, string> = {
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
export interface AIModelAvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  modelId?: ModelInput;
  model?: ModelInput;
  provider?: string | null;
  size?: AIModelAvatarSize;
  shape?: AIModelAvatarShape;
  variant?: AIIconVariant;
  style?: CSSProperties;
}

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
}: AIModelAvatarProps) {
  const targetModel = modelId || model;
  const meta = normalizeModel(targetModel, provider ?? null);
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
