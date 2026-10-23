import type { AIAgentDetail } from '@org/types';
import { Badge, Button, EmptyState, ErrorState, LoadingState, ResponsiveTabs } from '@org/ui';
import { Activity, CheckCircle2, Globe, History, KeyRound, Minus, Palette, Radio, Rocket, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { AgentTabPage } from './agent-tab-page.js';
import { ApiKeysManager } from './deployment/api-keys-manager.js';
import { OverviewPanel, type DeploymentSection } from './deployment/overview-panel.js';
import { TargetsPanel } from './deployment/targets-panel.js';
import { errorMessage, useDeployment } from './deployment/use-deployment.js';
import { PublishDialog, VersionsPanel } from './deployment/versions-panel.js';
import { WebhooksPanel } from './deployment/webhooks-panel.js';
import { WidgetStudioPanel } from './deployment/widget-studio-panel.js';

/** How many tools an agent has, whether the API gave them as an array or as a JSON string. */
function countTools(tools: unknown): number {
  if (Array.isArray(tools)) return tools.length;
  if (typeof tools === 'string') {
    try {
      const parsed: unknown = JSON.parse(tools);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Where an agent is made available: embeds, the REST API, webhooks and
 * versions. Everything on it comes from the platform API; see
 * `deployment/use-deployment.ts` for the calls.
 */
export function AgentDeploymentTab({ agent }: { agent: AIAgentDetail }) {
  const api = useDeployment(agent.id);
  const { deploymentsQuery, deployment } = api;

  const [section, setSection] = useState<DeploymentSection>('overview');
  const [widgetDirty, setWidgetDirty] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishVersion, setPublishVersion] = useState<number | undefined>();

  const openPublish = (version?: number) => {
    setPublishVersion(version);
    setPublishOpen(true);
  };

  if (deploymentsQuery.isLoading) return <LoadingState label="Loading deployment…" />;

  if (deploymentsQuery.isError) {
    return (
      <ErrorState
        title="Couldn’t load the deployment"
        description={errorMessage(deploymentsQuery.error)}
        onRetry={() => void deploymentsQuery.refetch()}
      />
    );
  }

  if (!deployment) {
    return (
      <AgentTabPage
        title="Deploy"
        description="A deployment makes this agent available outside Studio: a chat widget for your website, a REST API, and webhooks."
        icon={<Rocket />}
      >
        <EmptyState
          icon={<Rocket />}
          title={`Deploy ${agent.name}`}
          description="You can restrict where it runs before anything goes live."
          action={
            <Button
              onClick={() => api.create.mutate({ name: `${agent.name} deployment` })}
              loading={api.create.isPending}
              className="gap-2 font-semibold"
            >
              <Sparkles className="size-4" />
              Create a deployment
            </Button>
          }
        />
      </AgentTabPage>
    );
  }

  const live = deployment.status === 'ACTIVE';

  return (
    <AgentTabPage
      title="Deploy"
      description={
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant={live ? 'success' : deployment.status === 'SUSPENDED' ? 'destructive' : 'outline'} className="font-mono text-2xs font-semibold uppercase tracking-wider">
            {deployment.status}
          </Badge>
          <Badge variant="outline" className="font-mono text-2xs text-primary">
            {deployment.environment}
          </Badge>
          <Badge variant="outline" className="font-mono text-2xs">
            {deployment.publishedVersionTag ?? `v${deployment.versionNumber}`}
          </Badge>
          <span>Embeds, the REST API, webhooks and the versions they serve.</span>
        </span>
      }
      icon={<Rocket />}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => api.setStatus.mutate(live ? 'SUSPENDED' : 'ACTIVE')}
            loading={api.setStatus.isPending}
            className="gap-1.5 text-xs"
          >
            {live ? (
              <>
                <Minus className="size-3.5 text-warning" /> Suspend
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5 text-success" /> Reactivate
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPublish()}
            title="Choose which published version this deployment serves. To create a new version, use Publish in the header."
            className="gap-1.5 text-xs"
          >
            <Radio className="size-3.5 text-primary" /> Change live version
          </Button>
        </>
      }
      toolbar={
        <ResponsiveTabs
          aria-label="Deployment sections"
          variant="underline"
          value={section}
          onValueChange={(value) => setSection(value as DeploymentSection)}
          items={[
            { value: 'overview', label: 'Overview', icon: <Activity className="size-3.5" /> },
            { value: 'targets', label: 'Install & call', icon: <Globe className="size-3.5" /> },
            { value: 'widget', label: widgetDirty ? 'Widget Studio •' : 'Widget Studio', icon: <Palette className="size-3.5" /> },
            { value: 'webhooks', label: 'Webhooks', icon: <Zap className="size-3.5" />, count: api.webhooksQuery.data?.length || undefined },
            { value: 'api-keys', label: 'API keys', icon: <KeyRound className="size-3.5" /> },
            { value: 'versions', label: 'Versions', icon: <History className="size-3.5" /> },
          ]}
        />
      }
    >
      {section === 'overview' && (
        <OverviewPanel api={api} deployment={deployment} toolCount={countTools(agent.tools)} onNavigate={setSection} />
      )}
      {section === 'targets' && <TargetsPanel deployment={deployment} agentId={agent.id} onNavigate={setSection} widgetDirty={widgetDirty} />}
      {/* Stays mounted so an unsaved draft survives a visit to Install & call. */}
      <div hidden={section !== 'widget'}>
        <WidgetStudioPanel api={api} deployment={deployment} agentName={agent.name} agentAvatarUrl={deployment.agentAvatarUrl ?? agent.avatarUrl} onDirtyChange={setWidgetDirty} />
      </div>
      {section === 'webhooks' && <WebhooksPanel api={api} deployment={deployment} />}
      {section === 'api-keys' && <ApiKeysManager workspaceId={api.workspaceId} />}
      {section === 'versions' && <VersionsPanel api={api} deployment={deployment} onPublish={openPublish} />}

      <PublishDialog api={api} deployment={deployment} open={publishOpen} initialVersion={publishVersion} onOpenChange={setPublishOpen} />
    </AgentTabPage>
  );
}
