import type {
  ComplianceChecklistItemView,
  ComplianceChecklistStatus,
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
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  useComplianceMutations,
  useCompliancePlatforms,
  useComplianceReview,
  useComplianceReviews,
  useComplianceVersions,
} from './use-compliance.js';

const STATUS_VARIANTS: Record<
  ComplianceChecklistStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: any;
    color: string;
  }
> = {
  PASS: {
    label: 'Pass',
    variant: 'default',
    icon: CheckCircle2,
    color: 'text-emerald-600',
  },
  FAIL: {
    label: 'Fail',
    variant: 'destructive',
    icon: XCircle,
    color: 'text-destructive',
  },
  WARNING: {
    label: 'Warning',
    variant: 'secondary',
    icon: AlertTriangle,
    color: 'text-amber-600',
  },
  SKIP: {
    label: 'Skip',
    variant: 'outline',
    icon: HelpCircle,
    color: 'text-muted-foreground',
  },
  NOT_APPLICABLE: {
    label: 'N/A',
    variant: 'outline',
    icon: HelpCircle,
    color: 'text-muted-foreground',
  },
};

export function ChecklistView() {
  const reviewsQuery = useComplianceReviews();
  const platformsQuery = useCompliancePlatforms();
  const mutations = useComplianceMutations();

  const reviews = reviewsQuery.data ?? [];
  const platforms = platformsQuery.data ?? [];

  const [selectedReviewId, setSelectedReviewId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // New review modal state
  const [isNewReviewOpen, setIsNewReviewOpen] = useState(false);
  const [newPlatformId, setNewPlatformId] = useState('');
  const [newVersionId, setNewVersionId] = useState('');
  const [newTargetCountry, setNewTargetCountry] = useState('ALL');

  const versionsQuery = useComplianceVersions(newPlatformId || undefined);
  const versions = versionsQuery.data ?? [];

  // Set default selected review once reviews load
  useEffect(() => {
    if (!selectedReviewId && reviews.length > 0) {
      setSelectedReviewId(reviews[0].id);
    }
  }, [reviews, selectedReviewId]);

  const activeReviewQuery = useComplianceReview(selectedReviewId || undefined);
  const activeReview = activeReviewQuery.data;

  // Evidence modal state
  const [evidenceItem, setEvidenceItem] =
    useState<ComplianceChecklistItemView | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');

  // Checklist status update state
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatformId) return;

    const res = await mutations.createReview.mutateAsync({
      platformId: newPlatformId,
      versionId: newVersionId || undefined,
      targetCountry: newTargetCountry === 'ALL' ? undefined : newTargetCountry,
    });

    setIsNewReviewOpen(false);
    if (res?.id) {
      setSelectedReviewId(res.id);
    }
  };

  const handleStatusChange = async (
    itemId: string,
    newStatus: ComplianceChecklistStatus,
    currentNotes?: string,
  ) => {
    setUpdatingItemId(itemId);
    try {
      await mutations.updateChecklistItem.mutateAsync({
        itemId,
        status: newStatus,
        notes: currentNotes,
      });
      activeReviewQuery.refetch();
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceItem || !evidenceTitle || !evidenceUrl) return;

    await mutations.addEvidence.mutateAsync({
      checklistItemId: evidenceItem.id,
      title: evidenceTitle.trim(),
      fileUrl: evidenceUrl.trim(),
      fileType: 'URL',
      notes: evidenceNotes.trim() || undefined,
    });

    setEvidenceItem(null);
    setEvidenceTitle('');
    setEvidenceUrl('');
    setEvidenceNotes('');
    activeReviewQuery.refetch();
  };

  const items = useMemo(() => {
    if (!activeReview?.checklistItems) return [];
    if (filterStatus === 'ALL') return activeReview.checklistItems;
    return activeReview.checklistItems.filter((i) => i.status === filterStatus);
  }, [activeReview, filterStatus]);

  if (reviewsQuery.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading pre-submission review checklists…" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Pre-Submission Compliance Checklist"
        description="Verify technical items, attach compliance evidence, and compute release readiness score before store distribution."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reviewsQuery.refetch();
              if (selectedReviewId) activeReviewQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={isNewReviewOpen} onOpenChange={setIsNewReviewOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Pre-Submission Run
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateReview}>
                <DialogHeader>
                  <DialogTitle>Initiate Pre-Submission Review</DialogTitle>
                  <DialogDescription>
                    Populates an active verification checklist from applicable compliance requirements.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Target Platform *</Label>
                    <Select
                      value={newPlatformId}
                      onValueChange={(val) => {
                        setNewPlatformId(val);
                        setNewVersionId('');
                      }}
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

                  <div className="space-y-1.5">
                    <Label className="text-xs">Application Version</Label>
                    <Select
                      value={newVersionId}
                      onValueChange={setNewVersionId}
                      disabled={!newPlatformId || versions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            versions.length === 0
                              ? 'No versions registered (Latest)'
                              : 'Select target version'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            v{v.versionString} ({v.releaseStage})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Distribution Target Region/Country</Label>
                    <Input
                      placeholder="e.g. IN, US, EU, or leave blank for Global"
                      value={newTargetCountry}
                      onChange={(e) =>
                        setNewTargetCountry(e.target.value.toUpperCase())
                      }
                      maxLength={2}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewReviewOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!newPlatformId || mutations.createReview.isPending}
                  >
                    {mutations.createReview.isPending
                      ? 'Generating...'
                      : 'Generate Checklist'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Review Selector & Score Gauge */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title="No Pre-Submission Reviews"
              description="Start your first compliance review to generate a verified checklist for macOS, Windows, Web, or Store releases."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-blue-600" />
                    Select Review Session
                  </CardTitle>
                  <Badge
                    variant={
                      activeReview?.status === 'APPROVED'
                        ? 'default'
                        : activeReview?.status === 'REJECTED'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    Status: {activeReview?.status ?? 'IN_PROGRESS'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={selectedReviewId}
                  onValueChange={(val) => setSelectedReviewId(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a review session" />
                  </SelectTrigger>
                  <SelectContent>
                    {reviews.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.platform?.name ?? 'Platform'} — v{r.versionString ?? 'latest'} ({new Date(r.createdAt).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeReview && (
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span>
                      <strong>Platform:</strong> {activeReview.platform?.name}
                    </span>
                    <span>
                      <strong>Version:</strong> {activeReview.versionString}
                    </span>
                    <span>
                      <strong>Target Market:</strong>{' '}
                      {activeReview.targetCountry || 'Global'}
                    </span>
                    <span>
                      <strong>Created:</strong>{' '}
                      {new Date(activeReview.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Readiness Score Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Readiness Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold font-mono">
                    {activeReview?.score ?? 0}%
                  </span>
                  <Badge
                    variant={
                      (activeReview?.score ?? 0) >= 80 ? 'default' : 'destructive'
                    }
                    className="text-xs"
                  >
                    {(activeReview?.score ?? 0) >= 80
                      ? 'Compliant'
                      : 'Unready'}
                  </Badge>
                </div>
                <Progress value={activeReview?.score ?? 0} className="h-2" />
                <p className="text-[11px] text-muted-foreground">
                  Minimum 80% with 0 blocking failures required for store distribution.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Checklist Items Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    Verification Items ({items.length})
                  </CardTitle>
                  <CardDescription>
                    Mark requirements as passing or upload supporting audit evidence
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={filterStatus}
                    onValueChange={(val) => setFilterStatus(val)}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PASS">Passed</SelectItem>
                      <SelectItem value="FAIL">Failed</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="SKIP">Skipped</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
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
                      <TableHead className="w-[120px]">Rule</TableHead>
                      <TableHead>Checklist Item / Verification</TableHead>
                      <TableHead className="w-[100px]">Severity</TableHead>
                      <TableHead className="w-[150px]">Status</TableHead>
                      <TableHead className="w-[160px]">Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeReviewQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          Loading checklist details...
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          No checklist items found for this review session.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => {
                        const statusConfig = STATUS_VARIANTS[item.status];
                        const Icon = statusConfig.icon;
                        const req = item.requirement;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {req?.code ?? 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-foreground flex items-center gap-2">
                                <span>{req?.title ?? 'General Rule'}</span>
                                {req?.isBlocking && (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                    BLOCKING
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {req?.description}
                              </div>
                              {req?.guidelineRef && (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                                  Ref: {req.guidelineRef}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-[11px] bg-muted/60 p-1.5 rounded mt-1.5 text-muted-foreground italic">
                                  Note: {item.notes}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  req?.severity === 'CRITICAL'
                                    ? 'destructive'
                                    : 'outline'
                                }
                                className="text-[10px]"
                              >
                                {req?.severity ?? 'MEDIUM'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.status}
                                onValueChange={(val) =>
                                  handleStatusChange(
                                    item.id,
                                    val as ComplianceChecklistStatus,
                                    item.notes,
                                  )
                                }
                                disabled={updatingItemId === item.id}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Icon
                                      className={`h-3.5 w-3.5 ${statusConfig.color}`}
                                    />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PASS">Pass</SelectItem>
                                  <SelectItem value="FAIL">Fail</SelectItem>
                                  <SelectItem value="WARNING">Warning</SelectItem>
                                  <SelectItem value="SKIP">Skip</SelectItem>
                                  <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {item.evidence && item.evidence.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.evidence.map((ev) => (
                                      <a
                                        key={ev.id}
                                        href={ev.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded border hover:underline"
                                      >
                                        <Paperclip className="h-3 w-3" />
                                        {ev.title}
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground italic">
                                    No evidence
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-1.5 flex items-center gap-1 text-primary"
                                  onClick={() => setEvidenceItem(item)}
                                >
                                  <Plus className="h-3 w-3" />
                                  Attach
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attach Evidence Dialog */}
      <Dialog
        open={!!evidenceItem}
        onOpenChange={(open) => !open && setEvidenceItem(null)}
      >
        <DialogContent>
          <form onSubmit={handleAddEvidence}>
            <DialogHeader>
              <DialogTitle>Attach Compliance Evidence</DialogTitle>
              <DialogDescription>
                Link audit artifact, review screenshots, or statutory privacy URLs for{' '}
                <span className="font-semibold text-foreground">
                  {evidenceItem?.requirement?.code}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Evidence Title *</Label>
                <Input
                  placeholder="e.g. In-App Deletion Flow Screenshot or Audit Report"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Document or Resource URL *</Label>
                <Input
                  type="url"
                  placeholder="https://docs.onetab.ai/evidence/deletion-flow.png"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Inspector Notes / Verification Details</Label>
                <Textarea
                  rows={2}
                  placeholder="Additional verification remarks or test account details..."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEvidenceItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutations.addEvidence.isPending}
              >
                {mutations.addEvidence.isPending ? 'Saving...' : 'Attach Evidence'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
