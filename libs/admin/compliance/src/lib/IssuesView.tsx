import type {
  ComplianceCategory,
  ComplianceIssueSource,
  ComplianceIssueStatus,
  ComplianceIssueView,
  ComplianceSeverity,
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
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
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
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useComplianceIssues,
  useComplianceMutations,
  useCompliancePlatforms,
} from './use-compliance.js';

const ISSUE_STATUSES: ComplianceIssueStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'FIX_REQUIRED',
  'IN_PROGRESS',
  'READY_FOR_RESUBMISSION',
  'SUBMITTED',
  'RESOLVED',
  'ACCEPTED',
  'WONT_FIX',
];

const ISSUE_SOURCES: ComplianceIssueSource[] = [
  'STORE_REVIEW',
  'INTERNAL_AUDIT',
  'AUTOMATED_SCAN',
  'REGULATORY_NOTICE',
];

const DONE_STATUSES: ComplianceIssueStatus[] = [
  'RESOLVED',
  'ACCEPTED',
  'WONT_FIX',
];

const ISSUE_CATEGORIES: ComplianceCategory[] = [
  'PRIVACY',
  'DATA_COLLECTION',
  'USER_CONSENT',
  'ACCOUNT_DELETION',
  'AUTHENTICATION',
  'PAYMENTS',
  'CONTENT_MODERATION',
  'SECURITY',
  'PERMISSIONS',
  'NOTIFICATIONS',
  'TRACKING_ADVERTISING',
  'AGE_RATING',
  'METADATA_ASSETS',
  'LEGAL_TERMS',
  'REGIONAL_LEGAL',
  'EXPORT_COMPLIANCE',
];

