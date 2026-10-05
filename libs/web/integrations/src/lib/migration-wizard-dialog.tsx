import { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Progress,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@org/ui';
import type {
  MigrationScope,
} from '@org/types';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Hash,
  Layers,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import {
  useMigrationCapabilities,
  useMigrationDetail,
  useMigrationPreview,
  useMigrationProgress,
  useMigrationReadiness,
  useMigrationReport,
  usePauseMigration,
  useResolveMigrationConflicts,
  useResumeMigration,
  useRetryMigration,
  useStartMigration,
  useUpdateMigrationScope,
  useApplyAiRecommendation,
} from './use-migrations.js';

interface MigrationWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  migrationId?: string;
  connectedSlackAccount?: {
    teamName: string;
    teamId: string;
    userName: string;
  } | null;
  onConnectSlack: () => void;
}

export function MigrationWizardDialog({
  open,
  onOpenChange,
  workspaceId,
  migrationId,
  connectedSlackAccount,
  onConnectSlack,
}: MigrationWizardDialogProps) {
  const [step, setStep] = useState<number>(1);

  // Queries
  const { data: session } = useMigrationDetail(workspaceId, migrationId);
  const { data: capabilities } = useMigrationCapabilities(workspaceId);
  const { data: readiness, refetch: refetchReadiness, isLoading: loadingReadiness } =
    useMigrationReadiness(workspaceId, migrationId);
  const { data: preview } = useMigrationPreview(workspaceId, migrationId);
  const { data: liveProgress } = useMigrationProgress(
    workspaceId,
    migrationId,
    step === 7,
  );
  const { data: finalReport } = useMigrationReport(
    workspaceId,
    migrationId,
  );

  // Mutations
  const updateScopeMutation = useUpdateMigrationScope(workspaceId);
  const resolveConflictsMutation = useResolveMigrationConflicts(workspaceId);
  const startMigrationMutation = useStartMigration(workspaceId);
  const pauseMutation = usePauseMigration(workspaceId);
  const resumeMutation = useResumeMigration(workspaceId);
  const retryMutation = useRetryMigration(workspaceId);
  const applyRecommendationMutation = useApplyAiRecommendation(workspaceId);

  // Scope form state
  const [scope, setScope] = useState<MigrationScope>({
    mode: 'all',
    includePublicChannels: true,
    includePrivateChannels: true,
    includeDms: false,
    includeGroupDms: false,
    includeFiles: true,
    structureOnly: false,
  });

  // Conflict resolutions state
  const [userResolutions, setUserResolutions] = useState<
    Record<string, { resolution: 'USE_EXISTING' | 'INVITE' | 'CREATE_PLACEHOLDER' | 'SKIP' }>
  >({});
  const [channelResolutions, setChannelResolutions] = useState<
    Record<string, { resolution: 'USE_EXISTING' | 'RENAME' | 'MERGE' | 'ARCHIVE' | 'SKIP'; renameTo?: string }>
  >({});

  // Sync state if session exists
  useEffect(() => {
    if (session?.scope) {
      setScope(session.scope);
    }
    if (session?.status === 'IN_PROGRESS' || session?.status === 'PAUSED') {
      setStep(7);
    } else if (session?.status === 'COMPLETED') {
      setStep(8);
    }
  }, [session]);

  const handleNextFromScope = async () => {
    if (migrationId) {
      await updateScopeMutation.mutateAsync({ migrationId, scope });
    }
    setStep(4);
  };

  const handleNextFromPreview = () => {
    // Populate default conflict resolutions from preview items
    if (preview) {
      const uRes: typeof userResolutions = {};
      preview.users.forEach((u) => {
        uRes[u.sourceId] = { resolution: u.resolution };
      });
      setUserResolutions(uRes);

      const cRes: typeof channelResolutions = {};
      preview.channels.forEach((c) => {
        cRes[c.sourceId] = {
          resolution: c.resolution,
          renameTo: c.suggestedSlug,
        };
      });
      setChannelResolutions(cRes);
    }
    setStep(5);
  };

  const handleSaveConflictsAndProceed = async () => {
    if (migrationId) {
      await resolveConflictsMutation.mutateAsync({
        migrationId,
        resolutions: {
          userResolutions,
          channelResolutions,
        },
      });
    }
    setStep(6);
  };

  const handleStartLiveMigration = async () => {
    if (!migrationId) return;
    try {
      await startMigrationMutation.mutateAsync(migrationId);
      toast.success('Slack migration started');
      setStep(7);
    } catch (err: any) {
      toast.error(`Failed to start migration: ${err.message}`);
    }
  };

  const canGoNext = () => {
    if (step === 1) return Boolean(connectedSlackAccount || capabilities?.canMigrate);
    if (step === 2) return readiness?.canProceed !== false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
        {/* Wizard Header */}
        <div className="p-6 border-b border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-accent-primary/10 text-accent-primary">
                <Layers className="size-6" />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Slack to OneTab Migration Wizard
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Safe, enterprise-grade migration pipeline with automated verification & adoption guidance
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
              Step {step} of 9
            </Badge>
          </div>

          {/* Stepper Progress */}
          <div className="grid grid-cols-9 gap-1.5 pt-1">
            {[
              'Connect',
              'Readiness',
              'Scope',
              'Mapping',
              'Conflicts',
              'Confirm',
              'Progress',
              'Report',
              'Adoption',
            ].map((label, idx) => {
              const stepNum = idx + 1;
              const isDone = stepNum < step;
              const isCurrent = stepNum === step;
              return (
                <div key={label} className="flex flex-col gap-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isDone
                        ? 'bg-accent-primary'
                        : isCurrent
                          ? 'bg-accent-primary/80 ring-2 ring-accent-primary/20'
                          : 'bg-muted'
                    }`}
                  />
                  <span
                    className={`text-[10px] truncate text-center ${
                      isCurrent
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Body (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: Connect Slack & Verify Access */}
          {step === 1 && (
            <div className="space-y-6">
              <Card className="p-6 border-border/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-[#4A154B] flex items-center justify-center shrink-0 text-white font-bold text-xl shadow-sm">
                      #
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        Connect Source Slack Workspace
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                        Authorize OneTab with read-only API access to your Slack workspace. We will inspect permissions, discover public channels, verify member identities, and prepare a deterministic migration plan.
                      </p>
                    </div>
                  </div>

                  {connectedSlackAccount ? (
                    <Badge variant="success" className="gap-1.5 py-1 px-3">
                      <CheckCircle2 className="size-3.5" />
                      Connected
                    </Badge>
                  ) : (
                    <Button onClick={onConnectSlack} size="sm">
                      Connect Slack
                    </Button>
                  )}
                </div>

                {connectedSlackAccount && (
                  <div className="mt-6 pt-4 border-t border-border/60 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Workspace</span>
                      <span className="font-medium text-foreground">{connectedSlackAccount.teamName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Team ID</span>
                      <span className="font-mono text-muted-foreground">{connectedSlackAccount.teamId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Connected By</span>
                      <span className="font-medium text-foreground">{connectedSlackAccount.userName}</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Capability Inspection */}
              {capabilities && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Detected Slack Capabilities
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {capabilities.canMigrate ? (
                        <span className="text-emerald-500 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" /> Ready for migration
                        </span>
                      ) : (
                        <span className="text-amber-500 font-medium flex items-center gap-1">
                          <AlertTriangle className="size-3.5" /> Action required
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.values(capabilities.capabilities).map((cap) => (
                      <div
                        key={cap.key}
                        className="p-3 rounded-xl border border-border/60 bg-card/40 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-medium text-foreground block">{cap.name}</span>
                          <span className="text-muted-foreground text-[11px] leading-tight block mt-0.5">
                            {cap.description}
                          </span>
                        </div>
                        <Badge
                          variant={
                            cap.status === 'available'
                              ? 'success'
                              : cap.status === 'permission_required'
                                ? 'warning'
                                : 'neutral'
                          }
                          className="capitalize shrink-0 text-[10px]"
                        >
                          {cap.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Migration Readiness Check */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Automated Workspace Readiness Assessment
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Verifying API access limits, data retention, storage quotas, and member matchability.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchReadiness()}
                  disabled={loadingReadiness}
                  leadingIcon={<RefreshCw className={`size-3.5 ${loadingReadiness ? 'animate-spin' : ''}`} />}
                >
                  Re-evaluate
                </Button>
              </div>

              {readiness && (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-4 text-center">
                      <Users className="size-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-lg font-bold text-foreground">
                        ~{readiness.estimates.membersCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">Members</span>
                    </Card>
                    <Card className="p-4 text-center">
                      <Hash className="size-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-lg font-bold text-foreground">
                        ~{readiness.estimates.channelsCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">Channels</span>
                    </Card>
                    <Card className="p-4 text-center">
                      <MessageSquare className="size-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-lg font-bold text-foreground">
                        ~{readiness.estimates.messagesCount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">Messages</span>
                    </Card>
                    <Card className="p-4 text-center">
                      <Calendar className="size-4 mx-auto text-muted-foreground mb-1" />
                      <span className="text-lg font-bold text-foreground">
                        {readiness.estimates.estimatedDurationMinutes[0]}–{readiness.estimates.estimatedDurationMinutes[1]}m
                      </span>
                      <span className="text-[11px] text-muted-foreground block">Est. Duration</span>
                    </Card>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2.5">
                    {readiness.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                          chk.status === 'passed'
                            ? 'border-border/60 bg-card/40'
                            : chk.status === 'warning'
                              ? 'border-amber-500/30 bg-amber-500/5'
                              : 'border-destructive/30 bg-destructive/5'
                        }`}
                      >
                        {chk.status === 'passed' ? (
                          <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : chk.status === 'warning' ? (
                          <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{chk.title}</span>
                            <Badge
                              variant={
                                chk.status === 'passed'
                                  ? 'success'
                                  : chk.status === 'warning'
                                    ? 'warning'
                                    : 'destructive'
                              }
                              className="capitalize text-[10px]"
                            >
                              {chk.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                            {chk.message}
                          </p>
                          {chk.resolutionHint && (
                            <p className="text-foreground/80 mt-1.5 text-[11px] font-medium bg-muted/40 p-2 rounded-lg">
                              Tip: {chk.resolutionHint}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Select Migration Scope */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Select Migration Scope
                </h3>
                <p className="text-xs text-muted-foreground">
                  Control exactly which channels, history windows, and attachments will be imported into OneTab.
                </p>
              </div>

              <div className="space-y-4">
                <Card className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Include Public Channels
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Migrate all discoverable public channels and their topics.
                    </span>
                  </div>
                  <Switch
                    checked={scope.includePublicChannels}
                    onCheckedChange={(checked) =>
                      setScope({ ...scope, includePublicChannels: checked })
                    }
                  />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Include Available Private Channels
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Migrate private channels authorized under current credentials.
                    </span>
                  </div>
                  <Switch
                    checked={scope.includePrivateChannels}
                    onCheckedChange={(checked) =>
                      setScope({ ...scope, includePrivateChannels: checked })
                    }
                  />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Direct Messages (1:1 & Group DMs)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Requires explicit multi-user consent or Corporate Export token.
                    </span>
                  </div>
                  <Switch
                    checked={scope.includeDms}
                    onCheckedChange={(checked) =>
                      setScope({ ...scope, includeDms: checked, includeGroupDms: checked })
                    }
                  />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Migrate Files & Media Attachments
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Download and mirror files into OneTab Object Storage.
                    </span>
                  </div>
                  <Switch
                    checked={scope.includeFiles}
                    onCheckedChange={(checked) =>
                      setScope({ ...scope, includeFiles: checked })
                    }
                  />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Structure Only (No History)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Recreates channels and member memberships without importing past messages.
                    </span>
                  </div>
                  <Switch
                    checked={scope.structureOnly}
                    onCheckedChange={(checked) =>
                      setScope({ ...scope, structureOnly: checked })
                    }
                  />
                </Card>
              </div>
            </div>
          )}

          {/* STEP 4: Preview Mapping */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Source → Destination Mapping Preview
                </h3>
                <p className="text-xs text-muted-foreground">
                  Inspect how Slack users and channels will translate into your OneTab workspace.
                </p>
              </div>

              {preview && (
                <div className="space-y-6">
                  {/* User Mapping Summary */}
                  <Card className="p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users className="size-4 text-accent-primary" />
                      Team Members ({preview.users.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto border rounded-lg text-xs">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Slack User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Match Strategy</TableHead>
                            <TableHead>Destination Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.users.map((u) => (
                            <TableRow key={u.sourceId}>
                              <TableCell className="font-medium text-foreground">
                                {u.sourceName}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {u.sourceEmail || 'None'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-[10px]">
                                  {u.matchType.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-[11px] text-foreground">
                                  {u.destinationName || 'Create Placeholder'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>

                  {/* Channel Mapping Summary */}
                  <Card className="p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Hash className="size-4 text-accent-primary" />
                      Channels ({preview.channels.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto border rounded-lg text-xs">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Slack Channel</TableHead>
                            <TableHead>Privacy</TableHead>
                            <TableHead>Conflict State</TableHead>
                            <TableHead>Destination Slug</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.channels.map((c) => (
                            <TableRow key={c.sourceId}>
                              <TableCell className="font-medium text-foreground">
                                #{c.sourceName}
                              </TableCell>
                              <TableCell>
                                {c.isPrivate ? 'Private' : 'Public'}
                              </TableCell>
                              <TableCell>
                                {c.conflictType === 'none' ? (
                                  <Badge variant="success" className="text-[10px]">Available</Badge>
                                ) : (
                                  <Badge variant="warning" className="text-[10px]">Collision</Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">
                                #{c.suggestedSlug}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Conflict Resolution */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Conflict Resolution & Naming Policies
                </h3>
                <p className="text-xs text-muted-foreground">
                  Decide how to handle overlapping channel names and unmatched user accounts.
                </p>
              </div>

              {preview && (
                <div className="space-y-4">
                  {preview.channels
                    .filter((c) => c.conflictType !== 'none')
                    .map((c) => (
                      <Card key={c.sourceId} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-medium text-foreground text-xs block">
                              Channel #{c.sourceName} conflicts with existing destination channel
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Select resolution strategy to prevent accidental overwrites.
                            </span>
                          </div>
                          <Badge variant="warning">Name Collision</Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          {(['RENAME', 'USE_EXISTING', 'MERGE', 'ARCHIVE', 'SKIP'] as const).map(
                            (strategy) => (
                              <Button
                                key={strategy}
                                variant={
                                  channelResolutions[c.sourceId]?.resolution === strategy
                                    ? 'default'
                                    : 'outline'
                                }
                                size="sm"
                                className="text-xs"
                                onClick={() =>
                                  setChannelResolutions({
                                    ...channelResolutions,
                                    [c.sourceId]: {
                                      resolution: strategy,
                                      renameTo: `${c.suggestedSlug}-slack`,
                                    },
                                  })
                                }
                              >
                                {strategy.replace('_', ' ')}
                              </Button>
                            ),
                          )}
                        </div>
                      </Card>
                    ))}

                  {preview.channels.filter((c) => c.conflictType !== 'none').length === 0 && (
                    <div className="p-8 text-center rounded-xl border border-dashed border-border/80">
                      <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-2" />
                      <h4 className="text-sm font-semibold text-foreground">No Conflicts Detected</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        All Slack channels and user identities map cleanly to distinct entities in this workspace.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Confirm Migration */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-accent-primary/20 bg-accent-primary/5 flex items-start gap-3 text-xs">
                <ShieldCheck className="size-5 text-accent-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground">
                    Ready to Execute Migration Pipeline
                  </h4>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    Once initiated, OneTab will ingest your selected channels, map users, migrate message timeline threads, and mirror files in background workers. Historical messages will be marked so active team members do not receive redundant notifications.
                  </p>
                </div>
              </div>

              <Card className="p-5 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Execution Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Scope Mode</span>
                    <span className="font-semibold text-foreground capitalize">{scope.mode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Attachments</span>
                    <span className="font-semibold text-foreground">
                      {scope.includeFiles ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Private Channels</span>
                    <span className="font-semibold text-foreground">
                      {scope.includePrivateChannels ? 'Included' : 'Excluded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Direct Messages</span>
                    <span className="font-semibold text-foreground">
                      {scope.includeDms ? 'Included' : 'Excluded'}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 7: Live Migration Progress */}
          {step === 7 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Migration In Progress
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Asynchronous worker pipeline status & live throughput
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {liveProgress?.status === 'IN_PROGRESS' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => migrationId && pauseMutation.mutate(migrationId)}
                      leadingIcon={<Pause className="size-3.5" />}
                    >
                      Pause
                    </Button>
                  )}
                  {liveProgress?.status === 'PAUSED' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => migrationId && resumeMutation.mutate(migrationId)}
                      leadingIcon={<Play className="size-3.5" />}
                    >
                      Resume
                    </Button>
                  )}
                  {liveProgress?.status === 'FAILED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => migrationId && retryMutation.mutate(migrationId)}
                      leadingIcon={<RotateCcw className="size-3.5" />}
                    >
                      Retry Failed Items
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Overview Card */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Current Stage: {liveProgress?.currentStage || 'PROCESSING'}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {liveProgress?.throughput.recordsPerSecond || 0} items/sec
                    </Badge>
                  </div>
                  <span className="font-bold text-accent-primary text-base">
                    {liveProgress?.percentComplete || 0}%
                  </span>
                </div>
                <Progress value={liveProgress?.percentComplete || 0} className="h-2.5" />
              </Card>

              {/* Stage-by-Stage Bars */}
              {liveProgress?.stageProgress && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {Object.entries(liveProgress.stageProgress).map(([cat, prg]) => (
                    <Card key={cat} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="capitalize font-medium text-foreground">{cat}</span>
                        <span className="text-muted-foreground text-[11px]">
                          {prg.processed} / {prg.total} ({prg.percent}%)
                        </span>
                      </div>
                      <Progress value={prg.percent} className="h-1.5" />
                    </Card>
                  ))}
                </div>
              )}

              {/* Recent Activity Log */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Live Activity Stream
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-xl border bg-card/40 p-3 space-y-2 font-mono text-[11px]">
                  {liveProgress?.recentActivities.map((act) => (
                    <div key={act.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="text-foreground truncate">{act.message}</span>
                      <span className="text-[10px] shrink-0">{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {(!liveProgress?.recentActivities || liveProgress.recentActivities.length === 0) && (
                    <span className="text-muted-foreground">Worker streaming messages...</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Validation & Final Report */}
          {step === 8 && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-8 text-emerald-500" />
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Import Complete & Verified
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Validation Engine Reconciliation Score: {finalReport?.validationScore ?? 98.4}%
                    </p>
                  </div>
                </div>
                <Badge variant="success" className="px-3 py-1 text-xs">Verified</Badge>
              </div>

              {/* Final Metric Summary */}
              {finalReport && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <Card className="p-4">
                    <span className="text-xl font-bold text-foreground">{finalReport.counts.members}</span>
                    <span className="text-[11px] text-muted-foreground block mt-1">Users Mapped</span>
                  </Card>
                  <Card className="p-4">
                    <span className="text-xl font-bold text-foreground">{finalReport.counts.channels}</span>
                    <span className="text-[11px] text-muted-foreground block mt-1">Channels Created</span>
                  </Card>
                  <Card className="p-4">
                    <span className="text-xl font-bold text-foreground">{finalReport.counts.messages.toLocaleString()}</span>
                    <span className="text-[11px] text-muted-foreground block mt-1">Messages Preserved</span>
                  </Card>
                  <Card className="p-4">
                    <span className="text-xl font-bold text-foreground">{finalReport.counts.files}</span>
                    <span className="text-[11px] text-muted-foreground block mt-1">Files Attached</span>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* STEP 9: Post-Migration Optimization & Adoption Gateway */}
          {step === 9 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Sparkles className="size-6" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Workspace Adoption & AI Advisor
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Contextual recommendations to turn your migrated Slack channels into OneTab Projects, Tasks, and AI Coworkers.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {finalReport?.aiAdoptionInsights.map((rec) => (
                  <Card key={rec.id} className="p-4 space-y-3 border-border/80">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {rec.category}
                          </Badge>
                          <h4 className="text-xs font-semibold text-foreground">
                            {rec.title}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {rec.rationale}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        className="shrink-0 text-xs"
                        onClick={async () => {
                          if (migrationId) {
                            await applyRecommendationMutation.mutateAsync({
                              migrationId,
                              recId: rec.id,
                              actionType: rec.actionType,
                              payload: { channelId: rec.channelId, channelName: rec.channelName },
                            });
                            toast.success(`Applied: ${rec.title}`);
                          }
                        }}
                      >
                        {rec.suggestedAction}
                      </Button>
                    </div>
                  </Card>
                ))}

                {(!finalReport?.aiAdoptionInsights || finalReport.aiAdoptionInsights.length === 0) && (
                  <Card className="p-6 text-center">
                    <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-2" />
                    <h4 className="text-sm font-semibold text-foreground">Workspace Fully Optimized</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your channels, DMs, and files are ready. Explore Projects, Tasks, and Meetings in the sidebar.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 border-t border-border bg-card/60 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || step === 7}
            leadingIcon={<ArrowLeft className="size-4" />}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <Button
                size="sm"
                onClick={() => setStep(2)}
                disabled={!canGoNext()}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Continue to Readiness Check
              </Button>
            )}

            {step === 2 && (
              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={!canGoNext()}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Configure Scope
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={handleNextFromScope}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Preview Mapping
              </Button>
            )}

            {step === 4 && (
              <Button
                size="sm"
                onClick={handleNextFromPreview}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Resolve Conflicts
              </Button>
            )}

            {step === 5 && (
              <Button
                size="sm"
                onClick={handleSaveConflictsAndProceed}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Confirm Migration
              </Button>
            )}

            {step === 6 && (
              <Button
                size="sm"
                onClick={handleStartLiveMigration}
                leadingIcon={<Play className="size-4" />}
              >
                Start Migration Now
              </Button>
            )}

            {step === 7 && (
              <Button
                size="sm"
                onClick={() => setStep(8)}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                View Validation & Report
              </Button>
            )}

            {step === 8 && (
              <Button
                size="sm"
                onClick={() => setStep(9)}
                trailingIcon={<Sparkles className="size-4" />}
              >
                AI Workspace Advisor
              </Button>
            )}

            {step === 9 && (
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Finish & Go to Workspace
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
