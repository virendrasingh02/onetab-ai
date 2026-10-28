import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AiEntityAvatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageSection,
} from '@org/ui';
import { studioAppUrl, studioWorkspacePath } from '@org/platform';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  MessageSquare,
  Pause,
  Plug,
  Settings2,
  UserRound,
  Users,
} from 'lucide-react';
import { ActiveBadge, MARKETPLACE_GRID_CLASS, SectionTabs } from './marketplace-ui';
import type { WorkspaceCoworker } from './use-workspace-catalog';

type StatusFilter = 'all' | 'active' | 'paused';

const MAX_CONNECTORS = 4;

interface MarketplaceWorkspaceViewProps {
  coworkers: WorkspaceCoworker[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  workspaceSlug: string;
  searchQuery: string;
  /** Opens the AI Agent Studio (optionally at a path inside its workspace area). */
  onOpenStudio: (path?: string) => void;
}

function Stat({
  icon: Icon,
  children,
  title,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  title: string;
  tone?: 'warning';
}) {
  return (
    <span
      title={title}
      className={
        tone === 'warning'
          ? 'gap-1 text-xs inline-flex items-center text-warning-text'
          : 'gap-1 text-xs inline-flex items-center text-muted-foreground'
      }
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

function CoworkerCard({
  coworker,
  onOpen,
  onEdit,
  onStudio,
}: {
  coworker: WorkspaceCoworker;
  onOpen: () => void;
  onEdit: () => void;
  onStudio: () => void;
}) {
  const roster = coworker.roster;
  const connectors = roster?.connectors ?? [];
  const attached = connectors.filter((c) => c.state === 'attached');
  const needsAttention = connectors.filter(
    (c) => c.state === 'needs_reconnect',
  ).length;
  const waiting = roster?.activity.waitingApproval ?? 0;

  return (
    <Card className="p-4 justify-between">
      <div>
        <div className="mb-3 gap-3 flex items-start justify-between">
          <div className="min-w-0 gap-3 flex items-center">
            <AiEntityAvatar
              name={coworker.name}
              kind="coworker"
              avatarUrl={coworker.avatarUrl}
              size="lg"
            />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate text-foreground">
                {coworker.name}
              </h4>
              <p className="text-xs truncate text-muted-foreground">
                {coworker.role}
              </p>
            </div>
          </div>
          <ActiveBadge active={coworker.isActive} />
        </div>

        <p className="mb-3 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
          {coworker.description}
        </p>

        {connectors.length > 0 && (
          <div className="mb-3 gap-1.5 flex flex-wrap">
            {connectors.slice(0, MAX_CONNECTORS).map((c) => (
              <Badge
                key={c.provider}
                variant={
                  c.state === 'attached'
                    ? 'success'
                    : c.state === 'needs_reconnect'
                      ? 'warning'
                      : 'neutral'
                }
                title={c.reason ?? `${c.name}: ${c.state.replace(/_/g, ' ')}`}
              >
                {c.name}
              </Badge>
            ))}
            {connectors.length > MAX_CONNECTORS && (
              <Badge variant="neutral">
                +{connectors.length - MAX_CONNECTORS}
              </Badge>
            )}
          </div>
        )}

        {roster && (
          <div className="gap-x-3 gap-y-1 flex flex-wrap items-center">
            <Stat
              icon={Plug}
              title={`${attached.length} of ${connectors.length} connectors attached`}
            >
              {attached.length}/{connectors.length}
            </Stat>
            <Stat icon={Users} title="Specialist agents">
              {roster.specialists.length}
            </Stat>
            <Stat icon={Activity} title="Runs in the last 30 days">
              {roster.activity.runs30d}
            </Stat>
            <Stat icon={ListChecks} title="Open tasks">
              {roster.activity.openTasks}
            </Stat>
            {waiting > 0 && (
              <Stat
                icon={AlertCircle}
                title="Runs waiting for approval"
                tone="warning"
              >
                {waiting} awaiting approval
              </Stat>
            )}
            {needsAttention > 0 && (
              <Stat
                icon={AlertCircle}
                title="Connections that need to be reconnected"
                tone="warning"
              >
                {needsAttention} to reconnect
              </Stat>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 gap-2 pt-3 flex items-center justify-between border-t border-border/60">
        <Button variant="outline" size="xs" onClick={onOpen}>
          <MessageSquare aria-hidden />
          Open
        </Button>
        <div className="gap-1 flex items-center">
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <Settings2 aria-hidden />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onStudio}
            title="Open in AI Agent Studio"
          >
            <ExternalLink aria-hidden />
            Studio
          </Button>
        </div>
      </div>
    </Card>
  );
}

export const MarketplaceWorkspaceView: React.FC<
  MarketplaceWorkspaceViewProps
> = ({
  coworkers,
  isLoading,
  isError,
  onRetry,
  workspaceSlug,
  searchQuery,
  onOpenStudio,
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('all');

  const counts = useMemo(
    () => ({
      all: coworkers.length,
      active: coworkers.filter((c) => c.isActive).length,
      paused: coworkers.filter((c) => !c.isActive).length,
    }),
    [coworkers],
  );

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return coworkers
      .filter(
        (c) =>
          status === 'all' || (status === 'active' ? c.isActive : !c.isActive),
      )
      .filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          c.role.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle) ||
          (c.roster?.connectors ?? []).some((k) =>
            k.name.toLowerCase().includes(needle),
          ),
      );
  }, [coworkers, status, searchQuery]);

  return (
    <div className="space-y-4 py-3">
      <PageSection
        variant="plain"
        title="Coworkers"
        description="The AI coworkers in this workspace, as listed in the sidebar. Build and manage coworkers in the AI Agent Studio — new ones appear here automatically."
        className="mb-0"
      />

      <SectionTabs
        aria-label="Filter coworkers by status"
        value={status}
        onValueChange={setStatus}
        items={[
          {
            value: 'all' as const,
            label: 'All',
            icon: <UserRound className="size-3.5" aria-hidden />,
            count: counts.all,
          },
          {
            value: 'active' as const,
            label: 'Active',
            icon: <CheckCircle2 className="size-3.5" aria-hidden />,
            count: counts.active,
          },
          {
            value: 'paused' as const,
            label: 'Paused',
            icon: <Pause className="size-3.5" aria-hidden />,
            count: counts.paused,
          },
        ]}
      />

      {isLoading && coworkers.length === 0 ? (
        <LoadingState label="Loading coworkers…" />
      ) : isError && coworkers.length === 0 ? (
        <EmptyState
          title="Couldn’t load coworkers"
          description="Something went wrong reaching the server."
          action={
            onRetry ? (
              <Button variant="primary" size="sm" onClick={onRetry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            searchQuery
              ? 'No matches'
              : status === 'all'
                ? 'No coworkers yet'
                : `No ${status} coworkers`
          }
          description={
            searchQuery
              ? `No coworker matches “${searchQuery}”.`
              : 'Coworkers are AI teammates that work alongside your team in channels and projects.'
          }
        />
      ) : (
        <div className={MARKETPLACE_GRID_CLASS}>
          {visible.map((cw) => (
            <CoworkerCard
              key={cw.id}
              coworker={cw}
              onOpen={() => navigate(`/w/${workspaceSlug}/coworkers/${cw.id}`)}
              onEdit={() => navigate(`/w/${workspaceSlug}/ai/agents/${cw.id}`)}
              onStudio={() =>
                onOpenStudio(studioWorkspacePath(workspaceSlug, 'agents', cw.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Opens a Studio path in a new tab (the Studio is a separate app). */
export function openStudioTab(path = ''): void {
  window.open(studioAppUrl(path), '_blank', 'noopener');
}
