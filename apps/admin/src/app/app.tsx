import { Button, EmptyState, LoadingState } from '@org/ui';
import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

/**
 * Admin console routes.
 *
 * Everything is lazy, so opening the console does not download the marketplace
 * catalogue and the ops dashboards up front. The outer `Suspense` covers the
 * shell's own first load; the one *inside* `AdminShell` wraps the `Outlet`, so
 * navigating between screens swaps the content without blanking the sidebar.
 */
const AdminShell = lazy(() =>
  import('@org/admin-layout').then((m) => ({ default: m.AdminShell })),
);

const HealthDashboardView = lazy(() =>
  import('@org/admin-analytics').then((m) => ({
    default: m.HealthDashboardView,
  })),
);
const PerformanceMonitoringView = lazy(() =>
  import('@org/admin-analytics').then((m) => ({
    default: m.PerformanceMonitoringView,
  })),
);
const ErrorTrackingView = lazy(() =>
  import('@org/admin-analytics').then((m) => ({ default: m.ErrorTrackingView })),
);

const EnterpriseDashboardView = lazy(() =>
  import('@org/admin-enterprise').then((m) => ({
    default: m.EnterpriseDashboardView,
  })),
);
const SSOConfigView = lazy(() =>
  import('@org/admin-enterprise').then((m) => ({ default: m.SSOConfigView })),
);
const AuditLogView = lazy(() =>
  import('@org/admin-enterprise').then((m) => ({ default: m.AuditLogView })),
);

const MarketplaceHomeView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({
    default: m.MarketplaceHomeView,
  })),
);
const PluginSDKView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({ default: m.PluginSDKView })),
);
const ThemeStoreView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({ default: m.ThemeStoreView })),
);
const AgentStoreView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({ default: m.AgentStoreView })),
);
const WorkflowTemplatesView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({
    default: m.WorkflowTemplatesView,
  })),
);
const ComponentMarketplaceView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({
    default: m.ComponentMarketplaceView,
  })),
);
const IntegrationStoreView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({
    default: m.IntegrationStoreView,
  })),
);
const CommunityTemplatesView = lazy(() =>
  import('@org/admin-marketplace').then((m) => ({
    default: m.CommunityTemplatesView,
  })),
);

const ComplianceDashboardView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.ComplianceDashboardView,
  })),
);
const CompliancePlatformsView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.PlatformsView,
  })),
);
const ComplianceCountriesView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.CountriesView,
  })),
);
const ComplianceRequirementsView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.RequirementsView,
  })),
);
const ComplianceChecklistView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.ChecklistView,
  })),
);
const ComplianceIssuesView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.IssuesView,
  })),
);
const ComplianceVersionsView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.VersionsView,
  })),
);
const ComplianceLegalLinksView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.LegalLinksView,
  })),
);
const ComplianceAuditLogView = lazy(() =>
  import('@org/admin-compliance').then((m) => ({
    default: m.AuditLogView,
  })),
);

function NotFoundPage() {
  return (
    <div className="p-6 grid min-h-dvh place-items-center">
      <EmptyState
        size="lg"
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to="/">Go to the console</Link>
          </Button>
        }
      />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<LoadingState fullPage />}>
      <Routes>
        <Route element={<AdminShell />}>
          {/* Health is the landing screen: the first question on arrival is
              whether the platform is up. */}
          <Route path="/" element={<Navigate to="/health" replace />} />
          <Route path="/health" element={<HealthDashboardView />} />
          <Route path="/performance" element={<PerformanceMonitoringView />} />
          <Route path="/errors" element={<ErrorTrackingView />} />

          <Route path="/enterprise" element={<EnterpriseDashboardView />} />
          <Route path="/enterprise/sso" element={<SSOConfigView />} />
          <Route path="/enterprise/audit-logs" element={<AuditLogView />} />

          <Route path="/compliance" element={<ComplianceDashboardView />} />
          <Route
            path="/compliance/platforms"
            element={<CompliancePlatformsView />}
          />
          <Route
            path="/compliance/countries"
            element={<ComplianceCountriesView />}
          />
          <Route
            path="/compliance/requirements"
            element={<ComplianceRequirementsView />}
          />
          <Route
            path="/compliance/checklist"
            element={<ComplianceChecklistView />}
          />
          <Route
            path="/compliance/issues"
            element={<ComplianceIssuesView />}
          />
          <Route
            path="/compliance/versions"
            element={<ComplianceVersionsView />}
          />
          <Route
            path="/compliance/legal"
            element={<ComplianceLegalLinksView />}
          />
          <Route
            path="/compliance/audit-logs"
            element={<ComplianceAuditLogView />}
          />

          <Route path="/marketplace" element={<MarketplaceHomeView />} />
          <Route path="/marketplace/plugins" element={<PluginSDKView />} />
          <Route path="/marketplace/themes" element={<ThemeStoreView />} />
          <Route path="/marketplace/agents" element={<AgentStoreView />} />
          <Route
            path="/marketplace/workflows"
            element={<WorkflowTemplatesView />}
          />
          <Route
            path="/marketplace/components"
            element={<ComponentMarketplaceView />}
          />
          <Route
            path="/marketplace/integrations"
            element={<IntegrationStoreView />}
          />
          <Route
            path="/marketplace/templates"
            element={<CommunityTemplatesView />}
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
