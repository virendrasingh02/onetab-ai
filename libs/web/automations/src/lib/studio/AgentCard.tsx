import { AGENT_KINDS, describeTriggerShort, type StudioAgentSummary } from '@org/types';
import { ActionDropdownMenu, AIRunStatusBadge, Badge, Button, Card, Hint, UserAvatar, type EntityAction } from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { CalendarClock, Hand, MoreHorizontal, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AgentStateBadge, KIND_ICON, formatUpcoming } from './studio-meta.js';

export interface AgentCardProps {
  agent: StudioAgentSummary;
  to: string;
  favorite: boolean;
  onToggleFavorite: () => void;
  actions: EntityAction[];
}

/**
 * An agent at a glance: what it is, whether it is on, when it runs next and
 * how its last run went. The whole card opens the agent; the star and the ⋯
 * menu are separate controls.
 */
export function AgentCard({ agent, to, favorite, onToggleFavorite, actions }: AgentCardProps) {
  const Icon = KIND_ICON[agent.kind] ?? KIND_ICON.workflow;
  const TriggerIcon = agent.trigger.kind === 'schedule' ? CalendarClock : agent.trigger.kind === 'event' ? Zap : Hand;
  const kindLabel = agent.kind === 'workflow' ? 'Workflow' : AGENT_KINDS[agent.kind]?.label ?? 'Agent';
  const next = formatUpcoming(agent.nextRunAt);

  return (
    <Card className="group relative flex h-full flex-col gap-3 p-4 transition-colors focus-within:border-border-strong hover:border-border-strong">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
            agent.state === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface-raised text-muted-foreground',
          )}
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={to}
            className="block truncate text-sm font-semibold text-foreground after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {agent.name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{kindLabel}</span>
            <AgentStateBadge state={agent.state} />
            {agent.recentFailures > 0 && agent.lastRun?.status === 'FAILED' ? (
              <Badge variant="destructive" className="text-[10px]">Failing</Badge>
            ) : null}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-0.5">
          <Hint label={favorite ? 'Remove from favorites' : 'Add to favorites'}>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={favorite ? `Remove ${agent.name} from favorites` : `Add ${agent.name} to favorites`}
              aria-pressed={favorite}
              onClick={onToggleFavorite}
            >
              <Star className={cn(favorite && 'fill-warning text-warning')} />
            </Button>
          </Hint>
          <ActionDropdownMenu
            actions={actions}
            entityType="agent"
            entity={agent}
            trigger={
              <Button variant="ghost" size="icon-xs" aria-label={`More actions for ${agent.name}`}>
                <MoreHorizontal />
              </Button>
            }
          />
        </div>
      </div>

      {agent.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p> : null}

      <div className="mt-auto space-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <TriggerIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {describeTriggerShort(agent.trigger)}
            {next ? ` · next ${next}` : ''}
          </span>
        </p>
        <div className="flex items-center justify-between gap-2">
          {agent.lastRun ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <AIRunStatusBadge status={agent.lastRun.status} />
              <span className="truncate">
                {agent.lastRun.test ? 'test · ' : ''}
                {formatRelative(agent.lastRun.startedAt)}
              </span>
            </span>
          ) : (
            <span>Not run yet</span>
          )}
          {agent.owner ? (
            <span className="flex shrink-0 items-center gap-1">
              <UserAvatar name={agent.owner.name} src={agent.owner.avatarUrl ?? undefined} seed={agent.owner.id} size="xs" indicator={false} />
              <span>{agent.isMine ? 'You' : agent.owner.name.split(' ')[0]}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
