import type { StudioHome as StudioHomeData } from '@org/types';
import {
  AIRunStatusBadge,
  Button,
  Card,
  ErrorState,
  PageSection,
  Skeleton,
  StatCard,
  Textarea,
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
  Sparkles,
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

/**
 * Where the AI Agent Studio opens: what your agents did today, what needs you,
 * what is running right now, what runs next — and one box to ask for a new
 * agent in your own words.
 */
export function StudioHome() {
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

  return (
    <div className="space-y-8">
      <Hero data={data} slug={slug} />

      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))]">
        {data ? (
          <>
            <StatCard label="Running now" value={data.stats.running} icon={Loader2} accent="indigo" />
            <StatCard label="Completed today" value={data.stats.completedToday} icon={CheckCircle2} accent="teal" />
            <StatCard label="Created by agents today" value={data.stats.itemsCreatedToday} icon={PackagePlus} accent="violet" hint="Tasks and docs" />
            <StatCard label="Waiting for you" value={data.stats.approvalsWaiting} icon={ShieldCheck} accent="amber" />
            <StatCard label="Issues today" value={data.stats.issues} icon={AlertTriangle} accent="rose" positiveDirection="down" />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        )}
      </div>

      {data ? (
        <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))]">
          <PageSection title="Needs attention" description={data.approvals.length + data.failed.length === 0 ? 'Nothing is waiting on you.' : undefined}>
            {data.approvals.length + data.failed.length > 0 ? (
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
                    title={r.name ?? 'Deleted agent'}
                    detail="Failed — open it to see which step and why"
                    meta={formatRelative(r.startedAt)}
                  />
                ))}
              </Card>
            ) : null}
          </PageSection>

          <PageSection title="Running now" description={data.runningNow.length === 0 ? 'No agent is running at the moment.' : undefined}>
            {data.runningNow.length ? (
              <Card className="divide-y divide-border overflow-hidden p-0">
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
            ) : null}
          </PageSection>

          <PageSection
            title="Completed today"
            description={data.recentlyCompleted.length === 0 ? 'Nothing has finished yet today.' : undefined}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to={aiWorkspacePath(slug, 'runs')}>
                  All runs <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          >
            {data.recentlyCompleted.length ? (
              <Card className="divide-y divide-border overflow-hidden p-0">
                {data.recentlyCompleted.map((r) => (
                  <Row
                    key={r.id}
                    to={runLink(r)}
                    icon={<CheckCircle2 className="size-4 text-success" aria-hidden />}
                    title={r.name ?? 'Deleted agent'}
                    detail="Open the result"
                    meta={r.finishedAt ? formatRelative(r.finishedAt) : ''}
                  />
                ))}
              </Card>
            ) : null}
          </PageSection>

          <PageSection title="Coming up" description={data.scheduled.length === 0 ? 'No scheduled agent is switched on.' : undefined}>
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
            ) : null}
          </PageSection>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))]">
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

function humanize(id: string): string {
  return id.replace(/__.*$/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function Hero({ data, slug }: { data: StudioHomeData | undefined; slug: string | undefined }) {
  const navigate = useNavigate();
  const { can } = useWorkspacePermission();
  const [request, setRequest] = useState('');
  const submit = (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    navigate(`${aiWorkspacePath(slug, 'studio', 'new')}?prompt=${encodeURIComponent(prompt)}`);
  };
  const active = data?.stats.activeAgents ?? 0;
  return (
    <section aria-labelledby="studio-greeting" className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface p-5 sm:p-7">
      <h2 id="studio-greeting" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {greeting()}
        {data?.greetingName ? `, ${data.greetingName}` : ''}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {active > 0
          ? `Your AI agents are working for you — ${active} ${active === 1 ? 'is' : 'are'} switched on.`
          : 'Tell the Studio what you want done, and it plans an agent to do it.'}
      </p>
      {can('create') ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(request);
          }}
        >
          <label htmlFor="studio-request" className="sr-only">
            What should I automate?
          </label>
          <div className="relative">
            <Textarea
              id="studio-request"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(request);
                }
              }}
              rows={2}
              placeholder="What should I automate? e.g. “Every morning, create my to-do list from today’s meetings”"
              className="resize-none bg-surface pr-28 text-sm"
            />
            <Button type="submit" size="sm" className="absolute bottom-2 right-2" leadingIcon={<Sparkles />} disabled={!request.trim()}>
              Plan it
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Examples">
            {EXAMPLE_REQUESTS.slice(0, 4).map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => submit(example)}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      ) : null}
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

