import type { ComplianceCountryView, ComplianceRegionView } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Globe,
  MapPin,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useComplianceCountries,
  useCompliancePlatforms,
  useComplianceRegions,
  useComplianceRequirements,
} from './use-compliance.js';

export function CountriesView() {
  const regionsQuery = useComplianceRegions();
  const countriesQuery = useComplianceCountries();
  const platformsQuery = useCompliancePlatforms();

  const [selectedRegionId, setSelectedRegionId] = useState<string>('ALL');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('IN');
  const [selectedPlatformCode, setSelectedPlatformCode] = useState<string>('macos');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch requirements to see what applies to the selected country/region
  const requirementsQuery = useComplianceRequirements({
    country: selectedCountryCode === 'ALL' ? undefined : selectedCountryCode,
    platform: selectedPlatformCode === 'ALL' ? undefined : selectedPlatformCode,
  });

  const regions: ComplianceRegionView[] = regionsQuery.data ?? [];
  const countries: ComplianceCountryView[] = countriesQuery.data ?? [];
  const platforms = platformsQuery.data ?? [];

  const filteredCountries = useMemo(() => {
    return countries.filter((c) => {
      const matchRegion =
        selectedRegionId === 'ALL' || c.regionId === selectedRegionId;
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRegion && matchSearch;
    });
  }, [countries, selectedRegionId, searchQuery]);

  const activeCountry = useMemo(() => {
    return countries.find((c) => c.code === selectedCountryCode);
  }, [countries, selectedCountryCode]);

  const requirements = requirementsQuery.data ?? [];

  if (regionsQuery.isLoading || countriesQuery.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading regional compliance domains…" />
      </Page>
    );
  }

  if (regionsQuery.isError || countriesQuery.isError) {
    return (
      <Page>
        <ErrorState
          title="Could not load regional settings"
          description="Failed to retrieve regional jurisdictions and country profiles."
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Regional & Country Compliance"
        description="Manage jurisdictional rules and verify country-level statutory requirements (DPDP, GDPR, CCPA, etc.) with strict Country ≻ Regional ≻ Global precedence."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            regionsQuery.refetch();
            countriesQuery.refetch();
            requirementsQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      {/* Precedence explanation banner */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Scale className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-blue-900 dark:text-blue-300">
              Deterministic Precedence Architecture:
            </span>{' '}
            Requirements evaluate hierarchically:{' '}
            <Badge variant="outline" className="mx-1 border-blue-400 text-blue-800 dark:text-blue-200">
              Country-Specific
            </Badge>{' '}
            overrides{' '}
            <Badge variant="outline" className="mx-1 border-blue-400 text-blue-800 dark:text-blue-200">
              Regional Jurisdiction (e.g. EU)
            </Badge>{' '}
            which overrides{' '}
            <Badge variant="outline" className="mx-1 border-blue-400 text-blue-800 dark:text-blue-200">
              Global Standards
            </Badge>
            . No scattered ad-hoc location checks.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Regions & Countries Directory */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                Jurisdictions & Markets
              </CardTitle>
              <CardDescription>
                Filter by trading bloc or search ISO alpha-2 country codes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Region / Economic Bloc</Label>
                <Select
                  value={selectedRegionId}
                  onValueChange={(val) => setSelectedRegionId(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Regions ({countries.length} countries)</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Search Countries</Label>
                <Input
                  placeholder="Filter country name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="max-h-[480px] overflow-y-auto divide-y border rounded-md">
                {filteredCountries.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No matching countries found.
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = c.code === selectedCountryCode;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCountryCode(c.code)}
                        className={`w-full text-left p-3 text-sm flex items-center justify-between transition-colors hover:bg-muted/50 ${
                          isSelected
                            ? 'bg-primary/10 border-l-4 border-primary font-medium'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-xs leading-none">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Code: {c.code}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            c.status === 'PASSED'
                              ? 'success'
                              : c.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-[10px] uppercase"
                        >
                          {c.status}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Jurisdiction Rules Inspector */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  {activeCountry ? (
                    <>
                      {activeCountry.name} ({activeCountry.code})
                    </>
                  ) : (
                    'Global / Multi-Region'
                  )}
                </CardTitle>
                <CardDescription>
                  Applicable legal statutes, store regulations, and grievance officer policies
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedPlatformCode}
                  onValueChange={(val) => setSelectedPlatformCode(val)}
                >
                  <SelectTrigger className="w-[170px] h-8 text-xs">
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
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Highlight specific laws */}
              {selectedCountryCode === 'IN' && (
                <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-1">
                  <div className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    India DPDP Act 2023 Statutory Requirements Active
                  </div>
                  <div className="text-muted-foreground">
                    Mandates explicit consent architecture in 22 scheduled languages, Resident Grievance Officer details visible in app settings, and unconditional account deletion without data retention.
                  </div>
                </div>
              )}

              {selectedCountryCode === 'DE' || selectedCountryCode === 'FR' || selectedCountryCode === 'EU' ? (
                <div className="p-3.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-1">
                  <div className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    EU GDPR & Digital Services Act Requirements Active
                  </div>
                  <div className="text-muted-foreground">
                    Enforces granular opt-in cookie/telemetry consent banner prior to any non-essential payload dispatch, right to erasure, and clear DPO disclosure.
                  </div>
                </div>
              ) : null}

              {selectedCountryCode === 'US' && (
                <div className="p-3.5 rounded-lg border border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-xs space-y-1">
                  <div className="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    US California CCPA / CPRA & Children's Privacy
                  </div>
                  <div className="text-muted-foreground">
                    Requires "Do Not Sell or Share My Personal Information" link, opt-out mechanisms, and explicit child safety declarations.
                  </div>
                </div>
              )}

              {/* Requirements Table */}
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Code</TableHead>
                      <TableHead>Requirement / Scope</TableHead>
                      <TableHead className="w-[110px]">Category</TableHead>
                      <TableHead className="w-[90px]">Severity</TableHead>
                      <TableHead className="w-[80px]">Blocking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirementsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                          Loading applicable requirements...
                        </TableCell>
                      </TableRow>
                    ) : requirements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                          No specific rules active for this filter combination.
                        </TableCell>
                      </TableRow>
                    ) : (
                      requirements.map((req) => {
                        const isCountryScope = req.scopes?.some(
                          (s) => s.countryCode === selectedCountryCode,
                        );
                        return (
                          <TableRow key={req.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {req.code}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-foreground">
                                {req.title}
                              </div>
                              <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {req.description}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {isCountryScope ? (
                                  <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-300">
                                    Country Override ({selectedCountryCode})
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    Inherited (Global/Region)
                                  </Badge>
                                )}
                                {req.externalUrl && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Ref: {req.externalUrl}
                                  </span>
                                )}
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
                                <Badge variant="destructive" className="text-[10px]">
                                  Yes
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">No</span>
                              )}
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
      </div>
    </Page>
  );
}
