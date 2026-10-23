import type { StudioHome as StudioHomeData } from '@org/types';
import {
  AIRunStatusBadge,
  Button,
  Card,
  ErrorState,
  PageSection,
  PromptComposer,
  Skeleton,
  StatCard,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { aiWorkspacePath, studioAgentPath } from '@org/web-ai';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PackagePlus,
  ShieldCheck,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TemplateGallery } from './AgentLibrary.js';
import { formatUpcoming, greeting } from './studio-meta.js';
import { useStudioHome } from './use-studio.js';

export const EXAMPLE_REQUESTS = [
  'Every morning, create my to-do list from today’s meetings and deadlines',
  'Prepare my daily work report at 6 PM on weekdays',
  'Review my project and tell me what is blocked',
  'When an important message arrives in a channel, create a task and notify me',
  'Every Friday afternoon, write my weekly report',
  'Read a requirements doc and create a project plan',
];

/** The one "describe your agent" box — Studio Home and the plan-first create page both use it. */
export function AgentPromptComposer({
  id,
  value,
  onChange,
  onSubmit,
  busy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <PromptComposer
      id={id}
      label="What should this agent do?"
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      busy={busy}
      autoFocus={autoFocus}
      submitOn="enter"
      placeholder="Describe your agent, e.g. “Every morning, create my to-do list from today’s meetings”"
      suggestions={EXAMPLE_REQUESTS}
      submitLabel="Plan it"
      footnote="Studio can make mistakes — you review and approve the plan before anything is built."
    />
  );
}

/**
 * Where the AI Agent Studio opens: what your agents did today, what needs you,
 * what is running right now, what runs next — and one box to ask for a new
 * agent in your own words.
 */
