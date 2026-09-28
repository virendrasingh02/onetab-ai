import { aiStudioApi, queryKeys } from '@org/api-client';
import {
  AIRunStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  StatCard,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Plug,
  ShieldCheck,
  UserCheck,
  Workflow,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { aiWorkspacePath } from './ai-workspace-routes.js';
import { useAIRuns, useApprovals, useMcpConnections, useRunSubjects, useWorkspaceIds } from './use-ai-workspace.js';

/**
 * Where the AI Workspace opens: what exists, what ran recently, and what needs
 * someone's attention — approvals waiting on you, runs that failed, MCP
 * servers that stopped answering — each linking to where it is fixed.
 */
export function AIOverviewSection() {
  const { workspaceId, slug } = useWorkspaceIds();
  const navigate = useNavigate();
  const subjects = useRunSubjects(workspaceId);

  const overview = useQuery({
    queryKey: queryKeys.aiStudio.overview(workspaceId ?? ''),
    queryFn: () => aiStudioApi.getOverview(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const approvals = useApprovals(workspaceId, 'PENDING');
  const failed = useAIRuns(workspaceId, { status: 'FAILED', limit: 5 });
  const mcp = useMcpConnections(workspaceId);

  if (overview.isLoading) return <LoadingState label="Loading the AI Workspace…" />;
  if (overview.isError || !overview.data) {
    return (
      <ErrorState
        title="Couldn't load the overview"
        description="Check your connection and try again."
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const data = overview.data;
  const waitingOnMe = (approvals.data ?? []).filter((a) => a.canDecide);
  const brokenServers = (mcp.data ?? []).filter((c) => c.status === 'ERROR');
  const attention = waitingOnMe.length + (failed.data?.length ?? 0) + brokenServers.length;
  const isEmpty = data.totalAgents + data.totalCoworkers + data.totalWorkflows === 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Agents" value={data.totalAgents} icon={Bot} accent="violet" />
        <StatCard label="Coworkers" value={data.totalCoworkers} icon={UserCheck} accent="pink" />
        <StatCard label="Workflows" value={data.totalWorkflows} icon={Workflow} accent="indigo" />
        <StatCard
          label="Runs"
          value={data.totalExecutions}
          icon={Activity}
          accent="teal"
          hint={data.totalExecutions > 0 ? `${data.successRate}% completed` : undefined}
        />
      </div>

      {isEmpty ? (
        <GetStarted slug={slug} />
      ) : null}

      <PageSection
        title="Needs attention"
        description={attention === 0 ? 'Nothing is waiting on anyone.' : undefined}
      >
        {attention === 0 ? null : (
          <div className="grid gap-3 md:grid-cols-3">
            {waitingOnMe.length > 0 ? (
              <AttentionCard
                icon={<ShieldCheck />}
                tone="warning"
                title={`${waitingOnMe.length} approval${waitingOnMe.length === 1 ? '' : 's'} waiting for you`}
                description="An agent or workflow paused before an action that needs your go-ahead."
                action="Review"
                onClick={() => navigate(aiWorkspacePath(slug, 'approvals'))}
              />
            ) : null}
            {(failed.data?.length ?? 0) > 0 ? (
              <AttentionCard
                icon={<AlertTriangle />}
                tone="destructive"
                title={`${failed.data?.length} recent run${failed.data?.length === 1 ? '' : 's'} failed`}
                description="Open the run to see which step failed and why, then retry it."
                action="See failed runs"
                onClick={() => navigate(`${aiWorkspacePath(slug, 'runs')}?status=FAILED`)}
              />
            ) : null}
            {brokenServers.length > 0 ? (
              <AttentionCard
                icon={<Plug />}
                tone="destructive"
                title={`${brokenServers.length} MCP server${brokenServers.length === 1 ? '' : 's'} not reachable`}
                description={brokenServers[0]?.lastError ?? 'The last handshake failed.'}
                action="Fix in Tools"
                onClick={() => navigate(aiWorkspacePath(slug, 'tools'))}
              />
            ) : null}
          </div>
        )}
      </PageSection>

      <PageSection
        title="Recent runs"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={aiWorkspacePath(slug, 'runs')}>
              All runs <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      >
        {data.recentExecutions.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Activity />}
            title="No runs yet"
            description="Test an agent or run a workflow and its trace appears here."
          />
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {data.recentExecutions.slice(0, 6).map((run) => {
              const subject = subjects.get(run.entityId);
              return (
                <Link
                  key={run.id}
                  to={`${aiWorkspacePath(slug, 'runs')}?run=${run.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AIRunStatusBadge status={run.status} />
                    <span className="truncate font-medium text-foreground">
                      {subject?.name ?? 'Deleted item'}
                    </span>
                    <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
                      {subject?.kind ?? run.entityType.toLowerCase()}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(run.startedAt)}
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </PageSection>
    </div>
  );
}

function GetStarted({ slug }: { slug: string | undefined }) {
  const steps = [
    {
      icon: <Bot />,
      title: 'Build an agent',
      text: 'Pick a model, write its instructions and give it tools. Test it before anyone else sees it.',
      to: aiWorkspacePath(slug, 'agents', 'new'),
    },
    {
      icon: <BookOpen />,
      title: 'Add knowledge',
      text: 'Paste policies or docs into a knowledge base so agents answer from them and cite them.',
      to: aiWorkspacePath(slug, 'knowledge'),
    },
    {
      icon: <Workflow />,
      title: 'Automate a process',
      text: 'Chain steps on a trigger — call an agent, branch on the result, ask a person to approve.',
      to: aiWorkspacePath(slug, 'workflows', 'new'),
    },
  ];
  return (
    <PageSection title="Get started">
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.title}
            to={step.to}
            className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
              {step.icon}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
              {step.title}
              <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{step.text}</span>
          </Link>
        ))}
      </div>
    </PageSection>
  );
}

function AttentionCard({
  icon,
  tone,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  tone: 'warning' | 'destructive';
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
            tone === 'warning' ? 'bg-warning/12 text-warning' : 'bg-destructive/10 text-destructive',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="self-start" onClick={onClick}>
        {action}
      </Button>
    </Card>
  );
}
