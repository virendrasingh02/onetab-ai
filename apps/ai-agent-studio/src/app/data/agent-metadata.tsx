import { cn } from '@org/utils';
import {
  Bot,
  Brain,
  Code2,
  Cpu,
  Database,
  Flame,
  GitBranch,
  Globe,
  Headphones,
  Layers,
  Lightbulb,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Terminal,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

export const AGENT_ICONS = [
  { id: 'Bot', label: 'Bot', icon: Bot, name: 'Bot' },
  { id: 'Brain', label: 'Brain', icon: Brain, name: 'Brain' },
  { id: 'Sparkles', label: 'Sparkles', icon: Sparkles, name: 'Sparkles' },
  { id: 'Zap', label: 'Lightning', icon: Zap, name: 'Zap' },
  { id: 'Flame', label: 'Flame', icon: Flame, name: 'Flame' },
  { id: 'Shield', label: 'Shield', icon: Shield, name: 'Shield' },
  { id: 'User', label: 'Person', icon: User, name: 'User' },
  { id: 'Cpu', label: 'Processor', icon: Cpu, name: 'Cpu' },
  { id: 'Layers', label: 'Layers', icon: Layers, name: 'Layers' },
  { id: 'Search', label: 'Search', icon: Search, name: 'Search' },
  { id: 'Database', label: 'Database', icon: Database, name: 'Database' },
  { id: 'Globe', label: 'Web', icon: Globe, name: 'Globe' },
  { id: 'MessageSquare', label: 'Chat', icon: MessageSquare, name: 'MessageSquare' },
  { id: 'Terminal', label: 'Terminal', icon: Terminal, name: 'Terminal' },
  { id: 'Wrench', label: 'Tool', icon: Wrench, name: 'Wrench' },
  { id: 'GitBranch', label: 'Workflow', icon: GitBranch, name: 'GitBranch' },
  { id: 'Headphones', label: 'Support', icon: Headphones, name: 'Headphones' },
  { id: 'Code2', label: 'Code', icon: Code2, name: 'Code2' },
  { id: 'Rocket', label: 'Launch', icon: Rocket, name: 'Rocket' },
  { id: 'Lightbulb', label: 'Idea', icon: Lightbulb, name: 'Lightbulb' },
];

export function getAgentIconComponent(iconName?: string) {
  if (!iconName) return Bot;
  const match = AGENT_ICONS.find(
    (item) => item.id.toLowerCase() === iconName.toLowerCase() || item.label.toLowerCase() === iconName.toLowerCase(),
  );
  return match?.icon || Bot;
}

export interface ThemeColorItem {
  id: string;
  label: string;
  bg: string;
  text: string;
  ring: string;
  colorHex: string;
}

const THEME_COLOR_MAP: Record<string, ThemeColorItem> = {
  emerald: { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500/15 text-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/30', colorHex: '#10b981' },
  indigo: { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500/15 text-indigo-500', text: 'text-indigo-500', ring: 'ring-indigo-500/30', colorHex: '#6366f1' },
  purple: { id: 'purple', label: 'Purple', bg: 'bg-purple-500/15 text-purple-500', text: 'text-purple-500', ring: 'ring-purple-500/30', colorHex: '#a855f7' },
  amber: { id: 'amber', label: 'Amber', bg: 'bg-amber-500/15 text-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/30', colorHex: '#f59e0b' },
  cyan: { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500/15 text-cyan-500', text: 'text-cyan-500', ring: 'ring-cyan-500/30', colorHex: '#06b6d4' },
  rose: { id: 'rose', label: 'Rose', bg: 'bg-rose-500/15 text-rose-500', text: 'text-rose-500', ring: 'ring-rose-500/30', colorHex: '#f43f5e' },
  sky: { id: 'sky', label: 'Sky', bg: 'bg-sky-500/15 text-sky-500', text: 'text-sky-500', ring: 'ring-sky-500/30', colorHex: '#0284c7' },
  zinc: { id: 'zinc', label: 'Zinc', bg: 'bg-zinc-500/15 text-zinc-400', text: 'text-zinc-400', ring: 'ring-zinc-500/30', colorHex: '#71717a' },
};

const THEME_COLOR_LIST: ThemeColorItem[] = Object.values(THEME_COLOR_MAP);

/** Iterable as a list, and indexable by theme key. */
export const THEME_COLORS: ThemeColorItem[] & Record<string, ThemeColorItem | undefined> = Object.assign([...THEME_COLOR_LIST], THEME_COLOR_MAP);

export const DEFAULT_CATEGORIES = [
  'Customer Support',
  'Research & Extraction',
  'Sales & CRM',
  'Engineering & DevOps',
  'Finance & Operations',
  'HR & People',
  'Marketing & Content',
  'General',
];

export function AgentAvatar({
  agent,
  icon,
  avatarUrl,
  theme,
  size = 'md',
  className,
}: {
  agent?: any;
  icon?: string;
  avatarUrl?: string | null;
  theme?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const config = agent?.configuration || {};
  const currentIcon = icon || config.icon || 'Bot';
  const currentAvatar = avatarUrl || agent?.avatarUrl || config.avatar || '';
  const currentTheme = theme || config.theme || 'emerald';
  const themeObj = THEME_COLORS[currentTheme] || THEME_COLORS.emerald;

  const sizeClasses = {
    sm: 'size-7 text-xs rounded-lg',
    md: 'size-10 text-sm rounded-xl',
    lg: 'size-12 text-base rounded-xl',
    xl: 'size-16 text-lg rounded-2xl',
  };

  const iconSizes = {
    sm: 'size-3.5',
    md: 'size-5',
    lg: 'size-6',
    xl: 'size-8',
  };

  const IconComp = getAgentIconComponent(currentIcon);

  if (currentAvatar) {
    return (
      <div className={cn('relative overflow-hidden shrink-0 border border-border/60 bg-surface-raised flex items-center justify-center', sizeClasses[size], className)}>
        <img
          src={currentAvatar}
          alt={agent?.name || 'Agent Avatar'}
          className="size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center shrink-0 border border-border/40 font-bold', sizeClasses[size], themeObj.bg, className)}>
      <IconComp className={iconSizes[size]} />
    </div>
  );
}