export function StudioHome({ planHref }: { planHref?: (prompt: string) => string } = {}) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const home = useStudioHome(workspaceId);
  const runLink = (run: { id: string; entityId: string; entityType?: string }) =>
    !run.entityType || run.entityType === 'WORKFLOW'
      ? `${studioAgentPath(slug, run.entityId, 'runs')}&run=${run.id}`
      : `${aiWorkspacePath(slug, 'runs')}?run=${run.id}`;

  if (home.isError) {
    return <ErrorState title="Couldn't load your agents" onRetry={() => void home.refetch()} />;
  }
  const data = home.data;
  const attention = data ? data.approvals.length + data.failed.length : 0;
  // One row per agent (latest run first) instead of the same agent repeated for every run.
  const completedGroups = (() => {
    const groups = new Map<string, { run: StudioHomeData['recentlyCompleted'][number]; count: number }>();
    for (const run of data?.recentlyCompleted ?? []) {
      const existing = groups.get(run.entityId);
      if (existing) existing.count += 1;
      else groups.set(run.entityId, { run, count: 1 });
    }
    return [...groups.values()];
  })();

  return (
    <div className="space-y-8">
      <Hero data={data} slug={slug} planHref={planHref} />

      {data && attention > 0 ? (
        <Link
          to={data.approvals.length ? aiWorkspacePath(slug, 'approvals') : aiWorkspacePath(slug, 'runs')}
          className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="size-4 text-warning" aria-hidden />
            {[
              data.approvals.length ? `${data.approvals.length} ${data.approvals.length === 1 ? 'approval' : 'approvals'} waiting for you` : null,
              data.failed.length ? `${data.failed.length} failed ${data.failed.length === 1 ? 'run' : 'runs'} today` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Review <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </Link>
      ) : null}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {data ? (
          <>
            <StatCard label="Running now" value={data.stats.running} icon={Loader2} accent="indigo" showSparkline={false} hint="Live agents" />
            <StatCard
              label="Completed today"
              value={data.stats.completedToday}
              icon={CheckCircle2}
              accent="teal"
              sparklineData={data.stats.history.completed}
              hint="Last 7 days"
            />
            <StatCard label="Created by agents" value={data.stats.itemsCreatedToday} icon={PackagePlus} accent="violet" showSparkline={false} hint="Tasks and docs today" />
            <StatCard label="Waiting for you" value={data.stats.approvalsWaiting} icon={ShieldCheck} accent="amber" showSparkline={false} hint="Approvals" />
            <StatCard
              label="Issues today"
              value={data.stats.issues}
              icon={AlertTriangle}
              accent="rose"
              sparklineData={data.stats.history.failed}
              hint="Failed runs, 7 days"
            />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        )}
      </div>

      {data ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <PageSection
            title="Happening now"
          >
            {attention + data.runningNow.length > 0 ? (
              <Card className="divide-y divide-border overflow-hidden p-0">
                {data.approvals.map((a) => (
                  <Row
                    key={a.id}
                    to={a.runId ? `${aiWorkspacePath(slug, 'runs')}?run=${a.runId}` : aiWorkspacePath(slug, 'approvals')}
                    icon={<ShieldCheck className="size-4 text-warning" aria-hidden />}
                    title={a.agentName ?? 'An agent'}
                    detail={`Needs approval: ${a.action}`}
                    meta={formatRelative(a.createdAt)}
                  />
                ))}
                {data.failed.map((r) => (
                  <Row
                    key={r.id}
                    to={runLink(r)}
                    icon={<AlertTriangle className="size-4 text-destructive" aria-hidden />}
                    title={r.name ?? 'Removed agent'}
                    detail="Failed — open it to see which step and why"
                    meta={formatRelative(r.startedAt)}
                  />
                ))}
                {data.runningNow.map((r) => (
                  <Row
                    key={r.id}
                    to={runLink(r)}
                    icon={<AIRunStatusBadge status={r.status} />}
                    title={r.name ?? 'Agent'}
                    detail={
                      r.status === 'RUNNING' && r.currentStep
                        ? `${r.currentStep.status === 'RUNNING' ? 'On' : 'Finished'}: ${humanize(r.currentStep.stepId)}`
                        : r.status === 'WAITING_APPROVAL'
                          ? 'Waiting for an approval'
                          : r.status === 'PAUSED'
                            ? 'Paused'
                            : 'Starting'
                    }
                    meta={`started ${formatRelative(r.startedAt)}`}
                    live={r.status === 'RUNNING'}
                  />
                ))}
              </Card>
            ) : (
              <EmptyCard icon={<ShieldCheck className="size-5" aria-hidden />} text="All clear — nothing is waiting on you and no agent is running." />
            )}
          </PageSection>

          <PageSection
            title="Completed today"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to={aiWorkspacePath(slug, 'runs')}>
                  All runs <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          >
            {completedGroups.length ? (
              <Card className="divide-y divide-border overflow-hidden p-0">
                {completedGroups.map(({ run, count }) => (
                  <Row
                    key={run.id}
                    to={runLink(run)}
                    icon={<CheckCircle2 className="size-4 text-success" aria-hidden />}
                    title={run.name ?? 'Removed agent'}
                    detail={count > 1 ? `Ran ${count} times — open the latest result` : 'Open the result'}
                    meta={run.finishedAt ? formatRelative(run.finishedAt) : ''}
                  />
                ))}
              </Card>
            ) : (
              <EmptyCard icon={<CheckCircle2 className="size-5" aria-hidden />} text="Nothing has finished yet today." />
            )}
          </PageSection>

          <PageSection title="Coming up">
            {data.scheduled.length ? (
              <Card className="divide-y divide-border overflow-hidden p-0">
                {data.scheduled.map((a) => (
                  <Row
                    key={a.id}
                    to={studioAgentPath(slug, a.id)}
                    icon={<CalendarClock className="size-4 text-muted-foreground" aria-hidden />}
                    title={a.name}
                    detail={a.nextRunAt ? `Next run ${formatUpcoming(a.nextRunAt)}` : 'Scheduled'}
                  />
                ))}
              </Card>
            ) : (
              <EmptyCard icon={<CalendarClock className="size-5" aria-hidden />} text="No scheduled agent is switched on." />
            )}
          </PageSection>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {data && data.recommended.length ? (
        <PageSection
          title="Recommended agents"
          description="Working agents made from the tools you already have. Each opens as a plan you can change before saving."
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to={`${aiWorkspacePath(slug, 'agents')}?view=templates`}>
                All templates <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <TemplateGallery slug={slug} limitTo={data.recommended.slice(0, 3)} />
        </PageSection>
      ) : null}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Card className="flex items-center gap-3 border-dashed px-4 py-5 text-sm text-muted-foreground shadow-none">
      <span className="shrink-0 text-muted-foreground/70">{icon}</span>
      {text}
    </Card>
  );
}

function humanize(id: string): string {
  return id.replace(/__.*$/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function Hero({
  data,
  slug,
  planHref,
}: {
  data: StudioHomeData | undefined;
  slug: string | undefined;
  planHref?: (prompt: string) => string;
}) {
  const navigate = useNavigate();
  const { can } = useWorkspacePermission();
  const [request, setRequest] = useState('');
  const submit = () => {
    const prompt = request.trim();
    if (!prompt) return;
    navigate(planHref ? planHref(prompt) : `${aiWorkspacePath(slug, 'studio', 'new')}?prompt=${encodeURIComponent(prompt)}`);
  };
  const active = data?.stats.activeAgents ?? 0;
  return (
    <section aria-labelledby="studio-greeting" className="mx-auto w-full max-w-3xl space-y-5 py-2">
      <div className="space-y-1 text-center">
        <h2 id="studio-greeting" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting()}
          {data?.greetingName ? `, ${data.greetingName}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          {active > 0
            ? `Your AI agents are working for you — ${active} ${active === 1 ? 'is' : 'are'} switched on.`
            : 'Tell the Studio what you want done, and it plans an agent to do it.'}
        </p>
      </div>
      {can('create') ? <AgentPromptComposer id="studio-request" value={request} onChange={setRequest} onSubmit={submit} /> : null}
    </section>
  );
}

function Row({
  to,
  icon,
  title,
  detail,
  meta,
  live,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  meta?: string;
  live?: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{title}</span>
          {detail ? (
            <span className={cn('block truncate text-xs', live ? 'text-primary' : 'text-muted-foreground')} aria-live={live ? 'polite' : undefined}>
              {detail}
            </span>
          ) : null}
        </span>
      </span>
      {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
    </Link>
  );
}

