import type { CoworkerStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  Bot,
  Brain,
  Code2,
  Globe,
  Layers,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { FC } from 'react';
import { CoworkerStatusDot } from './CoworkerStatusDot.js';

export interface CoworkerAvatarProps {
  name: string;
  avatarUrl?: string | null;
  status?: CoworkerStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatusDot?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: {
    container: 'h-6 w-6 text-[10px] rounded-md',
    icon: 'h-3.5 w-3.5',
    dotSize: 'xs' as const,
    dotOffset: '-bottom-0.5 -right-0.5',
  },
  sm: {
    container: 'h-8 w-8 text-xs rounded-lg',
    icon: 'h-4 w-4',
    dotSize: 'xs' as const,
    dotOffset: '-bottom-0.5 -right-0.5',
  },
  md: {
    container: 'h-10 w-10 text-sm rounded-xl',
    icon: 'h-5 w-5',
    dotSize: 'sm' as const,
    dotOffset: '-bottom-1 -right-1',
  },
  lg: {
    container: 'h-12 w-12 text-base rounded-xl',
    icon: 'h-6 w-6',
    dotSize: 'md' as const,
    dotOffset: '-bottom-1 -right-1',
  },
  xl: {
    container: 'h-16 w-16 text-xl rounded-2xl',
    icon: 'h-8 w-8',
    dotSize: 'lg' as const,
    dotOffset: '-bottom-1.5 -right-1.5',
  },
};

const PRESET_ICONS: Record<string, typeof Bot> = {
  'icon:bot': Bot,
  'icon:brain': Brain,
  'icon:code': Code2,
  'icon:spark': Sparkles,
  'icon:shield': Shield,
  'icon:search': Search,
  'icon:chat': MessageSquare,
  'icon:rocket': Rocket,
  'icon:globe': Globe,
  'icon:layers': Layers,
  'icon:zap': Zap,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || 'AI').toUpperCase();
}

/** Deterministic gradient based on coworker name string */
function getGradientByName(name: string): string {
  const gradients = [
    'from-violet-500/20 to-purple-600/20 text-violet-600 dark:text-violet-300 border-violet-500/30',
    'from-indigo-500/20 to-blue-600/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
    'from-teal-500/20 to-emerald-600/20 text-teal-600 dark:text-teal-300 border-teal-500/30',
    'from-amber-500/20 to-orange-600/20 text-amber-600 dark:text-amber-300 border-amber-500/30',
    'from-rose-500/20 to-pink-600/20 text-rose-600 dark:text-rose-300 border-rose-500/30',
    'from-cyan-500/20 to-sky-600/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export const CoworkerAvatar: FC<CoworkerAvatarProps> = ({
  name,
  avatarUrl,
  status,
  size = 'md',
  showStatusDot = true,
  className,
}) => {
  const sizeConfig = SIZE_MAP[size] ?? SIZE_MAP.md;
  const gradientClass = getGradientByName(name);

  const isPresetIcon = avatarUrl?.startsWith('icon:') && PRESET_ICONS[avatarUrl];
  const PresetComponent = isPresetIcon ? PRESET_ICONS[avatarUrl as string] : null;

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      <div
        className={cn(
          'flex items-center justify-center font-semibold border shadow-xs overflow-hidden transition-all duration-150',
          'bg-gradient-to-br',
          sizeConfig.container,
          gradientClass,
        )}
      >
        {avatarUrl && !isPresetIcon ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Graceful fallback to initials if image fails
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : PresetComponent ? (
          <PresetComponent className={sizeConfig.icon} />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {showStatusDot && status && (
        <span className={cn('absolute z-10', sizeConfig.dotOffset)}>
          <CoworkerStatusDot status={status} size={sizeConfig.dotSize} />
        </span>
      )}
    </div>
  );
};
