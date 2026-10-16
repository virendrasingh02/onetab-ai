import { approvalsApi, queryKeys } from '@org/api-client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Page,
  Tabs,
  TabsTrigger,
  PageBar,
  PageTabBar,
} from '@org/ui';
import {
  useCreationPolicies,
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  ChevronDown,
  LayoutTemplate,
  Plus,
  Sparkles,
  UserCheck,
  Workflow,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AI_WORKSPACE_SECTIONS,
  aiWorkspacePath,
  sectionFromPath,
  type AIWorkspaceSection,
} from './ai-workspace-routes.js';
import { useAIRunUpdates } from './runs/use-run-updates.js';

/**
 * The AI Agent Studio's frame: one heading, one "New" menu and a tab per
 * section, with the section rendered below. Agent pages and editors (an
 * agent's plan and runs, a workflow's canvas) are sibling routes outside this
 * frame so they get the whole viewport.
 *
 * The header is the shared `PageBar` + `PageTabBar` every sidebar destination
 * uses — a compact title row with actions, then an edge-to-edge tab strip —
 * rather than a page-hero `PageHeader`.
 */
export function AIWorkspaceLayout() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  // Runs, the home summary and agent cards update as agents work.
  useAIRunUpdates(workspaceId);

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.approvals.list(workspaceId ?? '', 'PENDING'),
    queryFn: () => approvalsApi.list(workspaceId as string, 'PENDING'),
    enabled: Boolean(workspaceId),
    refetchInterval: 60_000,
  });
  const mine = pending.filter((a) => a.canDecide).length;

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar
        icon={<Sparkles />}
        title="AI Agent Studio"
        hasTabs
        actions={<NewAIResourceMenu slug={slug} workspaceId={workspaceId} />}
      />

      <Tabs
        value={section}
        onValueChange={(next) =>
          navigate(
            aiWorkspacePath(
              slug,
              next === 'overview' ? '' : (next as AIWorkspaceSection),
            ),
          )
        }
      >
        <PageTabBar>
          {AI_WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              icon={<Icon className="size-4" aria-hidden />}
              count={id === 'approvals' && mine > 0 ? mine : undefined}
            >
              {label}
            </TabsTrigger>
          ))}
        </PageTabBar>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Page padding="none" className="p-3 sm:p-6">
          <Outlet />
        </Page>
      </div>
    </div>
  );
}

/**
 * What you can make here. Describing an agent in words is first — the Studio
 * plans it — then a template, then building by hand: an assistant (a model
 * with tools), a coworker, or a workflow on the canvas.
 */
export function NewAIResourceMenu({
  slug,
  workspaceId,
}: {
  slug: string | undefined;
  workspaceId: string | undefined;
}) {
  const navigate = useNavigate();
  const { can } = useWorkspacePermission();
  const { canCreateAgents, canCreateCoworkers } =
    useCreationPolicies(workspaceId);
  if (!can('create')) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-7 text-xs"
          leadingIcon={<Plus />}
          trailingIcon={<ChevronDown />}
        >
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem
          onSelect={() => navigate(aiWorkspacePath(slug, 'studio', 'new'))}
        >
          <Sparkles className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Describe an agent</span>
            <span className="text-xs text-muted-foreground">
              Say what you want done — the Studio plans it
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            navigate(`${aiWorkspacePath(slug, 'agents')}?view=templates`)
          }
        >
          <LayoutTemplate className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Start from a template</span>
            <span className="text-xs text-muted-foreground">
              Daily report, to-do plan, project health…
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-medium text-[11px] text-muted-foreground">
          Build it yourself
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled={!canCreateAgents}
          onSelect={() => navigate(aiWorkspacePath(slug, 'agents', 'new'))}
        >
          <Bot className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Assistant agent</span>
            <span className="text-xs text-muted-foreground">
              {canCreateAgents
                ? 'A model with instructions, tools and knowledge, to chat with'
                : 'Only admins can create assistant agents in this workspace'}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canCreateCoworkers}
          onSelect={() =>
            navigate(`${aiWorkspacePath(slug, 'agents')}?create=coworker`)
          }
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
        <DropdownMenuItem
          onSelect={() => navigate(aiWorkspacePath(slug, 'workflows', 'new'))}
        >
          <Workflow className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Workflow on the canvas</span>
            <span className="text-xs text-muted-foreground">
              Wire steps, branches and approvals by hand
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
