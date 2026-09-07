import type {
  ComplianceLegalLinkView,
  CompliancePlatformView,
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
} from '@org/ui';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import {
  useComplianceLegalLinks,
  useComplianceMutations,
  useCompliancePlatforms,
} from './use-compliance.js';

const LEGAL_TYPES = [
  { value: 'PRIVACY_POLICY', label: 'Privacy Policy' },
  { value: 'TERMS_OF_SERVICE', label: 'Terms of Service' },
  { value: 'ACCOUNT_DELETION', label: 'Account Deletion URL' },
  { value: 'COOKIE_POLICY', label: 'Cookie & Tracking Policy' },
  { value: 'SUPPORT', label: 'Support & Help Center' },
  { value: 'SECURITY_CONTACT', label: 'Security & Vulnerability Disclosure' },
  { value: 'GRIEVANCE_OFFICER', label: 'DPDP Grievance Officer / Redressal' },
];

export function LegalLinksView() {
  const legalQuery = useComplianceLegalLinks();
  const platformsQuery = useCompliancePlatforms();
  const mutations = useComplianceMutations();

  const links: ComplianceLegalLinkView[] = legalQuery.data ?? [];
  const platforms: CompliancePlatformView[] = platformsQuery.data ?? [];

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newType, setNewType] = useState('PRIVACY_POLICY');
  const [newUrl, setNewUrl] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newPlatformId, setNewPlatformId] = useState('');

  const handleSaveLegalLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType || !newUrl) return;

    await mutations.updateLegalLink.mutateAsync({
      type: newType,
      url: newUrl.trim(),
      countryCode: newCountryCode.trim().toUpperCase() || undefined,
      platformId: newPlatformId || undefined,
    });

    setIsAddOpen(false);
    setNewUrl('');
    setNewCountryCode('');
    setNewPlatformId('');
  };

  const handleEditLink = (link: ComplianceLegalLinkView) => {
    setNewType(link.type);
    setNewUrl(link.url);
    setNewCountryCode(link.countryCode || '');
    setNewPlatformId(link.platformId || '');
    setIsAddOpen(true);
  };

  if (legalQuery.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading legal and compliance URLs…" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Legal & Regulatory Links"
        description="Centralized registry for public privacy policies, terms, account deletion endpoints, and statutory grievance contacts."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => legalQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Configure Legal Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSaveLegalLink}>
                <DialogHeader>
                  <DialogTitle>Configure Legal URL</DialogTitle>
                  <DialogDescription>
                    Add or update public legal endpoints required by Apple, Microsoft, and global privacy statutes.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Document Type *</Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEGAL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Destination URL *</Label>
                    <Input
                      type="url"
                      placeholder="https://onetab.ai/legal/privacy"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Platform Override</Label>
                      <Select
                        value={newPlatformId}
                        onValueChange={setNewPlatformId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Global (All)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Global (All platforms)</SelectItem>
                          {platforms.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Country Override</Label>
                      <Input
                        placeholder="e.g. IN, DE (Global if empty)"
                        value={newCountryCode}
                        onChange={(e) =>
                          setNewCountryCode(e.target.value.toUpperCase())
                        }
                        maxLength={2}
                        className="font-mono text-xs"
                      />
                    </div>
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
                    disabled={mutations.updateLegalLink.isPending}
                  >
                    {mutations.updateLegalLink.isPending
                      ? 'Saving...'
                      : 'Save Legal Link'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Statutory Callout */}
      <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
            <div className="font-semibold">
              Mandatory App Store Rejection Prevention:
            </div>
            <div>
              Apple Guideline 5.1.1(v) requires direct in-app access to Account Deletion and Privacy Policy.
              India DPDP Act 2023 mandates contact info for the Resident Grievance Officer.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Links Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-600" />
            Configured Legal Endpoints ({links.length})
          </CardTitle>
          <CardDescription>
            Public URLs integrated into web footer, desktop application settings, and store listings
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Link Type</TableHead>
                  <TableHead>Target URL</TableHead>
                  <TableHead className="w-[120px]">Platform</TableHead>
                  <TableHead className="w-[100px]">Country</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <EmptyState
                        title="No legal links configured"
                        description="Add standard privacy policy, terms of service, and account deletion endpoints."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium text-xs">
                        {LEGAL_TYPES.find((t) => t.value === link.type)?.label ??
                          link.type}
                      </TableCell>
                      <TableCell>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate max-w-md">{link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {link.platform?.name ?? 'Global (All)'}
                      </TableCell>
                      <TableCell>
                        {link.countryCode ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {link.countryCode}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Global
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={link.isActive ? 'default' : 'outline'}
                          className="text-[10px]"
                        >
                          {link.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleEditLink(link)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
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
    </Page>
  );
}
