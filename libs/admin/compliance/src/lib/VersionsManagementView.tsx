import type {
  AppOperatingSystem,
  AppPlatform,
  AppReleaseChannel,
  AppReleaseStatus,
  AppReleaseView,
} from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@org/ui';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Globe,
  History,
  Layers,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  ShieldAlert,
  Sliders,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useAppVersionsAuditLogs,
  useAppVersionsList,
  useAppVersionsMutations,
  useAppVersionsOverview,
} from './use-app-versions.js';

// Status badge styling helper
function getStatusBadge(status: AppReleaseStatus | 'NOT_CONFIGURED', isCurrent?: boolean) {
  if (isCurrent) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3" />
        Active (Current)
      </Badge>
    );
  }
  switch (status) {
    case 'RELEASED':
      return <Badge variant="secondary">Released</Badge>;
    case 'SCHEDULED':
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="size-3" />
          Scheduled
        </Badge>
      );
    case 'DRAFT':
      return <Badge variant="outline">Draft</Badge>;
    case 'DEPRECATED':
      return <Badge variant="destructive">Deprecated</Badge>;
    case 'DISABLED':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertOctagon className="size-3" />
          Disabled
        </Badge>
      );
    default:
      return <Badge variant="outline">Not Configured</Badge>;
  }
}

function getPlatformIcon(platform: AppPlatform, os?: AppOperatingSystem | null) {
  if (platform === 'WEB') {
    return <Globe className="size-4 text-accent-blue" />;
  }
  if (os === 'WINDOWS') {
    return <Monitor className="size-4 text-accent-cyan" />;
  }
  if (os === 'MACOS') {
    return <Layers className="size-4 text-accent-pink" />;
  }
  return <Terminal className="size-4 text-warning" />;
}

