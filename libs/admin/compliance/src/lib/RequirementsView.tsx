import type {
  ComplianceCategory,
  ComplianceRequirementView,
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
  ErrorState,
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
  BookOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import {
  useComplianceMutations,
  useCompliancePlatforms,
  useComplianceRequirements,
} from './use-compliance.js';

const CATEGORIES: ComplianceCategory[] = [
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

const SEVERITIES: ComplianceSeverity[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFORMATIONAL',
];

export function RequirementsView() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');

  const platformsQuery = useCompliancePlatforms();
  const requirementsQuery = useComplianceRequirements({
    category: categoryFilter === 'ALL' ? undefined : categoryFilter,
    severity: severityFilter === 'ALL' ? undefined : severityFilter,
    platform: platformFilter === 'ALL' ? undefined : platformFilter,
    search: search.trim() || undefined,
  });

  const mutations = useComplianceMutations();

  // Create Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<ComplianceCategory>('PRIVACY');
  const [newSeverity, setNewSeverity] = useState<ComplianceSeverity>('HIGH');
  const [newGuidelineRef, setNewGuidelineRef] = useState('');
  const [newHelpText, setNewHelpText] = useState('');
  const [newIsBlocking, setNewIsBlocking] = useState(true);
  const [newPlatformCode, setNewPlatformCode] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');

  // Edit Modal State
  const [editingReq, setEditingReq] = useState<ComplianceRequirementView | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<ComplianceCategory>('PRIVACY');
  const [editSeverity, setEditSeverity] = useState<ComplianceSeverity>('HIGH');
  const [editGuidelineRef, setEditGuidelineRef] = useState('');
  const [editHelpText, setEditHelpText] = useState('');
  const [editIsBlocking, setEditIsBlocking] = useState(false);

  const requirements = requirementsQuery.data ?? [];
  const platforms = platformsQuery.data ?? [];

  const handleOpenEdit = (req: ComplianceRequirementView) => {
    setEditingReq(req);
    setEditTitle(req.title);
    setEditDescription(req.description);
    setEditCategory(req.category as ComplianceCategory);
    setEditSeverity(req.severity as ComplianceSeverity);
    setEditGuidelineRef(req.externalUrl || '');
    setEditHelpText(req.remediationGuide || '');
    setEditIsBlocking(req.isBlocking);
  };

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newTitle || !newDescription) return;

    const scopes = [];
    if (newPlatformCode && newPlatformCode !== 'ALL') {
      scopes.push({ platformCode: newPlatformCode });
    }
    if (newCountryCode && newCountryCode !== 'ALL') {
      scopes.push({ countryCode: newCountryCode });
    }

    await mutations.createRequirement.mutateAsync({
      code: newCode.trim().toUpperCase(),
      title: newTitle.trim(),
      description: newDescription.trim(),
      category: newCategory,
      severity: newSeverity,
      externalUrl: newGuidelineRef.trim() || undefined,
      remediationGuide: newHelpText.trim() || undefined,
      isBlocking: newIsBlocking,
      scopes: scopes.length > 0 ? scopes : undefined,
    });

    setIsAddOpen(false);
    setNewCode('');
    setNewTitle('');
    setNewDescription('');
    setNewGuidelineRef('');
    setNewHelpText('');
  };

  const handleUpdateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;

    await mutations.updateRequirement.mutateAsync({
      id: editingReq.id,
      data: {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        severity: editSeverity,
        externalUrl: editGuidelineRef.trim() || undefined,
        remediationGuide: editHelpText.trim() || undefined,
        isBlocking: editIsBlocking,
      },
    });

    setEditingReq(null);
  };

  const handleDeleteRequirement = async (id: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this compliance requirement? Existing evaluation records will lose link to this rule.',
      )
    ) {
      return;
    }
    await mutations.deleteRequirement.mutateAsync(id);
  };

  if (requirementsQuery.isLoading && !requirementsQuery.data) {
    return (
      <Page>
        <LoadingState label="Loading compliance rules and store guidelines…" />
      </Page>
    );
  }

  if (requirementsQuery.isError) {
    return (
      <Page>
        <ErrorState
          title="Could not load requirements"
          description="Failed to fetch compliance rules from database."
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Compliance Requirements & Store Guidelines"
        description="Centralized catalog of platform rules, App Store guidelines, statutory regulations, and release gates."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => requirementsQuery.refetch()}
            disabled={requirementsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                requirementsQuery.isFetching ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Requirement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateRequirement}>
                <DialogHeader>
                  <DialogTitle>Register New Compliance Requirement</DialogTitle>
                  <DialogDescription>
                    Define a new compliance rule with scoped platform, region, or statutory conditions.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="code" className="text-xs">
                        Rule Code (Unique ID) *
                      </Label>
                      <Input
                        id="code"
                        placeholder="e.g. APPLE_5_1_1 or DPDP_SEC_9"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        required
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="category" className="text-xs">
                        Category *
                      </Label>
                      <Select
                        value={newCategory}
                        onValueChange={(val) =>
                          setNewCategory(val as ComplianceCategory)
                        }
                      >
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-xs">
                      Requirement Title *
                    </Label>
                    <Input
                      id="title"
                      placeholder="e.g. Account Deletion in App Settings"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs">
                      Detailed Policy Description *
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Explain the statutory or store requirement, technical expectation, and failure consequences..."
                      rows={3}
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="severity" className="text-xs">
                        Severity Level *
                      </Label>
                      <Select
                        value={newSeverity}
                        onValueChange={(val) =>
                          setNewSeverity(val as ComplianceSeverity)
                        }
                      >
                        <SelectTrigger id="severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((sev) => (
                            <SelectItem key={sev} value={sev}>
                              {sev}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="guidelineRef" className="text-xs">
                        Official Store Guideline Ref
                      </Label>
                      <Input
                        id="guidelineRef"
                        placeholder="e.g. Apple App Store 5.1.1(v) or MS Policy 10.1"
                        value={newGuidelineRef}
                        onChange={(e) => setNewGuidelineRef(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="helpText" className="text-xs">
                      Developer Remediation Instructions / Guidance
                    </Label>
                    <Textarea
                      id="helpText"
                      placeholder="Step-by-step checklist or verification instructions for engineers..."
                      rows={2}
                      value={newHelpText}
                      onChange={(e) => setNewHelpText(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Scope to Platform (Optional)</Label>
                      <Select
                        value={newPlatformCode}
                        onValueChange={setNewPlatformCode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All platforms (Global)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All platforms (Global)</SelectItem>
                          {platforms.map((p) => (
                            <SelectItem key={p.id} value={p.code}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Scope to Country (Optional)</Label>
                      <Input
                        placeholder="e.g. IN, US, DE (leave blank for Global)"
                        value={newCountryCode}
                        onChange={(e) =>
                          setNewCountryCode(e.target.value.toUpperCase())
                        }
                        maxLength={2}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isBlocking"
                      checked={newIsBlocking}
                      onChange={(e) => setNewIsBlocking(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <Label htmlFor="isBlocking" className="text-xs cursor-pointer font-medium">
                      Block release if unresolved (Strict Release Gate)
                    </Label>
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
                    disabled={mutations.createRequirement.isPending}
                  >
                    {mutations.createRequirement.isPending
                      ? 'Creating...'
                      : 'Create Requirement'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Filter toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rule code, title, guideline..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(val) => setCategoryFilter(val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Category filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={severityFilter}
              onValueChange={(val) => setSeverityFilter(val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Severity filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severities</SelectItem>
                {SEVERITIES.map((sev) => (
                  <SelectItem key={sev} value={sev}>
                    {sev}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={platformFilter}
              onValueChange={(val) => setPlatformFilter(val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Platform filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.code}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                Active Rules Catalog ({requirements.length})
              </CardTitle>
              <CardDescription>
                Live evaluation targets used by the rule engine during pre-submission and release gate checks
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Rule Code</TableHead>
                  <TableHead>Title & Guidance</TableHead>
                  <TableHead className="w-[130px]">Category</TableHead>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead className="w-[100px]">Gate Impact</TableHead>
                  <TableHead className="w-[130px]">Scopes</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-10 text-muted-foreground"
                    >
                      <EmptyState
                        title="No requirements found"
                        description="No compliance requirements matched the selected filters. Seed defaults or register a new requirement."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  requirements.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {req.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground flex items-center gap-2">
                          <span>{req.title}</span>
                          {req.externalUrl && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              {req.externalUrl}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {req.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {req.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            req.severity === 'CRITICAL'
                              ? 'destructive'
                              : req.severity === 'HIGH'
                                ? 'warning'
                                : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {req.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.isBlocking ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] flex items-center gap-1 w-fit"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Blocking
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground w-fit"
                          >
                            Advisory
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[130px]">
                          {req.scopes && req.scopes.length > 0 ? (
                            req.scopes.map((s, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[9px] px-1 py-0 font-mono"
                              >
                                {s.platformCode || s.countryCode || 'Global'}
                              </Badge>
                            ))
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0"
                            >
                              Global
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleOpenEdit(req)}
                            title="Edit Requirement"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteRequirement(req.id)}
                            title="Delete Requirement"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Requirement Dialog */}
      <Dialog
        open={!!editingReq}
        onOpenChange={(open) => !open && setEditingReq(null)}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {editingReq && (
            <form onSubmit={handleUpdateRequirement}>
              <DialogHeader>
                <DialogTitle>Edit Requirement: {editingReq.code}</DialogTitle>
                <DialogDescription>
                  Modify requirement criteria, severity, and release gate enforcement.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={editCategory}
                      onValueChange={(val) =>
                        setEditCategory(val as ComplianceCategory)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Severity</Label>
                    <Select
                      value={editSeverity}
                      onValueChange={(val) =>
                        setEditSeverity(val as ComplianceSeverity)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((sev) => (
                          <SelectItem key={sev} value={sev}>
                            {sev}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Store Guideline Ref</Label>
                  <Input
                    value={editGuidelineRef}
                    onChange={(e) => setEditGuidelineRef(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Developer Guidance</Label>
                  <Textarea
                    rows={2}
                    value={editHelpText}
                    onChange={(e) => setEditHelpText(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="editIsBlocking"
                    checked={editIsBlocking}
                    onChange={(e) => setEditIsBlocking(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label
                    htmlFor="editIsBlocking"
                    className="text-xs cursor-pointer font-medium"
                  >
                    Block release if unresolved (Strict Release Gate)
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingReq(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutations.updateRequirement.isPending}
                >
                  {mutations.updateRequirement.isPending
                    ? 'Saving...'
                    : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}
