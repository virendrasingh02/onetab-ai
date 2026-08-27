import {
  Activity,
  Bookmark,
  Bot,
  Calendar,
  CheckSquare,
  FileText,
  HardDrive,
  Home,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Network,
  PenTool,
  Plug,
  Sparkles,
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
    collapsible: true,
    defaultCollapsed: false,
  },
  {
    id: 'ai',
    label: 'AI & Automations',
    order: 2,
    collapsible: true,
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
    id: 'tasks',
    label: 'Tasks & Projects',
    icon: CheckSquare,
    href: 'tasks',
    visible: true,
    order: 0,
    group: 'work',
    description: 'Kanban boards, project lists, initiatives and cycles',
    keywords: ['tasks', 'kanban', 'projects', 'boards', 'work', 'cycles'],
  },
  {
    id: 'docs',
    label: 'Docs & Notes',
    icon: FileText,
    href: 'docs',
    visible: true,
    order: 1,
    group: 'work',
    description: 'Collaborative documents, wikis and company notes',
    keywords: ['docs', 'documents', 'notes', 'editor', 'wiki'],
  },
  {
    id: 'whiteboards',
    label: 'Whiteboards',
    icon: PenTool,
    href: 'whiteboards',
    visible: true,
    order: 2,
    group: 'work',
    description: 'Visual canvases and brainstorming diagrams',
    keywords: ['whiteboard', 'canvas', 'diagram', 'draw'],
  },
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
    label: 'Schedule & Calendar',
    icon: Calendar,
    href: 'schedule',
    visible: true,
    order: 4,
    group: 'work',
    description: 'Team events, milestones and time management',
    keywords: ['schedule', 'calendar', 'events', 'timeline'],
  },
  {
    id: 'pulse',
    label: 'Activity Pulse',
    icon: Activity,
    href: 'pulse',
    visible: true,
    order: 5,
    group: 'work',
    description: 'Live timeline of workspace actions and changes',
    keywords: ['pulse', 'activity', 'timeline', 'updates'],
  },
  {
    id: 'files',
    label: 'File Manager',
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
    id: 'ai-chat',
    label: 'AI Assistant',
    icon: Sparkles,
    href: 'ai-chat',
    visible: true,
    order: 0,
    group: 'ai',
    description: 'Intelligent copilot with citations and memory',
    keywords: ['ai', 'copilot', 'assistant', 'chat', 'llm'],
  },
  {
    id: 'ai-prompts',
    label: 'Prompt Library',
    icon: Sparkles,
    href: 'ai/prompts',
    visible: true,
    order: 1,
    group: 'ai',
    description: 'Curated reusable AI system prompts and templates',
    keywords: ['prompts', 'library', 'templates', 'ai'],
  },
  {
    id: 'ai-images',
    label: 'AI Image Generator',
    icon: Sparkles,
    href: 'ai/images',
    visible: true,
    order: 2,
    group: 'ai',
    description: 'Generative AI visual asset creation',
    keywords: ['images', 'generator', 'ai', 'art'],
  },
  {
    id: 'agents',
    label: 'AI Agents',
    icon: Bot,
    href: 'agents',
    visible: true,
    order: 3,
    group: 'ai',
    description: 'Autonomous multi-step agents and marketplace',
    keywords: ['agents', 'marketplace', 'bots', 'builder'],
  },
  {
    id: 'automations',
    label: 'Automations & Workflows',
    icon: Zap,
    href: 'automations',
    visible: true,
    order: 4,
    group: 'ai',
    description: 'Node-based visual workflows, webhooks and cron jobs',
    keywords: ['automations', 'workflows', 'triggers', 'actions', 'builder'],
  },

  // --- Operations / Tools Group ---
  {
    id: 'integrations',
    label: 'Integration Hub',
    icon: Plug,
    href: 'integrations',
    visible: true,
    order: 0,
    group: 'operations',
    description: 'GitHub, Jira, Slack, Notion, Google Drive integrations',
    keywords: ['integrations', 'github', 'jira', 'slack', 'notion', 'apps'],
  },
  {
    id: 'cards',
    label: 'Card Builder',
    icon: Network,
    href: 'cards',
    visible: true,
    order: 1,
    group: 'operations',
    description: 'Universal dynamic cards and schema registry',
    keywords: ['cards', 'builder', 'registry', 'blocks'],
  },
  {
    id: 'design-system',
    label: 'Design System Studio',
    icon: LayoutDashboard,
    href: 'design-system',
    visible: true,
    order: 2,
    group: 'operations',
    description: 'Component explorer, theme tokens and live palette preview',
    keywords: ['design', 'tokens', 'studio', 'components', 'theme'],
  },
];
