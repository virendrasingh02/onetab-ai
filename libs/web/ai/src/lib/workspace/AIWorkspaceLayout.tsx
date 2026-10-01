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
  ResponsiveTabsList,
  Tabs,
  TabsTrigger,
} from '@org/ui';
import { useCreationPolicies, useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, LayoutTemplate, Plus, Sparkles, UserCheck, Workflow } from 'lucide-react';
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
 * The header is the same compact, sticky, channel-style bar as Inbox, Files,
 * Meetings and the other top-level views — a 48px title row with actions,
 * then an edge-to-edge tab strip — rather than a page-hero `PageHeader`.
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
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-1.5 flex items-center">
            <Sparkles
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <h1 className="text-sm font-semibold tracking-tight truncate text-foreground">
              AI Agent Studio
            </h1>
          </div>

          <div className="gap-2 flex items-center">
            <NewAIResourceMenu slug={slug} workspaceId={workspaceId} />
          </div>
        </div>

        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs
            value={section}
            onValueChange={(next) =>
              navigate(aiWorkspacePath(slug, next === 'overview' ? '' : (next as AIWorkspaceSection)))
            }
          >
            <ResponsiveTabsList
              variant="underline"
              size="sm"
              className="border-b-0 min-w-0 w-full"
              aria-label="AI Agent Studio sections"
            >
              {AI_WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  icon={<Icon className="size-3.5" aria-hidden />}
                  count={id === 'approvals' && mine > 0 ? mine : undefined}
                >
                  {label}
                </TabsTrigger>
              ))}
            </ResponsiveTabsList>
          </Tabs>
        </div>
      </div>

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
  const { canCreateAgents, canCreateCoworkers } = useCreationPolicies(workspaceId);
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
        <DropdownMenuItem onSelect={() => navigate(aiWorkspacePath(slug, 'studio', 'new'))}>
          <Sparkles className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Describe an agent</span>
            <span className="text-xs text-muted-foreground">Say what you want done — the Studio plans it</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`${aiWorkspacePath(slug, 'agents')}?view=templates`)}>
          <LayoutTemplate className="size-4" aria-hidden />
          <div className="flex flex-col">
            <span>Start from a template</span>
            <span className="text-xs text-muted-foreground">Daily report, to-do plan, project health…</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Build it yourself</DropdownMenuLabel>
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
