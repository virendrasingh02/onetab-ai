import {
  useConnectedApps,
  useInstalledAgents,
  useWorkflows,
  type RegistryItem,
} from '@org/hooks';
import { Button, Hint, IconRenderer } from '@org/ui';
import { Plus } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  Section,
} from './nav-primitives.js';

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
  const [agents] = useInstalledAgents();

  return (
    <ResourceSection
      title="AI Agents"
      items={agents}
      basePath={`/w/${workspaceSlug}/agents`}
      queryKey="agent"
      addPath={`/w/${workspaceSlug}/agents/builder`}
      addLabel="Add agent"
      fallbackEmoji="🤖"
      emptyLabel="No agents deployed yet."
    />
  );
}

export function AppsSection({ workspaceSlug }: { workspaceSlug: string }) {
  const [apps] = useConnectedApps();

  return (
    <ResourceSection
      title="Apps"
      items={apps}
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
  const [workflows] = useWorkflows();

  return (
    <ResourceSection
      title="Automations"
      items={workflows}
      basePath={`/w/${workspaceSlug}/automations`}
      queryKey="workflow"
      addPath={`/w/${workspaceSlug}/automations/builder`}
      addLabel="Add workflow"
      fallbackEmoji="⚡"
      emptyLabel="No workflows yet."
    />
  );
}
