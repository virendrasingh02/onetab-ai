import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@org/ui';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import {
  CalendarClock,
  Layers,
  Plug,
  Plus,
  Workflow,
  Zap,
} from 'lucide-react';

import { AutomationAITab } from './AutomationAITab.js';
import { AutomationActionsTab } from './AutomationActionsTab.js';
import { AutomationAnalyticsTab } from './AutomationAnalyticsTab.js';
import { AutomationApprovalsTab } from './AutomationApprovalsTab.js';
import { AutomationConnectionsTab } from './AutomationConnectionsTab.js';
import { AutomationErrorsTab } from './AutomationErrorsTab.js';
import { AutomationHistoryTab } from './AutomationHistoryTab.js';
import { AutomationOverviewTab } from './AutomationOverviewTab.js';
import { AutomationRunsTab } from './AutomationRunsTab.js';
import { AutomationSchedulesTab } from './AutomationSchedulesTab.js';
import { AutomationSettingsTab } from './AutomationSettingsTab.js';
import { AutomationTemplatesTab } from './AutomationTemplatesTab.js';
import { AutomationTriggersTab } from './AutomationTriggersTab.js';
import { AutomationWorkflowsTab } from './AutomationWorkflowsTab.js';
import {
  AUTOMATION_CENTER_TABS,
  type AutomationCenterTab,
} from './types.js';

export function AutomationCenterLayout() {
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab can come from route or query param ?tab= with aliases
  const rawTab = (routeTab || searchParams.get('tab') || 'overview').toLowerCase();
  const currentTab: AutomationCenterTab = (() => {
    if (rawTab === 'my-automations') return 'workflows';
    if (rawTab === 'app-connections') return 'connections';
    if (rawTab === 'ai-automations') return 'ai';
    if (rawTab === 'scheduled') return 'schedules';
    if (rawTab === 'runs-logs') return 'runs';
    if (rawTab === 'error-monitoring') return 'errors';
    const match = AUTOMATION_CENTER_TABS.find((t) => t.id === rawTab);
    return match ? match.id : 'overview';
  })();

  const handleSelectTab = (tabId: AutomationCenterTab) => {
    if (tabId === 'builder') {
      navigate(`/w/${slug}/automations/builder/new`);
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabId === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tabId);
      }
      return next;
    });
  };

  const renderActiveTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return <AutomationOverviewTab onNavigateTab={handleSelectTab} />;
      case 'workflows':
        return <AutomationWorkflowsTab onNavigateTab={handleSelectTab} />;
      case 'templates':
        return <AutomationTemplatesTab />;
      case 'triggers':
        return <AutomationTriggersTab />;
      case 'actions':
        return <AutomationActionsTab />;
      case 'connections':
        return <AutomationConnectionsTab />;
      case 'ai':
        return <AutomationAITab />;
      case 'schedules':
        return <AutomationSchedulesTab />;
      case 'approvals':
        return <AutomationApprovalsTab />;
      case 'history':
        return <AutomationHistoryTab />;
      case 'runs':
        return <AutomationRunsTab />;
      case 'analytics':
        return <AutomationAnalyticsTab />;
      case 'errors':
        return <AutomationErrorsTab />;
      case 'settings':
        return <AutomationSettingsTab />;
      default:
        return <AutomationOverviewTab onNavigateTab={handleSelectTab} />;
    }
  };

  return (
    <div className="flex flex-col min-h-full p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Automation Center
              </h1>
              <p className="text-sm text-muted-foreground">
                Build, execute, orchestrate, and observe event-driven, AI-powered, and scheduled workflows.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Menu */}
        {can('create') && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  New Automation
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(`/w/${slug}/automations/builder/new`)}>
                  <Workflow className="h-4 w-4 mr-2 text-primary" />
                  <span>Start from Blank Canvas</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSelectTab('templates')}>
                  <Layers className="h-4 w-4 mr-2 text-indigo-500" />
                  <span>Use Ready-Made Template</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)}>
                  <CalendarClock className="h-4 w-4 mr-2 text-emerald-500" />
                  <span>Schedule Cron Job</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/w/${slug}/automations/builder/new?trigger=WEBHOOK`)}>
                  <Plug className="h-4 w-4 mr-2 text-amber-500" />
                  <span>Inbound Webhook Automation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Unified 15-Tab Navigation Strip */}
      <div className="border-b border-border/80 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 min-w-max pb-1" aria-label="Automation Center Navigation">
          {AUTOMATION_CENTER_TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition-all border-b-2 ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
                title={tab.description}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Render Selected View */}
      <div className="pt-2">
        {renderActiveTabContent()}
      </div>
    </div>
  );
}