export function VersionsManagementView() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'create' | 'audit'>('overview');

  // Filters state
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [osFilter, setOsFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Queries
  const overviewQuery = useAppVersionsOverview();
  const listQuery = useAppVersionsList({
    platform: platformFilter === 'ALL' ? undefined : (platformFilter as AppPlatform),
    operatingSystem: osFilter === 'ALL' ? undefined : (osFilter as AppOperatingSystem),
    releaseChannel: channelFilter === 'ALL' ? undefined : (channelFilter as AppReleaseChannel),
    status: statusFilter === 'ALL' ? undefined : (statusFilter as AppReleaseStatus),
    q: searchQuery.trim() || undefined,
    page,
    pageSize: 15,
  });
  const auditLogsQuery = useAppVersionsAuditLogs({
    platform: platformFilter === 'ALL' ? undefined : (platformFilter as AppPlatform),
    page: 1,
    pageSize: 30,
  });

  const mutations = useAppVersionsMutations();

  // Create Form State
  const [createPlatform, setCreatePlatform] = useState<AppPlatform>('DESKTOP');
  const [createOs, setCreateOs] = useState<AppOperatingSystem>('WINDOWS');
  const [createVersion, setCreateVersion] = useState('');
  const [createBuildNumber, setCreateBuildNumber] = useState('');
  const [createChannel, setCreateChannel] = useState<AppReleaseChannel>('STABLE');
  const [createStatus, setCreateStatus] = useState<AppReleaseStatus>('DRAFT');
  const [createMinVersion, setCreateMinVersion] = useState('1.0.0');
  const [createReleaseDate, setCreateReleaseDate] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [createRollout, setCreateRollout] = useState(100);
  const [createDownloadUrl, setCreateDownloadUrl] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createChangelog, setCreateChangelog] = useState('');
  const [createMandatory, setCreateMandatory] = useState(false);
  const [createForce, setCreateForce] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Dialogs state
  const [detailsRelease, setDetailsRelease] = useState<AppReleaseView | null>(null);
  const [releaseToPromote, setReleaseToPromote] = useState<AppReleaseView | null>(null);
  const [releaseReason, setReleaseReason] = useState('');

  const [releaseToSchedule, setReleaseToSchedule] = useState<AppReleaseView | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleRollout, setScheduleRollout] = useState(100);

  const [releaseToRollout, setReleaseToRollout] = useState<AppReleaseView | null>(null);
  const [newRolloutPercent, setNewRolloutPercent] = useState(100);

  const [releaseToRollback, setReleaseToRollback] = useState<AppReleaseView | null>(null);
  const [rollbackTargetId, setRollbackTargetId] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');

  const [editRelease, setEditRelease] = useState<AppReleaseView | null>(null);
  const [editDownloadUrl, setEditDownloadUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMinSupported, setEditMinSupported] = useState('');
  const [editMandatory, setEditMandatory] = useState(false);

  // Quick action confirmation states
  const [actionInProgress, setActionInProgress] = useState(false);

  const overview = overviewQuery.data;
  const releases = listQuery.data?.items ?? [];
  const pagination = listQuery.data;
  const auditLogs = auditLogsQuery.data?.items ?? [];

  // Reset form
  const resetCreateForm = () => {
    setCreateVersion('');
    setCreateBuildNumber('');
    setCreateMinVersion('1.0.0');
    setCreateDownloadUrl('');
    setCreateNotes('');
    setCreateChangelog('');
    setCreateMandatory(false);
    setCreateForce(false);
    setCreateRollout(100);
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!createVersion.trim()) {
      setFormError('Version string is required (e.g. 2.8.5).');
      return;
    }
    if (!createBuildNumber.trim()) {
      setFormError('Build number is required (e.g. 2026.09.1).');
      return;
    }

    try {
      await mutations.createRelease.mutateAsync({
        platform: createPlatform,
        operatingSystem: createPlatform === 'DESKTOP' ? createOs : null,
        version: createVersion.trim(),
        buildNumber: createBuildNumber.trim(),
        releaseChannel: createChannel,
        status: createStatus,
        minimumSupportedVersion: createMinVersion.trim() || '1.0.0',
        releaseDate: new Date(createReleaseDate).toISOString(),
        rolloutPercentage: Number(createRollout),
        downloadUrl: createDownloadUrl.trim() || null,
        releaseNotes: createNotes.trim() || null,
        changelog: createChangelog.trim() || null,
        mandatoryUpdate: createMandatory,
        forceUpdate: createForce,
      });

      resetCreateForm();
      setActiveTab('history');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create release');
    }
  };

  // Potential rollback targets for the selected active release
  const eligibleRollbackTargets = useMemo(() => {
    if (!releaseToRollback) return [];
    return releases.filter(
      (r) =>
        r.id !== releaseToRollback.id &&
        r.platform === releaseToRollback.platform &&
        r.operatingSystem === releaseToRollback.operatingSystem &&
        r.releaseChannel === releaseToRollback.releaseChannel &&
        (r.status === 'RELEASED' || r.status === 'DEPRECATED'),
    );
  }, [releaseToRollback, releases]);

  return (
    <Page>
      <PageHeader
        title="Application Versions & Releases"
        description="Unified release lifecycle control, instant rollout governance, and client version validation for Web and Desktop (Windows, macOS, Linux)."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void overviewQuery.refetch();
                void listQuery.refetch();
                void auditLogsQuery.refetch();
              }}
              disabled={overviewQuery.isFetching || listQuery.isFetching}
              className="gap-1.5"
            >
              <RefreshCw
                className={`size-3.5 ${overviewQuery.isFetching ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetCreateForm();
                setActiveTab('create');
              }}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Create Release</span>
            </Button>
          </div>
        }
      />

      {/* Overview Metrics Cards */}
      {overviewQuery.isLoading ? (
        <LoadingState />
      ) : overviewQuery.isError ? (
        <ErrorState
          title="Could not load version metrics"
          description={overviewQuery.error?.message}
        />
      ) : overview ? (
        <div className="space-y-6">
          {/* Top Quick Status Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" />
                Active Releases
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground tabular-nums">
                {overview.metrics.activeReleases}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="size-3.5 text-warning" />
                Scheduled
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground tabular-nums">
                {overview.metrics.scheduledReleases}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <ShieldAlert className="size-3.5 text-destructive" />
                Mandatory Updates
              </div>
              <div className="text-2xl font-bold mt-1 text-destructive tabular-nums">
                {overview.metrics.mandatoryReleases}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <AlertOctagon className="size-3.5 text-muted-foreground" />
                Deprecated
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground tabular-nums">
                {overview.metrics.deprecatedReleases}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <XCircle className="size-3.5 text-destructive" />
                Disabled
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground tabular-nums">
                {overview.metrics.disabledReleases}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Layers className="size-3.5 text-accent-blue" />
                Total Managed
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground tabular-nums">
                {overview.metrics.totalReleases}
              </div>
            </Card>
          </div>

          {/* Unified Platform Health & Version Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Web App */}
            <Card className="relative overflow-hidden border-sidebar-border">
              <div className="h-1 w-full bg-accent-blue absolute top-0 left-0" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-accent-blue/10 flex items-center justify-center">
                      <Globe className="size-4 text-accent-blue" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Web Application</CardTitle>
                      <CardDescription className="text-xs">Browser & PWA Clients</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(overview.web.status, true)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Current Production:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {overview.web.currentVersion ?? 'None'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Latest Release:</span>
                  <span className="font-mono">{overview.web.latestVersion ?? 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Minimum Supported:</span>
                  <span className="font-mono">{overview.web.minimumSupportedVersion ?? '1.0.0'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Deployment:</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">Live Production</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Desktop: Windows */}
            <Card className="relative overflow-hidden border-sidebar-border">
              <div className="h-1 w-full bg-accent-cyan absolute top-0 left-0" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-accent-cyan/10 flex items-center justify-center">
                      <Monitor className="size-4 text-accent-cyan" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Windows Desktop</CardTitle>
                      <CardDescription className="text-xs">Win32 / MSIX Package</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(overview.desktop.windows.status, true)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Current Version:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {overview.desktop.windows.currentVersion ?? 'None'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Latest Build:</span>
                  <span className="font-mono">{overview.desktop.windows.latestVersion ?? 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Minimum Supported:</span>
                  <span className="font-mono">{overview.desktop.windows.minimumSupportedVersion ?? '1.0.0'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Rollout:</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {overview.desktop.windows.rolloutPercentage}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Desktop: macOS */}
            <Card className="relative overflow-hidden border-sidebar-border">
              <div className="h-1 w-full bg-accent-pink absolute top-0 left-0" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-accent-pink/10 flex items-center justify-center">
                      <Layers className="size-4 text-accent-pink" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">macOS Desktop</CardTitle>
                      <CardDescription className="text-xs">DMG / Mac App Store</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(overview.desktop.macos.status, true)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Current Version:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {overview.desktop.macos.currentVersion ?? 'None'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Latest Build:</span>
                  <span className="font-mono">{overview.desktop.macos.latestVersion ?? 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Minimum Supported:</span>
                  <span className="font-mono">{overview.desktop.macos.minimumSupportedVersion ?? '1.0.0'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Rollout:</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {overview.desktop.macos.rolloutPercentage}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Desktop: Linux */}
            <Card className="relative overflow-hidden border-sidebar-border">
              <div className="h-1 w-full bg-warning absolute top-0 left-0" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-warning/10 flex items-center justify-center">
                      <Terminal className="size-4 text-warning" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Linux Desktop</CardTitle>
                      <CardDescription className="text-xs">AppImage / Deb / RPM</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(overview.desktop.linux.status, true)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Current Version:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {overview.desktop.linux.currentVersion ?? 'None'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Latest Build:</span>
                  <span className="font-mono">{overview.desktop.linux.latestVersion ?? 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Minimum Supported:</span>
                  <span className="font-mono">{overview.desktop.linux.minimumSupportedVersion ?? '1.0.0'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Rollout:</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {overview.desktop.linux.rolloutPercentage}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="mt-6 space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <Layers className="size-3.5" />
            History & Table
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            New Release
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <History className="size-3.5" />
            Audit Ledger
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: HISTORY TABLE & MANAGEMENT */}
        <TabsContent value="overview" className="space-y-4">
          {/* Filters Row */}
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search version, build, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={platformFilter}
                  onValueChange={(v) => {
                    setPlatformFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px] text-xs h-8">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Platforms</SelectItem>
                    <SelectItem value="WEB">Web</SelectItem>
                    <SelectItem value="DESKTOP">Desktop</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={osFilter}
                  onValueChange={(v) => {
                    setOsFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[110px] text-xs h-8">
                    <SelectValue placeholder="OS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All OS</SelectItem>
                    <SelectItem value="WINDOWS">Windows</SelectItem>
                    <SelectItem value="MACOS">macOS</SelectItem>
                    <SelectItem value="LINUX">Linux</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={channelFilter}
                  onValueChange={(v) => {
                    setChannelFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[110px] text-xs h-8">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Channels</SelectItem>
                    <SelectItem value="STABLE">Stable</SelectItem>
                    <SelectItem value="BETA">Beta</SelectItem>
                    <SelectItem value="ALPHA">Alpha</SelectItem>
                    <SelectItem value="NIGHTLY">Nightly</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px] text-xs h-8">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="RELEASED">Released</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                    <SelectItem value="DISABLED">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card>
            {listQuery.isLoading ? (
              <div className="p-8">
                <LoadingState />
              </div>
            ) : releases.length === 0 ? (
              <EmptyState
                title="No releases match your criteria"
                description="Try resetting your filters or register a new version release."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPlatformFilter('ALL');
                      setOsFilter('ALL');
                      setChannelFilter('ALL');
                      setStatusFilter('ALL');
                      setSearchQuery('');
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Platform / OS</TableHead>
                    <TableHead className="w-[150px]">Version & Build</TableHead>
                    <TableHead className="w-[90px]">Channel</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[120px]">Release Date</TableHead>
                    <TableHead className="w-[100px]">Rollout %</TableHead>
                    <TableHead className="w-[100px]">Min Supported</TableHead>
                    <TableHead className="w-[100px]">Mandatory</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((rel) => (
                    <TableRow key={rel.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium text-xs">
                          {getPlatformIcon(rel.platform, rel.operatingSystem)}
                          <span>
                            {rel.platform === 'WEB'
                              ? 'Web'
                              : rel.operatingSystem ?? 'Desktop'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs font-mono flex items-center gap-1.5">
                            v{rel.version}
                            {rel.isCurrent && (
                              <Badge variant="success" className="text-[10px] py-0 px-1">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            Build {rel.buildNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {rel.releaseChannel}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(rel.status, rel.isCurrent)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(rel.releaseDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold tabular-nums">
                            {rel.rolloutPercentage}%
                          </span>
                          <Progress value={rel.rolloutPercentage} className="h-1.5 w-16" />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        v{rel.minimumSupportedVersion || '1.0.0'}
                      </TableCell>
                      <TableCell>
                        {rel.mandatoryUpdate ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Mandatory
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="View Release Details"
                            onClick={() => setDetailsRelease(rel)}
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {/* Quick Release Action */}
                          {rel.status !== 'RELEASED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Release Now"
                              onClick={() => {
                                setReleaseToPromote(rel);
                                setReleaseReason('');
                              }}
                              className="text-xs h-7 px-2 gap-1 text-success hover:text-success"
                            >
                              <Rocket className="size-3" />
                              <span className="hidden lg:inline">Release</span>
                            </Button>
                          )}

                          {/* Schedule Release */}
                          {rel.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Schedule Release"
                              onClick={() => {
                                setReleaseToSchedule(rel);
                                setScheduleDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
                                setScheduleRollout(rel.rolloutPercentage);
                              }}
                            >
                              <Clock className="size-3.5 text-warning" />
                            </Button>
                          )}

                          {/* Rollout Slider Action */}
                          {rel.status === 'RELEASED' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Manage Rollout Percentage"
                              onClick={() => {
                                setReleaseToRollout(rel);
                                setNewRolloutPercent(rel.rolloutPercentage);
                              }}
                            >
                              <Sliders className="size-3.5 text-accent-blue" />
                            </Button>
                          )}

                          {/* Rollback Action */}
                          {rel.status === 'RELEASED' && rel.isCurrent && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Rollback Active Version"
                              onClick={() => {
                                setReleaseToRollback(rel);
                                setRollbackTargetId('');
                                setRollbackReason('');
                              }}
                            >
                              <RotateCcw className="size-3.5 text-warning" />
                            </Button>
                          )}

                          {/* Edit Details */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Edit Release Details"
                            onClick={() => {
                              setEditRelease(rel);
                              setEditDownloadUrl(rel.downloadUrl ?? '');
                              setEditNotes(rel.releaseNotes ?? '');
                              setEditMinSupported(rel.minimumSupportedVersion ?? '1.0.0');
                              setEditMandatory(rel.mandatoryUpdate);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t text-xs">
                <span className="text-muted-foreground">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total releases)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: CREATE NEW VERSION FORM */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Register New Version Release</CardTitle>
              <CardDescription className="text-xs">
                Create a version record for deployment staging, scheduled launch, or immediate active availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Target Platform</Label>
                    <Select
                      value={createPlatform}
                      onValueChange={(v) => setCreatePlatform(v as AppPlatform)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DESKTOP">Desktop Client</SelectItem>
                        <SelectItem value="WEB">Web Application</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {createPlatform === 'DESKTOP' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Operating System</Label>
                      <Select
                        value={createOs}
                        onValueChange={(v) => setCreateOs(v as AppOperatingSystem)}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WINDOWS">Windows (.exe / .msix)</SelectItem>
                          <SelectItem value="MACOS">macOS (.dmg / .pkg)</SelectItem>
                          <SelectItem value="LINUX">Linux (.AppImage / .deb)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Version (SemVer)</Label>
                    <Input
                      placeholder="e.g. 2.8.5"
                      value={createVersion}
                      onChange={(e) => setCreateVersion(e.target.value)}
                      className="text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Build Number / ID</Label>
                    <Input
                      placeholder="e.g. 2026.09.1"
                      value={createBuildNumber}
                      onChange={(e) => setCreateBuildNumber(e.target.value)}
                      className="text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Release Channel</Label>
                    <Select
                      value={createChannel}
                      onValueChange={(v) => setCreateChannel(v as AppReleaseChannel)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STABLE">Stable (Production)</SelectItem>
                        <SelectItem value="BETA">Beta (Early Preview)</SelectItem>
                        <SelectItem value="ALPHA">Alpha (Internal)</SelectItem>
                        <SelectItem value="NIGHTLY">Nightly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Initial Lifecycle Status</Label>
                    <Select
                      value={createStatus}
                      onValueChange={(v) => setCreateStatus(v as AppReleaseStatus)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft (Staged)</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                        <SelectItem value="RELEASED">Released (Immediate Active)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Minimum Supported Client Version</Label>
                    <Input
                      placeholder="e.g. 2.7.0"
                      value={createMinVersion}
                      onChange={(e) => setCreateMinVersion(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Initial Rollout (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={createRollout}
                      onChange={(e) => setCreateRollout(Number(e.target.value))}
                      className="text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Release Date {createStatus === 'SCHEDULED' ? '(scheduled)' : ''}
                    </Label>
                    <Input
                      type="datetime-local"
                      value={createReleaseDate}
                      onChange={(e) => setCreateReleaseDate(e.target.value)}
                      className="text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Binary / Installer Download URL</Label>
                  <Input
                    placeholder="https://download.onetab.ai/..."
                    value={createDownloadUrl}
                    onChange={(e) => setCreateDownloadUrl(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Release Notes & Highlights</Label>
                    <Textarea
                      placeholder="Summarize key features, fixes, and improvements..."
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                      className="text-xs h-24"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Technical Changelog (Markdown)</Label>
                    <Textarea
                      placeholder="- Fix memory leak in Matrix sync&#10;- Add instant desktop screen share"
                      value={createChangelog}
                      onChange={(e) => setCreateChangelog(e.target.value)}
                      className="text-xs h-24 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={createMandatory}
                      onCheckedChange={setCreateMandatory}
                      id="create-mandatory"
                    />
                    <Label htmlFor="create-mandatory" className="text-xs cursor-pointer">
                      Mandatory Update (forces update prompt)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={createForce}
                      onCheckedChange={setCreateForce}
                      id="create-force"
                    />
                    <Label htmlFor="create-force" className="text-xs cursor-pointer">
                      Force Immediate Client Restart
                    </Label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetCreateForm}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={mutations.createRelease.isPending}
                    className="gap-1.5"
                  >
                    {mutations.createRelease.isPending ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <Rocket className="size-3.5" />
                    )}
                    <span>Register Release</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: AUDIT LEDGER */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Audit Ledger & Release Logs</CardTitle>
              <CardDescription className="text-xs">
                Immutable records of every version creation, lifecycle change, rollout alteration, and rollback.
              </CardDescription>
            </CardHeader>
            {auditLogsQuery.isLoading ? (
              <div className="p-8">
                <LoadingState />
              </div>
            ) : auditLogs.length === 0 ? (
              <EmptyState
                title="No audit entries logged yet"
                description="Version management events will be tracked and displayed here in real time."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead className="w-[160px]">Actor</TableHead>
                    <TableHead className="w-[130px]">Action</TableHead>
                    <TableHead className="w-[110px]">Target Version</TableHead>
                    <TableHead className="w-[120px]">Platform / OS</TableHead>
                    <TableHead>Reason / Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {log.actorEmail}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action === 'RELEASED' || log.action === 'AUTO_SCHEDULED_RELEASE'
                              ? 'success'
                              : log.action === 'ROLLED_BACK' || log.action === 'DISABLED'
                              ? 'destructive'
                              : log.action === 'SCHEDULED'
                              ? 'warning'
                              : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold">
                        v{log.version}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.platform} {log.operatingSystem ? `(${log.operatingSystem})` : ''}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.reason || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: VIEW DETAILS & RELEASE NOTES */}
      <Dialog
        open={Boolean(detailsRelease)}
        onOpenChange={(open) => !open && setDetailsRelease(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-4 text-accent-blue" />
              <span>Release Details — v{detailsRelease?.version}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailsRelease?.platform} {detailsRelease?.operatingSystem ? `(${detailsRelease.operatingSystem})` : ''} • Channel: {detailsRelease?.releaseChannel}
            </DialogDescription>
          </DialogHeader>

          {detailsRelease && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-md">
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span className="font-semibold">{detailsRelease.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Build Number:</span>{' '}
                  <span className="font-mono">{detailsRelease.buildNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rollout:</span>{' '}
                  <span className="font-semibold">{detailsRelease.rolloutPercentage}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min Supported:</span>{' '}
                  <span className="font-mono">v{detailsRelease.minimumSupportedVersion || '1.0.0'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Release Date:</span>{' '}
                  <span>{new Date(detailsRelease.releaseDate).toLocaleString()}</span>
                </div>
              </div>

              {detailsRelease.downloadUrl && (
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Download URL:</div>
                  <a
                    href={detailsRelease.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-blue hover:underline font-mono break-all flex items-center gap-1"
                  >
                    <span>{detailsRelease.downloadUrl}</span>
                    <ExternalLink className="size-3 inline shrink-0" />
                  </a>
                </div>
              )}

              {detailsRelease.releaseNotes && (
                <div className="space-y-1">
                  <div className="font-medium text-foreground">Release Highlights:</div>
                  <div className="p-3 bg-card border rounded-md whitespace-pre-wrap text-muted-foreground">
                    {detailsRelease.releaseNotes}
                  </div>
                </div>
              )}

              {detailsRelease.changelog && (
                <div className="space-y-1">
                  <div className="font-medium text-foreground">Technical Changelog:</div>
                  <div className="p-3 bg-card border rounded-md whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
                    {detailsRelease.changelog}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailsRelease(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: RELEASE CONFIRMATION */}
      <Dialog
        open={Boolean(releaseToPromote)}
        onOpenChange={(open) => !open && setReleaseToPromote(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <Rocket className="size-4" />
              <span>Release Version v{releaseToPromote?.version}?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will promote this version to <strong>active production</strong>, demoting the currently active version for {releaseToPromote?.platform} {releaseToPromote?.operatingSystem ?? ''}.
            </DialogDescription>
          </DialogHeader>

          {releaseToPromote && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-md space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform:</span>
                  <span className="font-medium">{releaseToPromote.platform} {releaseToPromote.operatingSystem ?? ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Channel:</span>
                  <span className="font-medium">{releaseToPromote.releaseChannel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rollout:</span>
                  <span className="font-medium">{releaseToPromote.rolloutPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Supported:</span>
                  <span className="font-mono">v{releaseToPromote.minimumSupportedVersion || '1.0.0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mandatory Update:</span>
                  <span>{releaseToPromote.mandatoryUpdate ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Release Reason (optional)</Label>
                <Input
                  placeholder="e.g. Scheduled production deployment for Q3 milestone"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReleaseToPromote(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={actionInProgress || mutations.releaseNow.isPending}
              onClick={async () => {
                if (!releaseToPromote) return;
                setActionInProgress(true);
                try {
                  await mutations.releaseNow.mutateAsync({
                    id: releaseToPromote.id,
                    reason: releaseReason.trim() || undefined,
                  });
                  setReleaseToPromote(null);
                } finally {
                  setActionInProgress(false);
                }
              }}
              className="gap-1.5"
            >
              <Rocket className="size-3.5" />
              <span>Confirm Release</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: SCHEDULE RELEASE */}
      <Dialog
        open={Boolean(releaseToSchedule)}
        onOpenChange={(open) => !open && setReleaseToSchedule(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <Clock className="size-4" />
              <span>Schedule Release — v{releaseToSchedule?.version}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              The backend cron scheduler will automatically transition this release to Active Production at the specified time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Launch Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Initial Rollout Percentage (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={scheduleRollout}
                onChange={(e) => setScheduleRollout(Number(e.target.value))}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReleaseToSchedule(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!scheduleDate || mutations.scheduleRelease.isPending}
              onClick={async () => {
                if (!releaseToSchedule || !scheduleDate) return;
                await mutations.scheduleRelease.mutateAsync({
                  id: releaseToSchedule.id,
                  input: {
                    releaseDate: new Date(scheduleDate).toISOString(),
                    rolloutPercentage: scheduleRollout,
                  },
                });
                setReleaseToSchedule(null);
              }}
            >
              Schedule Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: ROLLOUT SLIDER & PRESETS */}
      <Dialog
        open={Boolean(releaseToRollout)}
        onOpenChange={(open) => !open && setReleaseToRollout(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-accent-blue">
              <Sliders className="size-4" />
              <span>Adjust Rollout — v{releaseToRollout?.version}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Control the percentage of eligible client installations that will receive this update in their automatic update checks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-center space-y-1">
              <span className="text-3xl font-extrabold text-foreground tabular-nums">
                {newRolloutPercent}%
              </span>
              <div className="text-xs text-muted-foreground">Active Rollout Wave</div>
            </div>

            <Progress value={newRolloutPercent} className="h-2" />

            <div className="flex items-center justify-between gap-1 pt-2">
              {[10, 25, 50, 75, 100].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={newRolloutPercent === preset ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setNewRolloutPercent(preset)}
                  className="text-xs flex-1"
                >
                  {preset}%
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReleaseToRollout(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={mutations.updateRollout.isPending}
              onClick={async () => {
                if (!releaseToRollout) return;
                await mutations.updateRollout.mutateAsync({
                  id: releaseToRollout.id,
                  input: { rolloutPercentage: newRolloutPercent },
                });
                setReleaseToRollout(null);
              }}
            >
              Save Rollout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: ADMINISTRATIVE ROLLBACK */}
      <Dialog
        open={Boolean(releaseToRollback)}
        onOpenChange={(open) => !open && setReleaseToRollback(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <RotateCcw className="size-4" />
              <span>Administrative Rollback</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reactivate a prior release as the current active version. Release history is preserved without deletion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md space-y-1">
              <div className="font-semibold text-warning">Currently Active:</div>
              <div>
                Version: <strong>v{releaseToRollback?.version}</strong> ({releaseToRollback?.platform} {releaseToRollback?.operatingSystem ?? ''})
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Select Target Version to Restore</Label>
              {eligibleRollbackTargets.length === 0 ? (
                <div className="text-muted-foreground p-3 bg-muted rounded-md text-xs">
                  No prior released versions found for this platform and channel.
                </div>
              ) : (
                <Select
                  value={rollbackTargetId}
                  onValueChange={setRollbackTargetId}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select target prior version..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleRollbackTargets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        v{t.version} (Build {t.buildNumber} • {new Date(t.releaseDate).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason for Rollback</Label>
              <Input
                placeholder="e.g. Critical crash reported in Windows client build"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="text-xs"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReleaseToRollback(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                !rollbackTargetId ||
                !rollbackReason.trim() ||
                mutations.rollbackRelease.isPending
              }
              onClick={async () => {
                if (!rollbackTargetId || !rollbackReason.trim()) return;
                await mutations.rollbackRelease.mutateAsync({
                  id: rollbackTargetId,
                  input: {
                    targetReleaseId: rollbackTargetId,
                    reason: rollbackReason.trim(),
                  },
                });
                setReleaseToRollback(null);
              }}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>Execute Rollback</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: EDIT RELEASE */}
      <Dialog
        open={Boolean(editRelease)}
        onOpenChange={(open) => !open && setEditRelease(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              <span>Edit Release — v{editRelease?.version}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update configuration and release notes for this version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Download URL</Label>
              <Input
                value={editDownloadUrl}
                onChange={(e) => setEditDownloadUrl(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Minimum Supported Version</Label>
              <Input
                value={editMinSupported}
                onChange={(e) => setEditMinSupported(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Release Highlights</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="text-xs h-20"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={editMandatory}
                onCheckedChange={setEditMandatory}
                id="edit-mandatory"
              />
              <Label htmlFor="edit-mandatory" className="text-xs cursor-pointer">
                Mandatory Update
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditRelease(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={mutations.updateRelease.isPending}
              onClick={async () => {
                if (!editRelease) return;
                await mutations.updateRelease.mutateAsync({
                  id: editRelease.id,
                  input: {
                    downloadUrl: editDownloadUrl.trim() || null,
                    minimumSupportedVersion: editMinSupported.trim() || '1.0.0',
                    releaseNotes: editNotes.trim() || null,
                    mandatoryUpdate: editMandatory,
                  },
                });
                setEditRelease(null);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
