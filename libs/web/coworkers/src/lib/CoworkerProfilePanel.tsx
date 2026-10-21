import type { AICoworkerDetail, TrackerMonitor, AgentSchedule } from '@org/types';
import { coworkerTemplateKey, getCoworkerTemplate } from '@org/types';
import {
  AIEntityProfileEmpty,
  AIEntityProfileFact,
  AIEntityProfileFacts,
  AIEntityProfileHero,
  AIEntityProfilePanel,
  AIEntityProfileQuote,
  AIEntityProfileRunList,
  AIEntityProfileSection,
  Badge,
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  toast,
  AIModelIdentity,
  AIModelBadge,
  type RightPanelProfile,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  Activity,
  Bot,
  Brain,
  Briefcase,
  Check,
  Clock,
  Copy,
  Cpu,
  Edit2,
  Layers,
  MoreVertical,
  Play,
  Plug,
  RefreshCw,
  Shield,
  Trash2,
  Unlink,
  UserCheck,
  Zap,
} from 'lucide-react';
import { type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanManageTrackerMonitor } from '@org/web-workspace';
import { CoworkerAvatar, getGradientByName } from './CoworkerAvatar.js';
import { CoworkerCreateDialog } from './CoworkerCreateDialog.js';
import {
  useCoworker,
  useCoworkerLogs,
  useCoworkerMutations,
  useCoworkerMonitorMutations,
  useCoworkerMonitors,
  useCoworkerSchedules,
} from './use-coworkers.js';

export interface CoworkerProfilePanelProps {
  coworker?: AICoworkerDetail;
  coworkerId?: string;
  workspaceId: string;
  onClose?: () => void;
  onEdit?: (coworker: AICoworkerDetail) => void;
  onStartChat?: (coworker: AICoworkerDetail) => void;
  className?: string;
}

/**
 * CoworkerProfilePanel — right-drawer summary, laid out like the agent profile
 * via the shared `AIEntityProfile*` primitives.
 */
