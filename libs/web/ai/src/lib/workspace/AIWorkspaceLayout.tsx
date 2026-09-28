import { approvalsApi, queryKeys } from '@org/api-client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Page,
  PageHeader,
  ResponsiveTabsList,
  Tabs,
  TabsTrigger,
} from '@org/ui';
import { useCreationPolicies, useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, Plus, Sparkles, UserCheck, Workflow } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AI_WORKSPACE_SECTIONS,
  aiWorkspacePath,
  sectionFromPath,
  type AIWorkspaceSection,
} from './ai-workspace-routes.js';

/**
 * The AI Workspace's frame: one heading, one "New" menu and a tab per
 * section, with the section rendered below. Editors (an agent's canvas, a
 * workflow's canvas) are sibling routes outside this frame so they get the
 * whole viewport.
 */
export function AIWorkspaceLayout() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.approvals.list(workspaceId ?? '', 'PENDING'),
    queryFn: () => approvalsApi.list(workspaceId as string, 'PENDING'),
    enabled: Boolean(workspaceId),
    refetchInterval: 60_000,
  });
  const mine = pending.filter((a) => a.canDecide).length;

  return (
    <Page>
      <PageHeader
        title="AI Workspace"
        description="Build agents and workflows, test them, and see everything they do."
        icon={<Sparkles />}
        accent="violet"
        actions={<NewAIResourceMenu slug={slug} workspaceId={workspaceId} />}
        toolbar={
          <Tabs
            value={section}
            onValueChange={(next) =>
              navigate(aiWorkspacePath(slug, next === 'overview' ? '' : (next as AIWorkspaceSection)))
            }
          >
            <ResponsiveTabsList variant="underline" aria-label="AI Workspace sections">
              {AI_WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                  {id === 'approvals' && mine > 0 ? (
                    <span
                      className="ml-1 rounded-full bg-warning/15 px-1.5 text-[10px] font-semibold tabular-nums text-warning"
                      aria-label={`${mine} waiting for you`}
                    >
                      {mine}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </ResponsiveTabsList>
          </Tabs>
        }
      />
      <Outlet />
    </Page>
  );
}

/** Create an agent, a coworker or a workflow — the three things you build here. */
export function NewAIResourceMenu({
  slug,
  workspaceId,
}: {
  slug: string | undefined;
  workspaceId: string | undefined;
}) {
  const navigate = useNavigate();
  const { can } = useWorkspacePermission();
  const { canCreateAgents, canCreateCoworkers } = useCreationPolicies(workspaceId);
  if (!can('create')) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button leadingIcon={<Plus />} trailingIcon={<ChevronDown />}>
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          disabled={!canCreateAgents}
          onSelect={() => navigate(aiWorkspacePath(slug, 'agents', 'new'))}
        >
          <Bot className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Agent</span>
            <span className="text-xs text-muted-foreground">
              {canCreateAgents
                ? 'A model with instructions, tools and knowledge'
                : 'Only admins can create agents in this workspace'}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canCreateCoworkers}
          onSelect={() => navigate(`${aiWorkspacePath(slug, 'agents')}?create=coworker`)}
        >
          <UserCheck className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Coworker</span>
            <span className="text-xs text-muted-foreground">
              {canCreateCoworkers
                ? 'A persistent teammate that works in channels'
                : 'Only admins can create coworkers in this workspace'}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(aiWorkspacePath(slug, 'workflows', 'new'))}>
          <Workflow className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Workflow</span>
            <span className="text-xs text-muted-foreground">
              Steps, conditions and approvals on a trigger
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
