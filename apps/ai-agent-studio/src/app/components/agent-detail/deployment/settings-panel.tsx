import type { AgentDeploymentEnvironment, AgentDeploymentView } from '@org/types';
import { AppSelect, Button, confirm, Field, Input } from '@org/ui';
import { Settings2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AgentTabSection } from '../agent-tab-page.js';
import type { DeploymentApi } from './use-deployment.js';

const ENVIRONMENTS: Array<{ value: AgentDeploymentEnvironment; label: string; description: string }> = [
  { value: 'PRODUCTION', label: 'Production', description: 'Real customers and live traffic.' },
  { value: 'STAGING', label: 'Staging', description: 'A rehearsal copy for testing before going live.' },
  { value: 'DEVELOPMENT', label: 'Development', description: 'Local and experimental use.' },
];

/** The deployment's own name, environment and lifecycle: rename, switch environment, suspend, delete. */
export function SettingsPanel({ api, deployment }: { api: DeploymentApi; deployment: AgentDeploymentView }) {
  const [name, setName] = useState(deployment.name);
  const [environment, setEnvironment] = useState<AgentDeploymentEnvironment>(deployment.environment);

  useEffect(() => {
    setName(deployment.name);
    setEnvironment(deployment.environment);
  }, [deployment.name, deployment.environment]);

  const trimmed = name.trim();
  const dirty = (trimmed !== deployment.name || environment !== deployment.environment) && trimmed.length > 0;
  const live = deployment.status === 'ACTIVE';

  const destroy = async () => {
    const ok = await confirm({
      title: `Delete “${deployment.name}”?`,
      description:
        'Every embed using its public key and every webhook stops working immediately. The agent and its versions are kept, and you can create a new deployment afterwards.',
      confirmLabel: 'Delete deployment',
      destructive: true,
      requireText: deployment.name,
    });
    if (ok) api.remove.mutate();
  };

  return (
    <div className="space-y-6">
      <AgentTabSection
        icon={<Settings2 />}
        title="General"
        description="How this deployment is named and labelled across Studio."
        actions={
          <Button
            size="sm"
            className="text-xs font-semibold"
            disabled={!dirty}
            loading={api.update.isPending}
            onClick={() => api.update.mutate({ name: trimmed, environment })}
          >
            Save changes
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" hint="Shown in Studio and in webhook payloads.">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Environment" hint="A label only: it doesn’t change what the deployment serves.">
            <AppSelect value={environment} onValueChange={(v) => setEnvironment(v as AgentDeploymentEnvironment)} options={ENVIRONMENTS} />
          </Field>
        </div>
      </AgentTabSection>

      <AgentTabSection
        title="Availability"
        description={
          live
            ? 'Suspending refuses every embed and public-key call until you reactivate it.'
            : 'This deployment is suspended: embeds and public-key calls are refused.'
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            loading={api.setStatus.isPending}
            onClick={() => api.setStatus.mutate(live ? 'SUSPENDED' : 'ACTIVE')}
          >
            {live ? 'Suspend deployment' : 'Reactivate deployment'}
          </Button>
        }
      />

      <AgentTabSection
        className="border-destructive/40"
        title="Delete deployment"
        description="Permanently removes this deployment, its public key and its webhooks. The agent and its versions stay."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive" loading={api.remove.isPending} onClick={() => void destroy()}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        }
      />
    </div>
  );
}
