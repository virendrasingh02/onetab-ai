import { KeyRound } from 'lucide-react';
import { useStudioSession } from '../../session-guard.js';
import { SecretsVaultPanel } from '../secrets-vault-panel.js';
import { AgentTabPage } from './agent-tab-page.js';

/**
 * Agents read configuration through the workspace secrets vault — tools look a
 * secret up by its key (e.g. `FIRECRAWL_API_KEY`). There is no separate
 * variable store or `{{ $vars.* }}` expression engine on the server, so this
 * tab manages the vault rather than presenting variables nothing would read.
 */
export function VariablesTab() {
  const { activeWorkspace } = useStudioSession();

  return (
    <AgentTabPage
      title="Secrets & Configuration"
      description={
        <>
          Shared by every agent in {activeWorkspace.name}. Built-in tools read the secret they need by key — for
          example, web search uses <span className="font-mono">FIRECRAWL_API_KEY</span>.
        </>
      }
      icon={<KeyRound />}
    >
      <SecretsVaultPanel workspaceId={activeWorkspace.id} title="Workspace secrets" />
    </AgentTabPage>
  );
}