export function IssuesView() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const issuesQuery = useComplianceIssues({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    severity: severityFilter === 'ALL' ? undefined : severityFilter,
    q: search.trim() || undefined,
  });

  const platformsQuery = useCompliancePlatforms();
  const mutations = useComplianceMutations();

  const issues: ComplianceIssueView[] = issuesQuery.data ?? [];
  const platforms = platformsQuery.data ?? [];

  // Create Issue Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSource, setNewSource] =
    useState<ComplianceIssueSource>('STORE_REVIEW');
  const [newCategory, setNewCategory] =
    useState<ComplianceCategory>('METADATA_ASSETS');
  const [newSeverity, setNewSeverity] = useState<ComplianceSeverity>('HIGH');
  const [newReviewerNotes, setNewReviewerNotes] = useState('');
  const [newPlatformId, setNewPlatformId] = useState('');
  const [newRemediation, setNewRemediation] = useState('');

  // Update / Resolve Issue Modal State
  const [editingIssue, setEditingIssue] = useState<ComplianceIssueView | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<ComplianceIssueStatus>('OPEN');
  const [editResolution, setEditResolution] = useState('');

  const stats = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter((i) => i.status === 'OPEN' || i.status === 'FIX_REQUIRED').length,
      critical: issues.filter((i) => i.severity === 'CRITICAL').length,
      resolved: issues.filter((i) => DONE_STATUSES.includes(i.status)).length,
    };
  }, [issues]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDescription) return;

    await mutations.createIssue.mutateAsync({
      title: newTitle.trim(),
      description: newDescription.trim(),
      category: newCategory,
      source: newSource,
      severity: newSeverity,
      reviewerNotes: newReviewerNotes.trim() || undefined,
      platformId: newPlatformId || undefined,
      remediation: newRemediation.trim() || undefined,
    });

    setIsAddOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewReviewerNotes('');
    setNewRemediation('');
  };

  const handleUpdateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue) return;

    await mutations.updateIssue.mutateAsync({
      id: editingIssue.id,
      data: {
        status: editStatus,
        resolution: editResolution.trim() || undefined,
      },
    });

    setEditingIssue(null);
  };

  const handleOpenEdit = (issue: ComplianceIssueView) => {
    setEditingIssue(issue);
    setEditStatus(issue.status);
    setEditResolution(issue.resolution || '');
  };

  if (issuesQuery.isLoading && !issuesQuery.data) {
    return (
      <Page>
        <LoadingState label="Loading compliance issues and store rejections…" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Store Rejections & Violation Tracker"
        description="Track App Store reviewer rejection letters, automated scan findings, and remediation roadmaps."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => issuesQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Record Store Rejection / Issue
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateIssue}>
                <DialogHeader>
                  <DialogTitle>Log Compliance Issue or Store Rejection</DialogTitle>
                  <DialogDescription>
                    Record feedback from Apple App Store, Microsoft Store, or regulatory inquiries.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Issue Title *</Label>
                    <Input
                      placeholder="e.g. Apple Rejection Guideline 5.1.1 — In-App Account Deletion"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Detection Source *</Label>
                      <Select
                        value={newSource}
                        onValueChange={(val) =>
                          setNewSource(val as ComplianceIssueSource)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ISSUE_SOURCES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Severity Level *</Label>
                      <Select
                        value={newSeverity}
                        onValueChange={(val) =>
                          setNewSeverity(val as ComplianceSeverity)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRITICAL">CRITICAL (Store Block)</SelectItem>
                          <SelectItem value="HIGH">HIGH (Notice Period)</SelectItem>
                          <SelectItem value="MEDIUM">MEDIUM (Warning)</SelectItem>
                          <SelectItem value="LOW">LOW</SelectItem>
                          <SelectItem value="INFORMATIONAL">INFORMATIONAL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Category *</Label>
                      <Select
                        value={newCategory}
                        onValueChange={(val) =>
                          setNewCategory(val as ComplianceCategory)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ISSUE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Official Guideline / Reviewer Notes
                    </Label>
                    <Input
                      placeholder="e.g. Guideline 5.1.1 - Data Collection and Storage"
                      value={newReviewerNotes}
                      onChange={(e) => setNewReviewerNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Store Reviewer Feedback / Description *</Label>
                    <Textarea
                      rows={3}
                      placeholder="Paste the verbatim message received from the store reviewer or legal notice..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Engineering Remediation Plan</Label>
                    <Textarea
                      rows={2}
                      placeholder="Required code change or configuration fix to satisfy requirement..."
                      value={newRemediation}
                      onChange={(e) => setNewRemediation(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Platform</Label>
                    <Select
                      value={newPlatformId}
                      onValueChange={setNewPlatformId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Global" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None / Global</SelectItem>
                        {platforms.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    disabled={mutations.createIssue.isPending}
                  >
                    {mutations.createIssue.isPending
                      ? 'Saving...'
                      : 'Record Issue'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-2xl font-bold font-mono">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Logged</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <div className="text-2xl font-bold font-mono text-amber-600">
                {stats.open}
              </div>
              <div className="text-xs text-muted-foreground">Unresolved Issues</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <div className="text-2xl font-bold font-mono text-destructive">
                {stats.critical}
              </div>
              <div className="text-xs text-muted-foreground">Critical Blockers</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-2xl font-bold font-mono text-emerald-600">
                {stats.resolved}
              </div>
              <div className="text-xs text-muted-foreground">Resolved / Closed</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rejection text, code, title..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {ISSUE_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={severityFilter}
              onValueChange={(val) => setSeverityFilter(val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-amber-600" />
            Rejection Records & Actions ({issues.length})
          </CardTitle>
          <CardDescription>
            Audit log of store rejections and resolution workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Source & Code</TableHead>
                  <TableHead>Issue & Remediation</TableHead>
                  <TableHead className="w-[110px]">Platform / Ver</TableHead>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-10 text-muted-foreground"
                    >
                      <EmptyState
                        title="No issues recorded"
                        description="No guideline violations or store rejections match your search criteria."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono uppercase">
                          {issue.source.replace(/_/g, ' ')}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {issue.category.replace(/_/g, ' ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground">
                          {issue.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {issue.description}
                        </div>
                        {issue.remediation && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                            <strong>Remediation:</strong> {issue.remediation}
                          </div>
                        )}
                        {issue.resolution && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <strong>Resolved:</strong> {issue.resolution}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">
                          {issue.platformCode ?? 'Global'}
                        </div>
                        {issue.appVersionString && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            v{issue.appVersionString}
                          </div>
                        )}
                        {issue.countryCode && (
                          <Badge variant="secondary" className="text-[9px] mt-0.5">
                            {issue.countryCode}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            issue.severity === 'CRITICAL'
                              ? 'destructive'
                              : issue.severity === 'HIGH'
                                ? 'warning'
                                : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {issue.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            DONE_STATUSES.includes(issue.status)
                              ? 'success'
                              : issue.status === 'OPEN' || issue.status === 'FIX_REQUIRED'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {issue.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleOpenEdit(issue)}
                        >
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Update / Resolve Issue Dialog */}
      <Dialog
        open={!!editingIssue}
        onOpenChange={(open) => !open && setEditingIssue(null)}
      >
        <DialogContent>
          {editingIssue && (
            <form onSubmit={handleUpdateIssue}>
              <DialogHeader>
                <DialogTitle>Update Issue Workflow</DialogTitle>
                <DialogDescription>
                  Update investigation status and record verification notes for{' '}
                  <span className="font-semibold text-foreground">
                    {editingIssue.title}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Issue Status *</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(val) =>
                      setEditStatus(val as ComplianceIssueStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Resolution Notes & Build Reference</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe the fix applied, pull request link, or updated guideline compliance evidence..."
                    value={editResolution}
                    onChange={(e) => setEditResolution(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingIssue(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutations.updateIssue.isPending}
                >
                  {mutations.updateIssue.isPending
                    ? 'Updating...'
                    : 'Save Status'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}