export const CoworkerProfilePanel: FC<CoworkerProfilePanelProps> = ({
  coworker: propCoworker,
  coworkerId: propCoworkerId,
  workspaceId,
  onClose,
  onEdit,
  onStartChat,
  className,
}) => {
  const effectiveId = propCoworker?.id || propCoworkerId || '';
  const { data: fetchedCoworker, isLoading: coworkerLoading } = useCoworker(
    workspaceId,
    effectiveId,
  );
  // Live record first; the opener's snapshot only fills the first paint.
  const coworker = fetchedCoworker ?? propCoworker;

  const { data: logs, isLoading: logsLoading } = useCoworkerLogs(
    workspaceId,
    effectiveId,
  );
  const mutations = useCoworkerMutations(workspaceId);

  // What the coworker was created from — not its (renamable) name.
  const templateKey = coworkerTemplateKey(coworker?.configuration);
  const isTracker = templateKey === 'tracker';
  const isScheduler = templateKey === 'scheduler';
  const { data: monitors } = useCoworkerMonitors(
    workspaceId,
    isTracker ? effectiveId : undefined,
  );
  const canManageMonitor = useCanManageTrackerMonitor();
  const monitorMutations = useCoworkerMonitorMutations(
    workspaceId,
    isTracker ? effectiveId : undefined,
  );
  const handleCheckMonitor = async (monitor: TrackerMonitor) => {
    try {
      const checked = await monitorMutations.check.mutateAsync(monitor.id);
      if (checked.lastError) toast.error(checked.lastError);
      else toast.success(checked.lastResult?.summary ?? 'Checked');
    } catch {
      toast.error('Could not run the check');
    }
  };
  const { data: schedules } = useCoworkerSchedules(
    workspaceId,
    isScheduler ? effectiveId : undefined,
  );

  if (coworkerLoading && !coworker) {
    return (
      <aside
        className={cn(
          'flex h-full w-full flex-col items-center justify-center p-8 bg-surface text-foreground',
          className,
        )}
      >
        <Spinner className="size-6 text-primary" />
      </aside>
    );
  }

  if (!coworker) {
    return (
      <aside
        className={cn(
          'flex h-full w-full flex-col items-center justify-center p-8 bg-surface text-foreground text-center space-y-2',
          className,
        )}
      >
        <p className="text-xs text-muted-foreground">Coworker not found.</p>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        )}
      </aside>
    );
  }

  const handle = `@${coworker.name.toLowerCase().replace(/\s+/g, '')}`;
  const formattedJoinedDate = coworker.createdAt
    ? new Date(coworker.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const configuredCapabilities = (coworker.configuration as { capabilities?: unknown } | null)
    ?.capabilities;
  const capabilities: string[] = Array.isArray(configuredCapabilities)
    ? configuredCapabilities.filter((c): c is string => typeof c === 'string')
    : [...(getCoworkerTemplate(templateKey)?.capabilities ?? [])];

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: `Remove “${coworker.name}”?`,
      description:
        'The coworker, its schedules and monitors are removed from this workspace. This cannot be undone.',
      confirmLabel: 'Remove coworker',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await mutations.remove.mutateAsync(coworker.id);
      toast.success(`Removed coworker ${coworker.name}`);
      onClose?.();
    } catch {
      toast.error('Failed to remove coworker');
    }
  };

  const handleToggleActive = async () => {
    try {
      await mutations.update.mutateAsync({
        coworkerId: coworker.id,
        input: { isActive: !coworker.isActive },
      });
      toast.success(
        coworker.isActive ? 'Deactivated coworker' : 'Activated coworker',
      );
    } catch {
      toast.error('Failed to update coworker status');
    }
  };

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(handle);
    toast.success(`Copied handle ${handle}`);
  };

  return (
    <AIEntityProfilePanel
      title="Coworker Profile"
      onClose={onClose}
      className={className}
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="More actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(coworker)}>
                <Edit2 className="mr-2 size-3.5" />
                Edit Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleToggleActive}>
              <Zap className="mr-2 size-3.5" />
              {coworker.isActive ? 'Deactivate Coworker' : 'Activate Coworker'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyHandle}>
              <Copy className="mr-2 size-3.5" />
              Copy Handle
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete Coworker
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <AIEntityProfileHero
        avatar={
          <CoworkerAvatar
            name={coworker.name}
            avatarUrl={coworker.avatarUrl}
            status={coworker.status}
            size="lg"
            className="size-18 rounded-2xl shadow-md ring-4 ring-surface"
          />
        }
        coverClassName={getGradientByName(coworker.name)}
        name={coworker.name}
        kind="AI Coworker"
        isActive={coworker.isActive}
        handle={handle}
        onCopyHandle={handleCopyHandle}
        subtitle={coworker.role}
        actions={
          <>
            {onStartChat && (
              <Button size="sm" className="flex-1 gap-1.5" onClick={() => onStartChat(coworker)}>
                <Play className="size-3.5 fill-current" />
                Direct Message
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => onEdit(coworker)}
              >
                <Edit2 className="size-3.5" />
                Edit
              </Button>
            )}
          </>
        }
      />

      <AIEntityProfileFacts>
        <AIEntityProfileFact icon={Clock} label="Joined on">
          {formattedJoinedDate}
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={Cpu} label="Model & Provider">
          {coworker.model ? (
            <AIModelIdentity
              modelId={coworker.model}
              provider={coworker.provider}
              layout="stacked"
              className="items-end text-right"
            />
          ) : (
            <span className="text-muted-foreground">Workspace default</span>
          )}
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={Shield} label="Knowledge Access">
          <Badge
            variant={coworker.permissions?.knowledgeAccess ? 'primary' : 'neutral'}
            className="text-[10px]"
          >
            {coworker.permissions?.knowledgeAccess ? 'RAG Enabled' : 'Restricted'}
          </Badge>
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={Bot} label="Sub-Agents">
          {coworker.agentLinks?.length ?? 0} delegated
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={Plug} label="Connected Apps">
          {coworker.appLinks?.length ?? 0} active
        </AIEntityProfileFact>
      </AIEntityProfileFacts>

      {coworker.description && (
        <AIEntityProfileSection icon={UserCheck} title="About">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
            {coworker.description}
          </p>
        </AIEntityProfileSection>
      )}

      {coworker.personality && (
        <AIEntityProfileSection icon={Brain} title="Persona & Tone">
          <AIEntityProfileQuote>
            <span className="italic">“{coworker.personality}”</span>
          </AIEntityProfileQuote>
        </AIEntityProfileSection>
      )}

      {coworker.systemInstructions && (
        <AIEntityProfileSection icon={Brain} title="System Instructions">
          <AIEntityProfileQuote mono>{coworker.systemInstructions}</AIEntityProfileQuote>
        </AIEntityProfileSection>
      )}

      {capabilities.length > 0 && (
        <AIEntityProfileSection icon={Check} title="Capabilities" count={capabilities.length}>
          <ul className="space-y-1.5">
            {capabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </AIEntityProfileSection>
      )}

      {(coworker.agentLinks?.length ?? 0) > 0 && (
        <AIEntityProfileSection icon={Bot} title="Sub-Agents" count={coworker.agentLinks?.length}>
          <div className="space-y-1.5">
            {coworker.agentLinks?.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-2.5 text-xs"
              >
                <Bot className="size-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{link.agent.name}</p>
                  {link.agent.role && (
                    <p className="truncate text-[11px] text-muted-foreground">{link.agent.role}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </AIEntityProfileSection>
      )}

      {(coworker.appLinks?.length ?? 0) > 0 && (
        <AIEntityProfileSection icon={Plug} title="Connected Apps" count={coworker.appLinks?.length}>
          <div className="flex flex-wrap gap-1.5">
            {coworker.appLinks?.map((link) => (
              <Badge key={link.id} variant="neutral" className="gap-1 text-[11px] capitalize">
                <Layers className="size-3" />
                {link.integration.displayName || link.integration.provider}
              </Badge>
            ))}
          </div>
        </AIEntityProfileSection>
      )}

      {isTracker && (
        <AIEntityProfileSection icon={Activity} title="Active Monitors" count={monitors?.length ?? 0}>
          {monitors && monitors.length > 0 ? (
            <div className="space-y-1.5">
              {monitors.map((m: TrackerMonitor) => (
                <div key={m.id} className="rounded-lg border border-border bg-surface p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{m.name ?? m.target}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={m.enabled ? 'primary' : 'neutral'} className="px-1 py-0 text-[9px]">
                        {m.enabled ? (m.frequency ?? 'hourly') : 'paused'}
                      </Badge>
                      {canManageMonitor(m, coworker.creatorId) ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Check “${m.name ?? m.target}” now`}
                          title="Check now"
                          disabled={monitorMutations.check.isPending}
                          onClick={() => void handleCheckMonitor(m)}
                        >
                          <RefreshCw
                            className={cn(
                              'size-3',
                              monitorMutations.check.isPending &&
                                monitorMutations.check.variables === m.id &&
                                'animate-spin',
                            )}
                          />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Watches {m.target} for “{m.condition}”
                    {m.destinations?.length ? ` · tells ${m.destinations.join(', ')}` : ''}
                  </p>
                  {m.lastError ? (
                    <p className="mt-1 text-[11px] text-destructive">{m.lastError}</p>
                  ) : m.lastResult ? (
                    <p className="mt-1 text-[11px] text-foreground/80">
                      {m.lastResult.count > 0 ? m.lastResult.summary : 'Last check: nothing to report'}
                      {m.lastCheckedAt ? (
                        <span className="text-muted-foreground"> · {formatRelative(m.lastCheckedAt)}</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">Not checked yet — first check within 5 minutes.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <AIEntityProfileEmpty>No active monitors configured.</AIEntityProfileEmpty>
          )}
        </AIEntityProfileSection>
      )}

      {isScheduler && (
        <AIEntityProfileSection icon={Clock} title="Active Schedules" count={schedules?.length ?? 0}>
          {schedules && schedules.length > 0 ? (
            <div className="space-y-1.5">
              {schedules.map((s: AgentSchedule) => (
                <div key={s.id} className="rounded-lg border border-border bg-surface p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium">{s.cronExpression}</span>
                    <Badge variant={s.isActive ? 'primary' : 'neutral'} className="px-1 py-0 text-[9px]">
                      {s.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  {s.description && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <AIEntityProfileEmpty>No active schedules configured.</AIEntityProfileEmpty>
          )}
        </AIEntityProfileSection>
      )}

      <AIEntityProfileSection
        icon={Activity}
        title="Recent Runs"
        count={`${coworker._count?.executionLogs ?? logs?.length ?? 0} runs`}
      >
        <AIEntityProfileRunList
          loading={logsLoading}
          emptyText="No runs recorded yet."
          runs={(logs ?? []).slice(0, 5).map((log) => ({
            id: log.id,
            // Logs are written SUCCESS / FAILED.
            failed: log.status === 'FAILED',
            title: log.promptText || 'Task execution',
            output: log.outputResult,
            tokens: log.tokensUsed,
            at: log.executedAt,
          }))}
        />
      </AIEntityProfileSection>
    </AIEntityProfilePanel>
  );
};

export interface CoworkerProfileDetailsProps {
  coworker: AICoworkerDetail;
  workspaceId: string;
  onEdit?: (coworker: AICoworkerDetail) => void;
  onStartChat?: (coworker: AICoworkerDetail) => void;
  className?: string;
}

/**
 * CoworkerProfileDetails — Full-page Profile View matching ProfileDetails style:
 * 2-column info cards, cover banner, overlapping avatar, handle, role badge, permissions, and tools.
 */
export const CoworkerProfileDetails: FC<CoworkerProfileDetailsProps> = ({
  coworker,
  workspaceId,
  onEdit,
  onStartChat,
  className,
}) => {
  const mutations = useCoworkerMutations(workspaceId);
  const { data: logs } = useCoworkerLogs(workspaceId, coworker.id);
  const [copied, setCopied] = useState(false);

  const handle = `@${coworker.name.toLowerCase().replace(/\s+/g, '')}`;
  const formattedJoinedDate = coworker.createdAt
    ? new Date(coworker.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Coworker profile link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlinkAgent = async (agentId: string) => {
    try {
      await mutations.unlinkAgent.mutateAsync({
        coworkerId: coworker.id,
        agentId,
      });
      toast.success('Unlinked sub-agent');
    } catch {
      toast.error('Failed to unlink agent');
    }
  };

  const handleUnlinkApp = async (integrationId: string) => {
    try {
      await mutations.unlinkApp.mutateAsync({
        coworkerId: coworker.id,
        integrationId,
      });
      toast.success('Unlinked integration');
    } catch {
      toast.error('Failed to unlink integration');
    }
  };

  return (
    <div className={cn('w-full max-w-5xl mx-auto space-y-6 pb-12', className)}>
      {/* Profile Header Card with Cover and Overlapping Avatar */}
      <div className="rounded-2xl border border-border bg-surface text-foreground shadow-xs overflow-hidden">
        {/* Cover Header Banner */}
        <div
          className={cn(
            'h-32 sm:h-44 w-full bg-gradient-to-br',
            getGradientByName(coworker.name),
          )}
        />

        {/* Identity & Actions Bar */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="-mt-14 sm:-mt-16 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Avatar & Core Identity */}
            <div className="flex items-end gap-4">
              <div className="relative">
                <CoworkerAvatar
                  name={coworker.name}
                  avatarUrl={coworker.avatarUrl}
                  status={coworker.status}
                  size="xl"
                  className="size-24 sm:size-28 rounded-full shadow-xl ring-4 ring-surface"
                />
              </div>

              <div className="space-y-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {coworker.name}
                  </h2>
                  <Badge variant="primary" className="text-[10px] uppercase font-bold tracking-wider">
                    AI COWORKER
                  </Badge>
                  <Badge
                    variant={coworker.isActive ? 'secondary' : 'outline'}
                    className="text-[10px] font-semibold"
                  >
                    {coworker.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{handle}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onStartChat && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onStartChat(coworker)}
                  className="text-xs font-semibold gap-1.5 shadow-sm px-4"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>Direct Message</span>
                </Button>
              )}

              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(coworker)}
                  className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
                >
                  <Edit2 className="size-3.5" />
                  <span>Edit Profile</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleCopyLink}
                className="size-8 border-border bg-surface hover:bg-accent"
                title="Copy profile link"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>

          {/* Quick Meta Chips */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground border-t border-border/60">
            <div className="flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-primary" />
              <span className="font-medium text-foreground">{coworker.role}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AIModelBadge
                modelId={coworker.model || 'gpt-4o'}
                provider={coworker.provider || 'openai'}
                variant="subtle"
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid of Structured Cards (Exact ProfileDetails Pattern) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-foreground">
        {/* Box 1: About & Bio */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="size-3.5 text-primary" />
            <span>About Coworker</span>
          </h3>
          <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {coworker.description || 'Persistent AI coworker operating inside your workspace projects and channels.'}
          </p>

          {coworker.personality && (
            <div className="pt-3 border-t border-border/60">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Brain className="size-3 text-primary" />
                <span>Persona &amp; Demeanor</span>
              </h4>
              <p className="text-xs italic text-muted-foreground bg-muted/40 rounded-lg p-3">
                "{coworker.personality}"
              </p>
            </div>
          )}
        </div>

        {/* Box 2: Work & Teammate Standing */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="size-3.5 text-primary" />
            <span>Work &amp; Organization</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Role:</span>
              <Badge variant="primary" className="text-[10px] font-semibold">
                {coworker.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">System Standing:</span>
              <span className="font-mono text-muted-foreground">Autonomous AI Teammate</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Joined Workspace:</span>
              <span className="font-semibold text-foreground">{formattedJoinedDate}</span>
            </div>
          </div>
        </div>

        {/* Box 3: Permissions & Guardrails */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Shield className="size-3.5 text-primary" />
            <span>Permissions &amp; Capabilities</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Workspace Knowledge (RAG):</span>
              <Badge
                variant={coworker.permissions?.knowledgeAccess ? 'primary' : 'secondary'}
                className="text-[10px]"
              >
                {coworker.permissions?.knowledgeAccess ? 'Enabled' : 'Restricted'}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1.5">Action Capabilities:</span>
              <div className="flex flex-wrap gap-1.5">
                {(coworker.permissions?.allowActions ?? ['search_docs', 'list_projects', 'list_tasks']).map(
                  (action) => (
                    <Badge key={action} variant="neutral" className="font-mono text-[10px]">
                      {action}
                    </Badge>
                  ),
                )}
              </div>
            </div>
            {coworker.matrixRoomId && (
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-muted-foreground">Matrix Room:</span>
                <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {coworker.matrixRoomId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Box 4: System Directives & Telemetry Summary */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="size-3.5 text-primary" />
            <span>Availability &amp; System Directives</span>
          </h3>
          <div className="p-3 rounded-xl border border-border/80 bg-surface-raised space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Operational Availability</span>
              <Badge variant="success" className="text-[10px]">24/7 Always On</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono leading-relaxed line-clamp-3">
              {coworker.systemInstructions || 'Ready for proactive collaboration on workspace deliverables.'}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground">Total Execution Runs:</span>
            <span className="font-semibold text-foreground">{logs?.length ?? coworker._count?.executionLogs ?? 0}</span>
          </div>
        </div>

        {/* Box 5: Delegated Sub-Agents */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Bot className="size-3.5 text-primary" />
              <span>Delegated Sub-Agents ({coworker.agentLinks?.length ?? 0})</span>
            </h3>
          </div>

          {coworker.agentLinks?.length ? (
            <div className="space-y-2">
              {coworker.agentLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Bot className="size-4 text-violet-500 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-foreground truncate">{link.agent.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{link.agent.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleUnlinkAgent(link.agentId)}
                    title="Unlink agent"
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic rounded-xl border border-dashed border-border p-4 text-center">
              No sub-agents linked. Coworker operates independently.
            </p>
          )}
        </div>

        {/* Box 6: Connected Apps */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Plug className="size-3.5 text-primary" />
              <span>Connected Apps ({coworker.appLinks?.length ?? 0})</span>
            </h3>
          </div>

          {coworker.appLinks?.length ? (
            <div className="space-y-2">
              {coworker.appLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Layers className="size-4 text-sky-500 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-foreground truncate capitalize">
                        {link.integration.displayName || link.integration.provider}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Status: {link.integration.status}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleUnlinkApp(link.integrationId)}
                    title="Unlink integration"
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic rounded-xl border border-dashed border-border p-4 text-center">
              No apps connected. Coworker uses built-in tools.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export interface CoworkerProfileRightPanelProps {
  profile: RightPanelProfile;
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}

export const CoworkerProfileRightPanel: FC<CoworkerProfileRightPanelProps> = ({
  profile,
  workspaceId,
  workspaceSlug,
  onClose,
}) => {
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const effectiveId = profile.entityId || profile.userId.replace(/^coworker-/, '');
  const coworker = profile.raw as AICoworkerDetail | undefined;

  return (
    <>
      <CoworkerProfilePanel
        coworker={coworker}
        coworkerId={effectiveId}
        workspaceId={workspaceId}
        onClose={onClose}
        onEdit={() => setEditDialogOpen(true)}
        onStartChat={() => {
          navigate(`/w/${workspaceSlug}/coworkers/${effectiveId}`);
        }}
        className="w-full border-l-0 shadow-none"
      />
      {coworker && (
        <CoworkerCreateDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          workspaceId={workspaceId}
          coworker={coworker}
        />
      )}
    </>
  );
};


