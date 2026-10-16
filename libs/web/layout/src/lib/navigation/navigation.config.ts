import {
  Bookmark,
  Calendar,
  HardDrive,
  Home,
  Inbox,
  MessagesSquare,
  Store,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type NavGroupId = 'workspace' | 'work' | 'ai' | 'operations' | 'more';

export interface NavGroupConfig {
  id: NavGroupId;
  label: string;
  order: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface NavItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string; // Relative to /w/:workspaceSlug/ (empty string = home root)
  visible: boolean;
  order: number;
  group: NavGroupId;
  badge?: string | number | null;
  children?: NavItemConfig[];
  permissions?: string[];
  disabled?: boolean;
  isCore?: boolean;
  description?: string;
  keywords?: string[];
}

export const DEFAULT_NAV_GROUPS: readonly NavGroupConfig[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    order: 0,
    collapsible: false,
    defaultCollapsed: false,
  },
  {
    id: 'work',
    label: 'Work & Projects',
    order: 1,
    collapsible: false,
    defaultCollapsed: false,
  },
  {
    id: 'ai',
    label: 'AI & Automations',
    order: 2,
    collapsible: false,
    defaultCollapsed: false,
  },
  {
    id: 'operations',
    label: 'Tools & Studio',
    order: 3,
    collapsible: true,
    defaultCollapsed: false,
  },
  {
    id: 'more',
    label: 'More Destinations',
    order: 4,
    collapsible: true,
    defaultCollapsed: true,
  },
];

export const DEFAULT_NAV_ITEMS: readonly NavItemConfig[] = [
  // --- Workspace Group ---
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '',
    visible: true,
    order: 0,
    group: 'workspace',
    isCore: true,
    description: 'Workspace main dashboard and quick access',
    keywords: ['home', 'start', 'overview'],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    href: 'inbox',
    visible: true,
    order: 1,
    group: 'workspace',
    isCore: true,
    description: 'Notifications, unread updates and alerts',
    keywords: ['inbox', 'notifications', 'unread', 'alerts'],
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: MessagesSquare,
    href: 'threads',
    visible: true,
    order: 2,
    group: 'workspace',
    isCore: true,
    description: 'All conversations and replies in one place',
    keywords: ['threads', 'chat', 'replies', 'messages'],
  },
  {
    id: 'saved',
    label: 'Saved Items',
    icon: Bookmark,
    href: 'saved',
    visible: true,
    order: 3,
    group: 'workspace',
    description: 'Bookmarked messages and links',
    keywords: ['saved', 'bookmarks', 'favorites', 'stars'],
  },
  {
    id: 'directory',
    label: 'Team Directory',
    icon: Users,
    href: 'directory',
    visible: true,
    order: 4,
    group: 'workspace',
    description: 'Workspace members, roles, and presence',
    keywords: ['members', 'directory', 'people', 'team', 'users'],
  },

  // --- Work Group ---
  {
    id: 'meetings',
    label: 'Meetings',
    icon: Video,
    href: 'meetings',
    visible: true,
    order: 3,
    group: 'work',
    description: 'Video calls, huddles and recorded meetings',
    keywords: ['meetings', 'calls', 'video', 'huddles'],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: Calendar,
    href: 'schedule',
    visible: true,
    order: 4,
    group: 'work',
    description: 'Scheduled messages, events, and timeline',
    keywords: ['schedule', 'calendar', 'events', 'timeline', 'messages'],
  },
  {
    id: 'files',
    label: 'Files',
    icon: HardDrive,
    href: 'files',
    visible: true,
    order: 6,
    group: 'work',
    description: 'Uploaded attachments, media, PDFs and documents',
    keywords: ['files', 'drive', 'storage', 'attachments', 'media'],
  },

  // --- AI Group ---
  {
    id: 'automations',
    label: 'Automation Center',
    icon: Zap,
    href: 'automations',
    visible: true,
    order: 2,
    group: 'ai',
    description: 'Unified automation center for event-driven, AI-powered and scheduled workflows',
    keywords: [
      'automations',
      'workflows',
      'cron',
      'triggers',
      'actions',
      'webhooks',
      'schedules',
      'approvals',
      'runs',
      'templates',
    ],
  },

  // --- Operations / Tools Group ---
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: Store,
    href: 'marketplace',
    visible: true,
    order: 5,
    group: 'workspace',
    description: 'Discover and install apps and agents, and connect integrations',
    keywords: ['marketplace', 'apps', 'agents', 'directory', 'install', 'integrations', 'integration hub', 'github', 'slack', 'gmail'],
  },
];
