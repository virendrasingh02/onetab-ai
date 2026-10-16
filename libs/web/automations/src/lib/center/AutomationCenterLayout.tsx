import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PageBar,
  PageTabBar,
  Tabs,
  TabsTrigger,
} from '@org/ui';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import { CalendarClock, Layers, Plug, Plus, Workflow, Zap } from 'lucide-react';

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
import { AUTOMATION_CENTER_TABS, type AutomationCenterTab } from './types.js';

export function AutomationCenterLayout() {
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab can come from route or query param ?tab= with aliases
  const rawTab = (
    routeTab ||
    searchParams.get('tab') ||
    'overview'
  ).toLowerCase();
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
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar
        icon={<Zap />}
        title="Automation Center"
        hasTabs
        actions={
          can('create') ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-7 text-xs gap-1">
                  <Plus className="size-3.5" />
                  New Automation
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => navigate(`/w/${slug}/automations/builder/new`)}
                >
                  <Workflow className="h-4 w-4 mr-2 text-primary" />
                  <span>Start from Blank Canvas</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSelectTab('templates')}>
                  <Layers className="h-4 w-4 mr-2 text-indigo-500" />
                  <span>Use Ready-Made Template</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)
                  }
                >
                  <CalendarClock className="h-4 w-4 mr-2 text-success-text" />
                  <span>Schedule Cron Job</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate(
                      `/w/${slug}/automations/builder/new?trigger=WEBHOOK`,
                    )
                  }
                >
                  <Plug className="h-4 w-4 mr-2 text-amber-500" />
                  <span>Inbound Webhook Automation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <Tabs
        value={currentTab}
        onValueChange={(value) => handleSelectTab(value as typeof currentTab)}
      >
        <PageTabBar>
          {AUTOMATION_CENTER_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                title={tab.description}
                icon={<Icon className="size-4" />}
              >
                {tab.label}
              </TabsTrigger>
            );
          })}
        </PageTabBar>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3 sm:p-6 max-w-7xl mx-auto w-full">
          {renderActiveTabContent()}
        </div>
      </div>
    </div>
  );
}
