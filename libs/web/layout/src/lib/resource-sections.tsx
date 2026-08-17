import { Button, Hint, IconRenderer } from '@org/ui';
import { useAgents } from '@org/web-agents';
import { useWorkflows } from '@org/web-automations';
import { useIntegrations } from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Plus } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  Section,
} from './nav-primitives.js';

/** The display shape these sidebar rows need, whatever the source row looks like. */
interface RegistryItem {
  id: string;
  name: string;
  /** Lucide icon name, resolved through `IconRenderer`. */
  icon?: string;
  /** Secondary line: an agent's role, an app's category, a workflow's trigger. */
  detail?: string;
}

/**
 * Icon per provider.
 *
 * Names must exist in `ICON_REGISTRY` (`@org/ui`) — an unknown name renders as
 * literal text rather than an icon.
 */
const PROVIDER_ICON: Record<string, string> = {
  GITHUB: 'Code',
  JIRA: 'Code',
  GDRIVE: 'HardDrive',
  GOOGLE_DRIVE: 'HardDrive',
  SLACK: 'FileText',
  NOTION: 'FileText',
  WEBHOOKS: 'Plug',
};

const TRIGGER_ICON: Record<string, string> = {
  WEBHOOK: 'Plug',
  CRON: 'Clock',
  EVENT: 'Zap',
};

/** `GOOGLE_DRIVE` -> `Google Drive`. */
function titleCaseProvider(provider: string): string {
  return provider
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * A sidebar section listing what the workspace actually uses — the deployed
 * agents, the connected apps, the saved workflows — with the way to add another
 * at the bottom.
 *
 * These three sections used to be static link lists ("Agent Directory", "Agent
 * Studio", "Agent Logs" and so on). That put the builder and the run logs a
 * permanent click away in the sidebar while the things people actually work
 * with were invisible. The builder is still reachable — it is what "Add agent"
 * opens — and the logs live on their pages.
 */
function ResourceSection({
  title,
  items,
  basePath,
  queryKey,
  addPath,
  addLabel,
  fallbackEmoji,
  emptyLabel,
}: {
  title: string;
  items: readonly RegistryItem[];
  /** Workspace-relative path of the directory page these rows open. */
  basePath: string;
  /** Search param that identifies a row on that page. */
  queryKey: string;
  /** Workspace-relative path that creates/adds a new one. */
  addPath: string;
  addLabel: string;
  fallbackEmoji: string;
  emptyLabel: string;
}) {
  const location = useLocation();

  return (
    <Section
      title={title}
      count={items.length}
      emptyLabel={emptyLabel}
      action={
        <Hint label={addLabel}>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label={addLabel}
            className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={addPath}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {items.map((item) => {
        const isSelected =
          location.pathname.endsWith(basePath) &&
          location.search.includes(`${queryKey}=${item.id}`);

        return (
          <li key={item.id}>
            <NavLink
              to={`${basePath}?${queryKey}=${item.id}`}
              className={navRowClass(isSelected, { depth: 1 })}
              title={item.detail ? `${item.name} — ${item.detail}` : item.name}
            >
              <IconRenderer
                icon={item.icon}
                fallbackEmoji={fallbackEmoji}
                sizeClassName={navIconClass(1)}
              />
              <span className="flex-1 truncate">{item.name}</span>
            </NavLink>
          </li>
        );
      })}

      <li>
        <NavLink to={addPath} className={navActionClass({ depth: 1 })}>
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">{addLabel}</span>
        </NavLink>
      </li>
    </Section>
  );
}

export function AgentsSection({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);

  const items: RegistryItem[] = (agents.data ?? []).map((agent) => ({
    id: agent.id,
    name: agent.name,
    icon: 'Bot',
    detail: agent.role,
  }));

  return (
    <ResourceSection
      title="AI Agents"
      items={items}
      basePath={`/w/${workspaceSlug}/agents`}
      queryKey="agent"
      addPath={`/w/${workspaceSlug}/agents?tab=all`}
      addLabel="Add agent"
      fallbackEmoji="🤖"
      emptyLabel="No agents deployed yet."
    />
  );
}

export function AppsSection({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const integrations = useIntegrations(workspaceId);

  // A disconnected row is history, not something the sidebar should offer.
  const items: RegistryItem[] = (integrations.data ?? [])
    .filter((integration) => integration.status === 'CONNECTED')
    .map((integration) => ({
      id: integration.provider,
      name: titleCaseProvider(integration.provider),
      icon: PROVIDER_ICON[integration.provider] ?? 'Plug',
      detail: 'Connected',
    }));

  return (
    <ResourceSection
      title="Apps"
      items={items}
      basePath={`/w/${workspaceSlug}/integrations`}
      queryKey="app"
      addPath={`/w/${workspaceSlug}/integrations`}
      addLabel="Add app"
      fallbackEmoji="🧩"
      emptyLabel="No apps connected yet."
    />
  );
}

export function WorkflowsSection({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const workflows = useWorkflows(workspaceId);

  const items: RegistryItem[] = (workflows.data ?? []).map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    icon: TRIGGER_ICON[workflow.triggerType] ?? 'Zap',
    detail: workflow.triggerType,
  }));

  return (
    <ResourceSection
      title="Automations"
      items={items}
      basePath={`/w/${workspaceSlug}/automations`}
      queryKey="workflow"
      addPath={`/w/${workspaceSlug}/automations?tab=all`}
      addLabel="Add workflow"
      fallbackEmoji="⚡"
      emptyLabel="No workflows yet."
    />
  );
}
