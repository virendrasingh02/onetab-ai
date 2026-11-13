import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  StatCard,
} from '@org/ui';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useComplianceOverview } from './use-compliance.js';

export function ComplianceDashboardView() {
  const query = useComplianceOverview();

  if (query.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading compliance health overview…" />
      </Page>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Page>
        <ErrorState
          title="Could not load compliance overview"
          description="The compliance service is temporarily unreachable or requires operator authorization."
        />
      </Page>
    );
  }

  const data = query.data;

  return (
    <Page>
      <PageHeader
        title="Compliance & Distribution Center"
        description="Proactive app-store compliance, country/region rules, distribution readiness, and release gates."
        icon={<ShieldCheck className="text-success" />}
        accent="green"
        actions={
          <div className="gap-2 flex items-center">
            <Badge
              variant={
                data.overallStatus === 'PASSED'
                  ? 'success'
                  : data.overallStatus === 'FAILED'
                    ? 'destructive'
                    : 'warning'
              }
              className="text-xs font-mono uppercase"
            >
              {data.overallScore}% READY · {data.overallStatus}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${query.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top StatCards */}
      <div className="md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 grid grid-cols-1">
        <StatCard
          label="Overall Compliance Score"
          subtitle="Regulatory Benchmark"
          value={`${data.overallScore}%`}
          badgeText={data.overallStatus === 'PASSED' ? 'PASSED' : 'REVIEW'}
          badgeType={data.overallStatus === 'PASSED' ? 'positive' : 'warning'}
          secondaryText={
            data.overallStatus === 'PASSED'
              ? 'Production Ready'
              : 'Review Required'
          }
          sparklineColor="emerald"
        />
        <StatCard
          label="Web Platform Readiness"
          subtitle="Web & PWA Standards"
          value={`${data.webReadiness}%`}
          badgeText="Verified"
          badgeType="positive"
          secondaryText="Production Web Ready"
          sparklineColor="cyan"
        />
        <StatCard
          label="Desktop Platform Readiness"
          subtitle="OS Native Targets"
          value={`${data.desktopReadiness}%`}
          badgeText="Certified"
          badgeType="positive"
          secondaryText="Windows, macOS & Linux"
          sparklineColor="emerald"
        />
        <StatCard
          label="Open Compliance Issues"
          subtitle="Audit Remediation"
          value={data.openIssuesCount.total.toString()}
          badgeText={`${data.openIssuesCount.total} items`}
          badgeType={data.openIssuesCount.critical > 0 ? 'negative' : 'warning'}
          secondaryText={`${data.openIssuesCount.critical} Critical · ${data.openIssuesCount.high} High`}
          sparklineColor={data.openIssuesCount.critical > 0 ? 'rose' : 'amber'}
        />
      </div>

      {/* Store & Distribution Readiness */}
      <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base gap-2 flex items-center">
                  <Monitor className="w-4 h-4 text-accent-blue" />
                  Store & Distribution Channel Readiness
                </CardTitle>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Calculated from live policy rules, pre-submission checklist
                  verification, and store rejection audits.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/compliance/platforms">
                  All Platforms <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Microsoft Store */}
              <div>
                <div className="text-xs mb-1.5 flex items-center justify-between">
                  <span className="font-medium gap-1.5 flex items-center">
                    <span className="w-2 h-2 bg-blue-500 inline-block rounded-full" />
                    Microsoft Store (Windows)
                  </span>
                  <span className="font-medium font-mono">
                    {data.storeReadiness.microsoftStore}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.microsoftStore}%` }}
                  />
                </div>
              </div>

              {/* Mac App Store */}
              <div>
                <div className="text-xs mb-1.5 flex items-center justify-between">
                  <span className="font-medium gap-1.5 flex items-center">
                    <span className="w-2 h-2 inline-block rounded-full bg-success" />
                    Mac App Store (macOS MAS)
                  </span>
                  <span className="font-medium font-mono">
                    {data.storeReadiness.macAppStore}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${data.storeReadiness.macAppStore}%` }}
                  />
                </div>
              </div>

              {/* Windows Direct */}
              <div>
                <div className="text-xs mb-1.5 flex items-center justify-between">
                  <span className="font-medium gap-1.5 flex items-center">
                    <span className="w-2 h-2 bg-violet-500 inline-block rounded-full" />
                    Windows Direct (NSIS Installer)
                  </span>
                  <span className="font-medium font-mono">
                    {data.storeReadiness.directWindows}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-violet-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.directWindows}%` }}
                  />
                </div>
              </div>

              {/* macOS Direct */}
              <div>
                <div className="text-xs mb-1.5 flex items-center justify-between">
                  <span className="font-medium gap-1.5 flex items-center">
                    <span className="w-2 h-2 bg-pink-500 inline-block rounded-full" />
                    macOS Direct (Apple Notarized DMG)
                  </span>
                  <span className="font-medium font-mono">
                    {data.storeReadiness.directMac}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-pink-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.directMac}%` }}
                  />
                </div>
              </div>

              {/* Production Web */}
              <div>
                <div className="text-xs mb-1.5 flex items-center justify-between">
                  <span className="font-medium gap-1.5 flex items-center">
                    <span className="w-2 h-2 bg-cyan-500 inline-block rounded-full" />
                    Production Web App & PWA
                  </span>
                  <span className="font-medium font-mono">
                    {data.storeReadiness.web}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.web}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current App Versions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base gap-2 flex items-center">
                <Clock className="w-4 h-4 text-accent-purple" />
                Active Versions
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/compliance/versions">
                  Release Gate <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.currentVersions.map((v) => (
                <div
                  key={v.platform}
                  className="p-2.5 text-xs flex items-center justify-between rounded-lg border border-border bg-card/50"
                >
                  <div>
                    <div className="font-medium">{v.platformName}</div>
                    <div className="font-mono text-muted-foreground">
                      {v.currentVersion}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        v.status === 'APPROVED' || v.status === 'RELEASED'
                          ? 'success'
                          : v.status === 'BLOCKED'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {v.status}
                    </Badge>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {v.readinessScore}% Score
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regional Attention & Upcoming Deadlines */}
      <div className="lg:grid-cols-2 gap-6 mb-6 grid grid-cols-1">
        {/* Countries Requiring Attention */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base gap-2 flex items-center">
                  <Globe className="w-4 h-4 text-accent-blue" />
                  Countries / Regions Requiring Attention
                </CardTitle>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Jurisdictions with open store guideline violations or pending
                  regional legal requirements.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/compliance/countries">
                  Manage Countries <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.countriesRequiringAttention.length === 0 ? (
              <div className="py-6 text-xs text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mb-2 mx-auto text-success opacity-80" />
                All regional jurisdictions currently meet compliance
                requirements.
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.countriesRequiringAttention.map((c) => (
                  <div
                    key={c.code}
                    className="p-3 text-xs flex items-center justify-between rounded-lg border border-border bg-card/60"
                  >
                    <div className="gap-2.5 flex items-center">
                      <Badge
                        variant="outline"
                        className="font-bold font-mono text-[11px]"
                      >
                        {c.code}
                      </Badge>
                      <div>
                        <div className="font-medium text-foreground">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.criticalCount > 0 && (
                            <span className="font-medium mr-2 text-destructive">
                              {c.criticalCount} Critical Issue
                              {c.criticalCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {c.warningCount > 0 && (
                            <span className="text-warning">
                              {c.warningCount} Warning
                              {c.warningCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/compliance/requirements?country=${c.code}`}>
                        Inspect Rules
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Requirements & Deadlines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base gap-2 flex items-center">
                  <Clock className="w-4 h-4 text-warning" />
                  Upcoming Compliance Deadlines & Audits
                </CardTitle>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Scheduled regulatory effective dates and platform guideline
                  review cycles.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/compliance/requirements">
                  All Policies <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.upcomingDeadlines.map((dl) => (
                <div
                  key={dl.id}
                  className="p-3 text-xs gap-3 flex items-start justify-between rounded-lg border border-border bg-card/60"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">
                      {dl.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {dl.target}
                    </div>
                    <div className="font-mono text-[11px] text-subtle">
                      Due: {new Date(dl.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={
                      dl.severity === 'CRITICAL' ? 'destructive' : 'warning'
                    }
                    className="font-mono text-[10px] uppercase"
                  >
                    {dl.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="md:grid-cols-4 lg:grid-cols-6 gap-3 grid grid-cols-2">
        <Button
          variant="outline"
          className="py-3 gap-1.5 h-auto flex-col"
          asChild
        >
          <Link to="/compliance/checklist">
            <CheckCircle2 className="w-5 h-5 text-success-text" />
            <span className="text-xs font-medium">Pre-Submission</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="py-3 gap-1.5 h-auto flex-col"
          asChild
        >
          <Link to="/compliance/issues">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-xs font-medium">Rejections</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="py-3 gap-1.5 h-auto flex-col"
          asChild
        >
          <Link to="/compliance/versions">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-medium">Release Gate</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="py-3 gap-1.5 h-auto flex-col"
          asChild
        >
          <Link to="/compliance/requirements">
            <Scale className="w-5 h-5" />
            <span className="text-xs font-medium">Requirements</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="py-3 gap-1.5 h-auto flex-col"
          asChild
        >
          <Link to="/compliance/legal">
            <ExternalLink className="w-5 h-5" />
            <span className="text-xs font-medium">Legal Links</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="py-3 gap-1.5 h-auto flex-col"
          asChild
        >
          <Link to="/compliance/audit-logs">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-medium">Audit Trail</span>
          </Link>
        </Button>
      </div>
    </Page>
  );
}
