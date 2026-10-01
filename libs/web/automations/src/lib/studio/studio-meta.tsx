import type { AgentKind, AgentStepKind, StudioAgentState } from '@org/types';
import { Badge, type BadgeProps } from '@org/ui';
import {
  Activity,
  AlarmClock,
  Bell,
  Bot,
  Brain,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Database,
  FileText,
  FolderKanban,
  GitBranch,
  Globe,
  Hammer,
  ListTodo,
  Mail,
  MailCheck,
  Map,
  MessageSquare,
  MessageSquareReply,
  MessageSquareWarning,
  Network,
  NotebookPen,
  PenLine,
  Play,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const KIND_ICON: Record<AgentKind | 'workflow', LucideIcon> = {
  assistant: Bot,
  task: CheckSquare,
  workflow: Workflow,
  research: Search,
  automation: Zap,
  monitoring: Radar,
  project: FolderKanban,
  personal: User,
  team: Users,
  coworker: UserCheck,
  builder: Hammer,
  supervisor: Network,
};

export const STEP_KIND_ICON: Record<AgentStepKind, LucideIcon> = {
  collect: Database,
  analyze: Brain,
  generate: Sparkles,
  action: Play,
  approval: ShieldCheck,
  notify: Bell,
  condition: GitBranch,
  delegate: Bot,
};

/** Tool groups in the picker, by the part of the platform they touch. */
export const APP_META: Record<string, { label: string; icon: LucideIcon }> = {
  tasks: { label: 'Tasks', icon: CheckSquare },
  projects: { label: 'Projects', icon: FolderKanban },
  docs: { label: 'Docs', icon: FileText },
  meetings: { label: 'Meetings & calendar', icon: CalendarDays },
  activity: { label: 'Activity', icon: Activity },
  chat: { label: 'Chat', icon: MessageSquare },
  notifications: { label: 'Notifications', icon: Bell },
  memory: { label: 'Memory', icon: Brain },
  web: { label: 'Web', icon: Globe },
  email: { label: 'Email', icon: Mail },
};

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  ListTodo,
  FileText,
  NotebookPen,
  Activity,
  MailCheck,
  Search,
  MessageSquareReply,
  CalendarRange,
  PenLine,
  Map,
  AlarmClock,
  CalendarCheck,
  MessageSquareWarning,
};

export function templateIcon(name: string): LucideIcon {
  return TEMPLATE_ICONS[name] ?? Sparkles;
}

export function toolIcon(app: string | undefined): LucideIcon {
  return (app && APP_META[app]?.icon) || Wrench;
}

const STATE: Record<StudioAgentState, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  active: { label: 'On', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  archived: { label: 'Archived', variant: 'neutral' },
};

export function AgentStateBadge({ state, className }: { state: StudioAgentState; className?: string }) {
  const s = STATE[state];
  return (
    <Badge variant={s.variant} className={className ?? 'text-[10px]'}>
      {s.label}
    </Badge>
  );
}

/** "in 3 hours", "tomorrow at 6:00 PM" — for next runs. */
export function formatUpcoming(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  const now = new Date();
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (minutes < 1) return 'any moment';
  if (minutes < 60) return `in ${minutes} min`;
  const sameDay = at.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86_400_000).toDateString() === at.toDateString();
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  if (tomorrow) return `tomorrow at ${time}`;
  return at.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Morning, afternoon or evening, for the Home greeting. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
