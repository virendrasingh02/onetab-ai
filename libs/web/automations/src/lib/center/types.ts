import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  Cpu,
  History,
  LayoutGrid,
  ListOrdered,
  Plug,
  Settings,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react';

export type AutomationCenterTab =
  | 'overview'
  | 'workflows'
  | 'builder'
  | 'templates'
  | 'triggers'
  | 'actions'
  | 'connections'
  | 'ai'
  | 'schedules'
  | 'approvals'
  | 'history'
  | 'runs'
  | 'analytics'
  | 'errors'
  | 'settings';

export interface AutomationTabConfig {
  id: AutomationCenterTab;
  label: string;
  icon: LucideIcon;
  description: string;
  badge?: number;
}

export const AUTOMATION_CENTER_TABS: readonly AutomationTabConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, description: 'Executive dashboard, metrics & health' },
  { id: 'workflows', label: 'My Automations', icon: Workflow, description: 'Manage and trigger workspace workflows' },
  { id: 'builder', label: 'Workflow Builder', icon: Cpu, description: 'Visual drag-and-drop canvas editor' },
  { id: 'templates', label: 'Templates', icon: ListOrdered, description: 'Ready-to-run automation recipes' },
  { id: 'triggers', label: 'Triggers', icon: Zap, description: 'Events, schedules, webhooks & manual triggers' },
  { id: 'actions', label: 'Actions', icon: CheckCircle2, description: 'Tools, app actions, transforms & code runner' },
  { id: 'connections', label: 'App Connections', icon: Plug, description: 'Connected apps and integration health' },
  { id: 'ai', label: 'AI Automations', icon: Bot, description: 'Agent delegations, prompts & classifiers' },
  { id: 'schedules', label: 'Scheduled Automations', icon: Calendar, description: 'Cron timetables and upcoming runs' },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck, description: 'Pending human approvals & review history' },
  { id: 'history', label: 'Execution History', icon: History, description: 'Audit trail across all workflows' },
  { id: 'runs', label: 'Runs and Logs', icon: Activity, description: 'Detailed run timelines and step outputs' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Execution volume, latency & ROI metrics' },
  { id: 'errors', label: 'Error Monitoring', icon: AlertTriangle, description: 'Classified failures, alerts & retries' },
  { id: 'settings', label: 'Automation Settings', icon: Settings, description: 'Quotas, concurrency, retention & secrets' },
];

export function automationPath(slug: string | undefined, tab?: AutomationCenterTab, subId?: string): string {
  const base = `/w/${slug ?? ''}/automations`;
  if (!tab || tab === 'overview') return base;
  if (subId) return `${base}/${tab}/${subId}`;
  return `${base}/${tab}`;
}
