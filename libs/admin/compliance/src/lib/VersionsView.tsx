import { complianceApi } from '@org/api-client';
import type {
  ComplianceAppVersionView,
  ComplianceEvaluationContext,
  ComplianceEvaluationResult,
  CompliancePlatformView,
  ComplianceReleaseStage,
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
  DialogTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@org/ui';
import { useMutation } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  useComplianceMutations,
  useCompliancePlatforms,
  useComplianceVersions,
} from './use-compliance.js';

const RELEASE_STAGES: ComplianceReleaseStage[] = [
  'ALPHA',
  'BETA',
  'RC',
  'GA',
  'STORE_SUBMISSION',
];

export function VersionsView() {
  const platformsQuery = useCompliancePlatforms();
  const mutations = useComplianceMutations();

  const platforms: CompliancePlatformView[] = platformsQuery.data ?? [];
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');

  const versionsQuery = useComplianceVersions(selectedPlatformId || undefined);
  const versions: ComplianceAppVersionView[] = versionsQuery.data ?? [];

  // Register Version modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newVersionString, setNewVersionString] = useState('');
  const [newBuildNumber, setNewBuildNumber] = useState('');
  const [newPlatformId, setNewPlatformId] = useState('');
  const [newReleaseStage, setNewReleaseStage] =
    useState<ComplianceReleaseStage>('GA');
  const [newMinOsVersion, setNewMinOsVersion] = useState('');
  const [newReleaseNotes, setNewReleaseNotes] = useState('');

  // Release Gate Simulator state
  const [simPlatformCode, setSimPlatformCode] = useState<string>('macos');
  const [simVersion, setSimVersion] = useState<string>('1.0.0');
  const [simCountry, setSimCountry] = useState<string>('IN');
  const [simChannel, setSimChannel] = useState<string>('MAC_APP_STORE');
  const [evaluationResult, setEvaluationResult] =
    useState<ComplianceEvaluationResult | null>(null);

  const evalMutation = useMutation({
    mutationFn: (ctx: ComplianceEvaluationContext) => complianceApi.evaluate(ctx),
    onSuccess: (data) => setEvaluationResult(data),
  });

  const handleRunEvaluation = () => {
    evalMutation.mutate({
      platformCode: simPlatformCode,
      appVersion: simVersion,
      countryCode: simCountry || undefined,
      distributionChannelCode: simChannel || undefined,
    });
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionString || !newPlatformId) return;

    await mutations.createVersion.mutateAsync({
      platformId: newPlatformId,
      versionString: newVersionString.trim(),
      buildNumber: newBuildNumber.trim() || undefined,
      releaseStage: newReleaseStage,
      minOsVersion: newMinOsVersion.trim() || undefined,
      releaseNotes: newReleaseNotes.trim() || undefined,
    });

    setIsAddOpen(false);
    setNewVersionString('');
    setNewBuildNumber('');
    setNewMinOsVersion('');
    setNewReleaseNotes('');
  };

  if (platformsQuery.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading application versions & release gates…" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Application Versions & Release Gates"
        description="Verify store submission readiness, test release gates across platforms and countries, and manage version baselines."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              platformsQuery.refetch();
              versionsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Register Version
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateVersion}>
                <DialogHeader>
                  <DialogTitle>Register Application Release Version</DialogTitle>
                  <DialogDescription>
                    Define a release build target for automated compliance checks and store distribution.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Platform *</Label>
                    <Select
                      value={newPlatformId}
                      onValueChange={setNewPlatformId}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Version String (SemVer) *</Label>
                      <Input
                        placeholder="e.g. 1.2.0"
                        value={newVersionString}
                        onChange={(e) => setNewVersionString(e.target.value)}
                        required
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Build Number</Label>
                      <Input
                        placeholder="e.g. 452"
                        value={newBuildNumber}
                        onChange={(e) => setNewBuildNumber(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Release Stage *</Label>
                      <Select
                        value={newReleaseStage}
                        onValueChange={(val) =>
                          setNewReleaseStage(val as ComplianceReleaseStage)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RELEASE_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Min OS Version</Label>
                      <Input
                        placeholder="e.g. macOS 12.0+ / Win 10"
                        value={newMinOsVersion}
                        onChange={(e) => setNewMinOsVersion(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Release Notes & Target Changes</Label>
                    <Textarea
                      rows={2}
                      placeholder="Highlights of features, store compliance modifications..."
                      value={newReleaseNotes}
                      onChange={(e) => setNewReleaseNotes(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!newPlatformId || mutations.createVersion.isPending}
                  >
                    {mutations.createVersion.isPending
                      ? 'Registering...'
                      : 'Register Version'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Simulator Section */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4 text-blue-600" />
            Release Gate Evaluation Simulator
          </CardTitle>
          <CardDescription>
            Simulate the deterministic rule engine verdict for any candidate build, target store, and country before initiating production deployment.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <Select
                value={simPlatformCode}
                onValueChange={(val) => setSimPlatformCode(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">App Version</Label>
              <Input
                value={simVersion}
                onChange={(e) => setSimVersion(e.target.value)}
                placeholder="1.0.0"
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Country / Market</Label>
              <Input
                value={simCountry}
                onChange={(e) => setSimCountry(e.target.value.toUpperCase())}
                placeholder="IN, US, DE..."
                maxLength={2}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Channel Code</Label>
              <Input
                value={simChannel}
                onChange={(e) => setSimChannel(e.target.value.toUpperCase())}
                placeholder="MAC_APP_STORE"
                className="h-9 font-mono text-xs"
              />
            </div>

            <Button
              onClick={handleRunEvaluation}
              disabled={evalMutation.isPending}
              className="h-9 text-xs"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              {evalMutation.isPending ? 'Simulating...' : 'Simulate Gate'}
            </Button>
          </div>

          {/* Result Card */}
          {evaluationResult && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-3">
                  {evaluationResult.readyForRelease ? (
                    <ShieldCheck className="h-7 w-7 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-7 w-7 text-destructive shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <span>Release Gate Verdict:</span>
                      <Badge
                        variant={
                          evaluationResult.readyForRelease
                            ? 'default'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {evaluationResult.readyForRelease
                          ? 'PASSED (Ready for Store Submission)'
                          : 'BLOCKED (Release Gate Denied)'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Evaluated {evaluationResult.applicableRequirements.length}{' '}
                      hierarchical rules (Country ≻ Regional ≻ Global)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Readiness Score
                    </div>
                    <div className="text-xl font-bold font-mono">
                      {evaluationResult.readinessScore}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Blockers & Warnings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
                    <AlertOctagon className="h-4 w-4" />
                    Critical Blockers ({evaluationResult.blockingReasons.length})
                  </h4>
                  {evaluationResult.blockingReasons.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No release-blocking failures detected.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {evaluationResult.blockingReasons.map((reason, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-destructive flex items-start gap-1.5 bg-destructive/10 p-2 rounded"
                        >
                          <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-amber-600 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Advisory Warnings ({evaluationResult.warnings.length})
                  </h4>
                  {evaluationResult.warnings.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No non-blocking warnings.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {evaluationResult.warnings.map((warn, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5 bg-amber-500/10 p-2 rounded"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registered Versions Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-600" />
                Registered Application Builds
              </CardTitle>
              <CardDescription>
                Track version compliance states and rollout stages across platforms
              </CardDescription>
            </div>
            <div className="w-[180px]">
              <Select
                value={selectedPlatformId}
                onValueChange={setSelectedPlatformId}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Platforms</SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Version</TableHead>
                  <TableHead className="w-[120px]">Platform</TableHead>
                  <TableHead className="w-[140px]">Release Stage</TableHead>
                  <TableHead className="w-[120px]">Min OS</TableHead>
                  <TableHead>Release Notes</TableHead>
                  <TableHead className="w-[120px]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <EmptyState
                        title="No versions registered"
                        description="Register your first application release candidate to track compliance."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  versions.map((ver) => (
                    <TableRow key={ver.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        v{ver.versionString}
                        {ver.buildNumber && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({ver.buildNumber})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ver.platform?.name ?? 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ver.releaseStage === 'GA' ||
                            ver.releaseStage === 'STORE_SUBMISSION'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {ver.releaseStage.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ver.minOsVersion || 'Default'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground line-clamp-1">
                        {ver.releaseNotes || 'No release notes'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ver.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
