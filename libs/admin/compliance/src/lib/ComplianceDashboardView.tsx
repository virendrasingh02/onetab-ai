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
          <div className="flex items-center gap-2">
            <Badge
              variant={
                data.overallStatus === 'PASSED'
                  ? 'success'
                  : data.overallStatus === 'FAILED'
                    ? 'destructive'
                    : 'warning'
              }
              className="font-mono uppercase text-xs"
            >
              {data.overallScore}% READY · {data.overallStatus}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${query.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top StatCards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Overall Compliance Score"
          value={`${data.overallScore}%`}
          hint={`${data.overallStatus === 'PASSED' ? 'Production Ready' : 'Review Required'}`}
          icon={ShieldCheck}
          accent="green"
        />
        <StatCard
          label="Web Platform Readiness"
          value={`${data.webReadiness}%`}
          hint="Production Web & PWA"
          icon={Globe}
          accent="cyan"
        />
        <StatCard
          label="Desktop Platform Readiness"
          value={`${data.desktopReadiness}%`}
          hint="Windows, macOS & Linux"
          icon={Monitor}
          accent="violet"
        />
        <StatCard
          label="Open Compliance Issues"
          value={data.openIssuesCount.total.toString()}
          hint={`${data.openIssuesCount.critical} Critical · ${data.openIssuesCount.high} High`}
          icon={ShieldAlert}
          accent="rose"
        />
      </div>

      {/* Store & Distribution Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-accent-blue" />
                  Store & Distribution Channel Readiness
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculated from live policy rules, pre-submission checklist verification, and store rejection audits.
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
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Microsoft Store (Windows)
                  </span>
                  <span className="font-mono font-medium">
                    {data.storeReadiness.microsoftStore}%
                  </span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.microsoftStore}%` }}
                  />
                </div>
              </div>

              {/* Mac App Store */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Mac App Store (macOS MAS)
                  </span>
                  <span className="font-mono font-medium">
                    {data.storeReadiness.macAppStore}%
                  </span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.macAppStore}%` }}
                  />
                </div>
              </div>

              {/* Windows Direct */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                    Windows Direct (NSIS Installer)
                  </span>
                  <span className="font-mono font-medium">
                    {data.storeReadiness.directWindows}%
                  </span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-violet-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.directWindows}%` }}
                  />
                </div>
              </div>

              {/* macOS Direct */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                    macOS Direct (Apple Notarized DMG)
                  </span>
                  <span className="font-mono font-medium">
                    {data.storeReadiness.directMac}%
                  </span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-pink-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.storeReadiness.directMac}%` }}
                  />
                </div>
              </div>

              {/* Production Web */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                    Production Web App & PWA
                  </span>
                  <span className="font-mono font-medium">
                    {data.storeReadiness.web}%
                  </span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
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
              <CardTitle className="text-base flex items-center gap-2">
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
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/50 text-xs"
                >
                  <div>
                    <div className="font-medium">{v.platformName}</div>
                    <div className="text-muted-foreground font-mono">{v.currentVersion}</div>
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
                    <div className="text-muted-foreground text-[10px] mt-0.5">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Countries Requiring Attention */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent-blue" />
                  Countries / Regions Requiring Attention
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Jurisdictions with open store guideline violations or pending regional legal requirements.
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
              <div className="text-center py-6 text-xs text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2 opacity-80" />
                All regional jurisdictions currently meet compliance requirements.
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.countriesRequiringAttention.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge variant="outline" className="font-mono font-bold text-[11px]">
                        {c.code}
                      </Badge>
                      <div>
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.criticalCount > 0 && (
                            <span className="text-destructive font-medium mr-2">
                              {c.criticalCount} Critical Issue{c.criticalCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {c.warningCount > 0 && (
                            <span className="text-warning">
                              {c.warningCount} Warning{c.warningCount > 1 ? 's' : ''}
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
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" />
                  Upcoming Compliance Deadlines & Audits
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scheduled regulatory effective dates and platform guideline review cycles.
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
                  className="p-3 rounded-lg border border-border bg-card/60 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{dl.title}</div>
                    <div className="text-[11px] text-muted-foreground">{dl.target}</div>
                    <div className="text-[11px] font-mono text-subtle">
                      Due: {new Date(dl.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={dl.severity === 'CRITICAL' ? 'destructive' : 'warning'}
                    className="text-[10px] uppercase font-mono"
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
          <Link to="/compliance/checklist">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-medium">Pre-Submission</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
          <Link to="/compliance/issues">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <span className="text-xs font-medium">Rejections</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
          <Link to="/compliance/versions">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span className="text-xs font-medium">Release Gate</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
          <Link to="/compliance/requirements">
            <Scale className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-medium">Requirements</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
          <Link to="/compliance/legal">
            <ExternalLink className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-medium">Legal Links</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1.5" asChild>
          <Link to="/compliance/audit-logs">
            <Shield className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-medium">Audit Trail</span>
          </Link>
        </Button>
      </div>
    </Page>
  );
}
