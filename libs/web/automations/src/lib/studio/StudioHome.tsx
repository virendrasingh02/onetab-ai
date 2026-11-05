import type { StudioHome as StudioHomeData } from '@org/types';
import {
  AIRunStatusBadge,
  Button,
  Card,
  ErrorState,
  PageSection,
  PromptComposer,
  Skeleton,
  type PromptComposerAction,
  type PromptComposerQuickAction,
  StatCard,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { aiWorkspacePath, studioAgentPath } from '@org/web-ai';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  LayoutTemplate,
  ListChecks,
  MessageSquareText,
  PackagePlus,
  Search,
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

/** One-click starters under the empty box — the same "Quick actions" cards as the Agent Copilot. */
const QUICK_STARTS: PromptComposerQuickAction[] = [
  {
    label: 'Daily to-do list from my meetings',
    prompt: EXAMPLE_REQUESTS[0],
    icon: <ListChecks />,
  },
  {
    label: 'Weekday 6 PM work report',
    prompt: EXAMPLE_REQUESTS[1],
    icon: <FileText />,
  },
  {
    label: 'Tell me what’s blocked',
    prompt: EXAMPLE_REQUESTS[2],
    icon: <Search />,
  },
  {
    label: 'Turn important messages into tasks',
    prompt: EXAMPLE_REQUESTS[3],
    icon: <MessageSquareText />,
  },
];

const PLACEHOLDERS = EXAMPLE_REQUESTS.slice(0, 4).map(
  (r) => `Describe your agent — “${r}”`,
);

/** The one "describe your agent" box — Studio Home and the plan-first create page both use it. */
export function AgentPromptComposer({
  id,
  value,
  onChange,
  onSubmit,
  busy,
  autoFocus,
  actions,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy?: boolean;
  autoFocus?: boolean;
  actions?: PromptComposerAction[];
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
      placeholder={PLACEHOLDERS}
      quickActions={QUICK_STARTS}
      quickActionsTitle="Start with one of these"
      actions={actions}
      submitLabel="Plan it"
      footerStart={
        <span className="gap-1.5 font-medium inline-flex items-center">
          <ShieldCheck className="size-3" aria-hidden /> Plan first — nothing is
          built until you approve
        </span>
      }
      footnote="Studio can make mistakes — check the plan before you approve it."
    />
  );
}

/**
 * Where the AI Agent Studio opens: what your agents did today, what needs you,
 * what is running right now, what runs next — and one box to ask for a new
 * agent in your own words.
 */
export function StudioHome({
  planHref,
  showComposer = true,
}: {
  planHref?: (prompt: string) => string;
  /** False drops the greeting + prompt box — for hosts whose header already has "Create with AI". */
  showComposer?: boolean;
} = {}) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const home = useStudioHome(workspaceId);
  const runLink = (run: {
    id: string;
    entityId: string;
    entityType?: string;
  }) =>
    !run.entityType || run.entityType === 'WORKFLOW'
      ? `${studioAgentPath(slug, run.entityId, 'runs')}&run=${run.id}`
      : `${aiWorkspacePath(slug, 'runs')}?run=${run.id}`;

  if (home.isError) {
    return (
      <ErrorState
        title="Couldn't load your agents"
        onRetry={() => void home.refetch()}
      />
    );
  }
  const data = home.data;
  const attention = data ? data.approvals.length + data.failed.length : 0;
  // One row per agent (latest run first) instead of the same agent repeated for every run.
  const completedGroups = (() => {
    const groups = new Map<
      string,
      { run: StudioHomeData['recentlyCompleted'][number]; count: number }
    >();
    for (const run of data?.recentlyCompleted ?? []) {
      const existing = groups.get(run.entityId);
      if (existing) existing.count += 1;
      else groups.set(run.entityId, { run, count: 1 });
    }
    return [...groups.values()];
  })();

  return (
    <div className="space-y-8">
      {showComposer ? (
        <Hero data={data} slug={slug} planHref={planHref} />
      ) : null}

      {data && attention > 0 ? (
        <Link
          to={
            data.approvals.length
              ? aiWorkspacePath(slug, 'approvals')
              : aiWorkspacePath(slug, 'runs')
          }
          className="gap-3 px-4 py-3 text-sm flex items-center justify-between rounded-xl border border-warning/40 bg-warning/10 transition-colors hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="gap-2 font-medium flex items-center text-foreground">
            <ShieldCheck className="size-4 text-warning" aria-hidden />
            {[
              data.approvals.length
                ? `${data.approvals.length} ${data.approvals.length === 1 ? 'approval' : 'approvals'} waiting for you`
                : null,
              data.failed.length
                ? `${data.failed.length} failed ${data.failed.length === 1 ? 'run' : 'runs'} today`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="gap-1 text-xs flex items-center text-muted-foreground">
            Review <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </Link>
      ) : null}

      <div className="gap-3 sm:grid-cols-3 xl:grid-cols-5 grid grid-cols-2">
        {data ? (
          <>
            <StatCard
              label="Running now"
              value={data.stats.running}
              icon={Activity}
              accent="indigo"
              showSparkline={false}
              hint="Live agents"
            />
            <StatCard
              label="Completed today"
              value={data.stats.completedToday}
              icon={CheckCircle2}
              accent="teal"
              sparklineData={data.stats.history.completed}
              hint="Last 7 days"
            />
            <StatCard
              label="Created by agents"
              value={data.stats.itemsCreatedToday}
              icon={PackagePlus}
              accent="violet"
              showSparkline={false}
              hint="Tasks and docs today"
            />
            <StatCard
              label="Waiting for you"
              value={data.stats.approvalsWaiting}
              icon={ShieldCheck}
              accent="amber"
              showSparkline={false}
              hint="Approvals"
            />
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
          Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" aria-hidden />
          ))
        )}
      </div>

      {data ? (
        <div className="gap-6 lg:grid-cols-3 grid items-start">
          <PageSection
            title="Happening now"
            description="Approvals, failures and runs in progress — updates on its own."
          >
            {attention + data.runningNow.length > 0 ? (
              <Card className="p-0 divide-y divide-border overflow-hidden">
                {data.approvals.map((a) => (
                  <Row
                    key={a.id}
                    to={
                      a.runId
                        ? `${aiWorkspacePath(slug, 'runs')}?run=${a.runId}`
                        : aiWorkspacePath(slug, 'approvals')
                    }
                    icon={
                      <ShieldCheck
                        className="size-4 text-warning"
                        aria-hidden
                      />
                    }
                    title={a.agentName ?? 'An agent'}
                    detail={`Needs approval: ${a.action}`}
                    meta={formatRelative(a.createdAt)}
                  />
                ))}
                {data.failed.map((r) => (
                  <Row
                    key={r.id}
                    to={runLink(r)}
                    icon={
                      <AlertTriangle
                        className="size-4 text-destructive"
                        aria-hidden
                      />
                    }
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
              <EmptyCard
                icon={<ShieldCheck className="size-5" aria-hidden />}
                text="All clear — nothing is waiting on you and no agent is running."
              />
            )}
          </PageSection>

          <PageSection
            title="Completed today"
            description="One row per agent, latest result first."
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to={aiWorkspacePath(slug, 'runs')}>
                  All runs <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          >
            {completedGroups.length ? (
              <Card className="p-0 divide-y divide-border overflow-hidden">
                {completedGroups.map(({ run, count }) => (
                  <Row
                    key={run.id}
                    to={runLink(run)}
                    icon={
                      <CheckCircle2
                        className="size-4 text-success"
                        aria-hidden
                      />
                    }
                    title={run.name ?? 'Removed agent'}
                    detail={
                      count > 1
                        ? `Ran ${count} times — open the latest result`
                        : 'Open the result'
                    }
                    meta={run.finishedAt ? formatRelative(run.finishedAt) : ''}
                  />
                ))}
              </Card>
            ) : (
              <EmptyCard
                icon={<CheckCircle2 className="size-5" aria-hidden />}
                text="Nothing has finished yet today."
              />
            )}
          </PageSection>

          <PageSection
            title="Coming up"
            description="Scheduled agents that are switched on."
          >
            {data.scheduled.length ? (
              <Card className="p-0 divide-y divide-border overflow-hidden">
                {data.scheduled.map((a) => (
                  <Row
                    key={a.id}
                    to={studioAgentPath(slug, a.id)}
                    icon={
                      <CalendarClock
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    }
                    title={a.name}
                    detail={
                      a.nextRunAt
                        ? `Next run ${formatUpcoming(a.nextRunAt)}`
                        : 'Scheduled'
                    }
                  />
                ))}
              </Card>
            ) : (
              <EmptyCard
                icon={<CalendarClock className="size-5" aria-hidden />}
                text="No scheduled agent is switched on."
              />
            )}
          </PageSection>
        </div>
      ) : (
        <div
          className="gap-6 lg:grid-cols-3 grid"
          aria-busy="true"
          aria-label="Loading activity"
        >
          {Array.from({ length: 3 }, (_, i) => (
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
              <Link to={aiWorkspacePath(slug, 'templates')}>
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
    <Card className="gap-3 px-4 py-5 text-sm flex items-center border-dashed text-muted-foreground shadow-none">
      <span className="shrink-0 text-muted-foreground/70">{icon}</span>
      {text}
    </Card>
  );
}

function humanize(id: string): string {
  return id
    .replace(/__.*$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
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
  const submit = (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    navigate(
      planHref
        ? planHref(prompt)
        : `${aiWorkspacePath(slug, 'planned', 'new')}?prompt=${encodeURIComponent(prompt)}`,
    );
  };
  const active = data?.stats.activeAgents ?? 0;
  return (
    <section
      aria-labelledby="studio-greeting"
      className="max-w-3xl space-y-5 py-2 mx-auto w-full"
    >
      <div className="space-y-1 text-center">
        <h2
          id="studio-greeting"
          className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground"
        >
          {greeting()}
          {data?.greetingName ? `, ${data.greetingName}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          {active > 0
            ? `Your AI agents are working for you — ${active} ${active === 1 ? 'is' : 'are'} switched on.`
            : 'Tell the Studio what you want done, and it plans an agent to do it.'}
        </p>
      </div>
      {can('create') ? (
        <AgentPromptComposer
          id="studio-request"
          value={request}
          onChange={setRequest}
          onSubmit={submit}
          actions={[
            {
              label: 'Start from a template',
              icon: <LayoutTemplate className="size-3.5" />,
              onSelect: () => navigate(aiWorkspacePath(slug, 'templates')),
            },
          ]}
        />
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
      className="gap-3 px-4 py-3 text-sm flex items-center justify-between transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="min-w-0 gap-3 flex items-center">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="font-medium block truncate text-foreground">
            {title}
          </span>
          {detail ? (
            <span
              className={cn(
                'text-xs block truncate',
                live ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {detail}
            </span>
          ) : null}
        </span>
      </span>
      {meta ? (
        <span className="text-xs shrink-0 text-muted-foreground">{meta}</span>
      ) : null}
    </Link>
  );
}
