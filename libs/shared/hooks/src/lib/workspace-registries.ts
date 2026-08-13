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

/**
 * A registry starts empty: a workspace owns nothing until someone deploys,
 * connects or saves it here.
 */
function read<T extends RegistryItem>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Read on mount, re-read when this tab or another tab writes, and persist +
 * broadcast through the returned setter.
 */
function useRegistry<T extends RegistryItem>(key: string, event: string) {
  const [items, setItems] = useState<T[]>(() => read<T>(key));

  useEffect(() => {
    const sync = () => setItems(read<T>(key));
    window.addEventListener(event, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(event, sync);
      window.removeEventListener('storage', sync);
    };
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
  return useRegistry<RegistryItem>(AGENTS_KEY, AGENTS_EVENT);
}

/** Apps and integrations that have been connected. */
export function useConnectedApps() {
  return useRegistry<RegistryItem>(APPS_KEY, APPS_EVENT);
}

/** Workflows saved in this workspace. */
export function useWorkflows() {
  return useRegistry<WorkflowRegistryItem>(WORKFLOWS_KEY, WORKFLOWS_EVENT);
}
