import type { CoworkerStatus } from '@org/types';
import {
  AI_ENTITY_PRESET_ICONS,
  AiEntityAvatar,
  getAiEntityGlyph,
  getAiEntityGradient,
  getAiEntityInitial,
  getAiEntityPresetIcon,
} from '@org/ui';
import { cn } from '@org/utils';
import { Loader2 } from 'lucide-react';
import type { FC } from 'react';

export interface CoworkerAvatarProps {
  name: string;
  avatarUrl?: string | null;
  status?: CoworkerStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatusDot?: boolean;
  className?: string;
}

const DOT_OFFSET = {
  xs: '-bottom-0.5 -right-0.5',
  sm: '-bottom-0.5 -right-0.5',
  md: '-bottom-1 -right-1',
  lg: '-bottom-1 -right-1',
  xl: '-bottom-1.5 -right-1.5',
};

/** Re-exports of the shared AI-entity visuals (now owned by `@org/ui`). */
export const COWORKER_PRESET_ICONS = AI_ENTITY_PRESET_ICONS;
export const getCoworkerPresetIcon = getAiEntityPresetIcon;
export const getCoworkerGlyph = getAiEntityGlyph;
export const getEntityInitial = getAiEntityInitial;
export const getGradientByName = getAiEntityGradient;

export const CoworkerAvatar: FC<CoworkerAvatarProps> = ({
  name,
  avatarUrl,
  status,
  size = 'md',
  showStatusDot = true,
  className,
}) => (
  <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
    <AiEntityAvatar
      name={name}
      kind="coworker"
      avatarUrl={avatarUrl}
      size={size}
      className="transition-all duration-150"
    />
    {showStatusDot && (status === 'WORKING' || status === 'RUNNING_TASK') && (
      <span
        role="status"
        aria-label="Working"
        className={cn(
          'absolute z-10 flex items-center justify-center rounded-full bg-background shadow-xs',
          size === 'xs' || size === 'sm' ? 'size-3' : 'size-4',
          DOT_OFFSET[size],
        )}
      >
        <Loader2 className="size-full animate-spin p-px text-primary" />
      </span>
    )}
  </div>
);
