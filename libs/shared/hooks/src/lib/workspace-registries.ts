import { useCallback, useEffect, useState } from 'react';

/*
 * "What this workspace actually uses" — the installed agents, the connected
 * apps and the saved workflows.
 *
 * Two sides read these. The directory pages (`AgentMarketplaceView`,
 * `IntegrationHubView`, `WorkflowListView`) own the full catalogue and the
 * install/connect actions; the sidebar lists what came out of them. Keeping the
 * registries here means deploying an agent shows up in the sidebar without
 * either side importing the other.
 *
 * Local storage stands in for endpoints that do not exist yet — the same
 * stopgap the project and doc trees use.
 */

export interface RegistryItem {
  id: string;
  name: string;
  /** Lucide icon name, resolved through `IconRenderer` at the call site. */
  icon?: string;
  /** Secondary line: an agent's role, an app's category, a workflow's trigger. */
  detail?: string;
}

export interface WorkflowRegistryItem extends RegistryItem {
  triggerType: 'WEBHOOK' | 'CRON' | 'EVENT';
  isActive: boolean;
  totalExecutions: number;
  lastRun: string;
}

const AGENTS_KEY = 'onetab_installed_agents_v1';
const AGENTS_EVENT = 'onetab_agents_updated';
const APPS_KEY = 'onetab_connected_apps_v1';
const APPS_EVENT = 'onetab_apps_updated';
const WORKFLOWS_KEY = 'onetab_workflows_v1';
const WORKFLOWS_EVENT = 'onetab_workflows_updated';

const SEED_AGENTS: RegistryItem[] = [
  { id: '1', name: 'Agile sprint manager', icon: 'Bot', detail: 'Scrum master' },
  { id: '3', name: 'Workspace knowledge curator', icon: 'Bot', detail: 'Docs architect' },
];

/* Icon names must exist in `ICON_REGISTRY` (`@org/ui`) — an unknown name is
   rendered as literal text, not an icon. `Share2` and `Webhook` are not in it,
   hence the near-equivalents below. These mirror `CATEGORY_ICON` in
   `IntegrationHubView`, so a seeded row and a freshly connected one match. */
const SEED_APPS: RegistryItem[] = [
  { id: 'github', name: 'GitHub', icon: 'Code', detail: 'Dev Tools' },
  { id: 'jira', name: 'Jira', icon: 'Code', detail: 'Dev Tools' },
  { id: 'gdrive', name: 'Google Drive', icon: 'HardDrive', detail: 'Storage' },
  { id: 'slack', name: 'Slack Import', icon: 'FileText', detail: 'Importer' },
  { id: 'notion', name: 'Notion Import', icon: 'FileText', detail: 'Importer' },
  { id: 'webhooks', name: 'Webhooks Hub', icon: 'Plug', detail: 'API' },
];

const SEED_WORKFLOWS: WorkflowRegistryItem[] = [
  {
    id: 'wf_1',
    name: 'GitHub webhook → AI code review → Matrix alert',
    icon: 'Plug',
    detail: 'Webhook',
    triggerType: 'WEBHOOK',
    isActive: true,
    totalExecutions: 42,
    lastRun: '12 mins ago',
  },
  {
    id: 'wf_2',
    name: 'Daily standup summary generator',
    icon: 'Clock',
    detail: 'Cron',
    triggerType: 'CRON',
    isActive: true,
    totalExecutions: 15,
    lastRun: '4 hours ago',
  },
  {
    id: 'wf_3',
    name: 'Overdue task escalation bot',
    icon: 'Zap',
    detail: 'Event',
    triggerType: 'EVENT',
    isActive: false,
    totalExecutions: 8,
    lastRun: '1 day ago',
  },
];

function read<T extends RegistryItem>(key: string, seed: T[]): T[] {
  if (typeof window === 'undefined') return seed;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return seed;
    const parsed: unknown = JSON.parse(raw);
    /* An empty array is a real state here — you can disconnect every app —
       so unlike the seeded project list it must not fall back to the seed. */
    return Array.isArray(parsed) ? (parsed as T[]) : seed;
  } catch {
    return seed;
  }
}

/**
 * Read on mount, re-read when this tab or another tab writes, and persist +
 * broadcast through the returned setter.
 */
function useRegistry<T extends RegistryItem>(key: string, event: string, seed: T[]) {
  const [items, setItems] = useState<T[]>(() => read(key, seed));

  useEffect(() => {
    const sync = () => setItems(read(key, seed));
    window.addEventListener(event, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(event, sync);
      window.removeEventListener('storage', sync);
    };
    // `seed` is a module constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, event]);

  const save = useCallback(
    (next: T[]) => {
      setItems(next);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(event));
      } catch {
        /* Quota or private mode. */
      }
    },
    [key, event],
  );

  return [items, save] as const;
}

/**
 * Add `item` if it is absent, remove it if it is present.
 *
 * Additions go on the end so the list does not reshuffle under the cursor when
 * a row is toggled twice.
 */
export function toggleRegistryItem<T extends RegistryItem>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.filter((existing) => existing.id !== item.id)
    : [...items, item];
}

/** Agents deployed into the workspace. */
export function useInstalledAgents() {
  return useRegistry(AGENTS_KEY, AGENTS_EVENT, SEED_AGENTS);
}

/** Apps and integrations that have been connected. */
export function useConnectedApps() {
  return useRegistry(APPS_KEY, APPS_EVENT, SEED_APPS);
}

/** Workflows saved in this workspace. */
export function useWorkflows() {
  return useRegistry(WORKFLOWS_KEY, WORKFLOWS_EVENT, SEED_WORKFLOWS);
}
