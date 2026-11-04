import { useSearchParams } from '../router.js';
import { Coins, Cpu, Key, Settings, Users } from 'lucide-react';
import { useState } from 'react';
import { ApiKeysManager } from '../components/agent-detail/deployment/api-keys-manager.js';
import { MembersTab } from './settings/members-tab.js';
import { ProvidersTab } from './settings/providers-tab.js';
import { UsageTab } from './settings/usage-tab.js';
import { useStudioSession } from '../session-guard.js';
import { StudioPage } from '../components/studio-page.js';

export function SettingsPage() {
  const { activeWorkspace } = useStudioSession();

  const [searchParams] = useSearchParams();
  type SettingsTab = 'providers' | 'members' | 'api-keys' | 'usage';
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab === 'usage' || initialTab === 'members' || initialTab === 'api-keys' ? initialTab : 'providers',
  );

  return (
    <StudioPage
        icon={<Settings />}
        title="Settings & Security"
        description={`Model provider credentials, the team, agent API keys and usage for ${activeWorkspace.name}.`}
        tabs={{
          value: activeTab,
          onValueChange: (tab) => setActiveTab(tab as SettingsTab),
          items: [
            { value: 'providers', label: 'Model providers', icon: <Cpu className="size-4" /> },
            { value: 'members', label: 'Team & roles', icon: <Users className="size-4" /> },
            { value: 'api-keys', label: 'API keys', icon: <Key className="size-4" /> },
            { value: 'usage', label: 'Usage & credits', icon: <Coins className="size-4" /> },
          ],
        }}
      >
      {activeTab === 'providers' && <ProvidersTab />}

      {activeTab === 'members' && <MembersTab />}

      {activeTab === 'api-keys' && (
        <ApiKeysManager
          workspaceId={activeWorkspace.id}
          title="Agent API keys"
          description="Keys that let your own backend, CI or scheduled jobs run this workspace’s deployed agents. A key works for every one of them, and its secret is shown once."
        />
      )}

      {activeTab === 'usage' && <UsageTab />}
    </StudioPage>
  );
}
