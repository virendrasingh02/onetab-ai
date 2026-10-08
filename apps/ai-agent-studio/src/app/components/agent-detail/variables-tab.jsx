import { Variable } from 'lucide-react';
import { useStudioSession } from '../../session-guard.js';
import { SecretsVaultPanel } from '../secrets-vault-panel.js';

/**
 * Agents read configuration through the workspace secrets vault — tools look a
 * secret up by its key (e.g. `FIRECRAWL_API_KEY`). There is no separate
 * variable store or `{{ $vars.* }}` expression engine on the server, so this
 * tab manages the vault rather than presenting variables nothing would read.
 */
export function VariablesTab() {
  const { activeWorkspace } = useStudioSession();

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Variable className="size-4" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Secrets & Configuration</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Shared by every agent in {activeWorkspace.name}. Built-in tools read the secret they need by key — for
          example, web search uses <span className="font-mono">FIRECRAWL_API_KEY</span>.
        </p>
      </div>

      <SecretsVaultPanel workspaceId={activeWorkspace.id} title="Workspace secrets" />
    </div>
  );
}
