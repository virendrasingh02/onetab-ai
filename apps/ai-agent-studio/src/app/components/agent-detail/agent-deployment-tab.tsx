import type { AIAgentDetail } from '@org/types';
import { Badge, Button, ErrorState, LoadingState, ResponsiveTabs } from '@org/ui';
import { Activity, CheckCircle2, Globe, History, KeyRound, Minus, Palette, Rocket, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { AgentAvatar } from '../../data/agent-metadata.js';
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
      <div className="mx-auto flex min-h-[460px] max-w-xl flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Rocket className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Deploy {agent.name}</h2>
        <p className="mb-6 mt-2 max-w-md text-sm text-muted-foreground">
          A deployment makes this agent available outside Studio: a chat widget for your website, a REST API, and webhooks. You can restrict where it
          runs before anything goes live.
        </p>
        <Button
          onClick={() => api.create.mutate({ name: `${agent.name} deployment` })}
          loading={api.create.isPending}
          className="gap-2 font-semibold"
        >
          <Sparkles className="size-4" />
          Create a deployment
        </Button>
      </div>
    );
  }

  const live = deployment.status === 'ACTIVE';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card/60 px-6 py-4 backdrop-blur-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar agent={agent} size="lg" className="shadow-xs" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-bold text-foreground">{agent.name}</h1>
                <Badge variant={live ? 'success' : deployment.status === 'SUSPENDED' ? 'destructive' : 'outline'} className="font-mono text-[10px] font-semibold uppercase tracking-wider">
                  {deployment.status}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] text-primary">
                  {deployment.environment}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {deployment.publishedVersionTag ?? `v${deployment.versionNumber}`}
                </Badge>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{agent.description || agent.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <Button size="sm" onClick={() => openPublish()} className="gap-1.5 text-xs font-semibold">
              <Rocket className="size-3.5" /> Publish a version
            </Button>
          </div>
        </div>

        <ResponsiveTabs
          className="-mb-2 mt-4 border-t border-border/60 pt-2"
          variant="pill"
          size="sm"
          value={section}
          onValueChange={(value) => setSection(value as DeploymentSection)}
          items={[
            { value: 'overview', label: 'Overview', icon: <Activity className="size-3.5" /> },
            { value: 'targets', label: 'Install & call', icon: <Globe className="size-3.5" /> },
            { value: 'widget', label: 'Widget Studio', icon: <Palette className="size-3.5" /> },
            { value: 'webhooks', label: 'Webhooks', icon: <Zap className="size-3.5" />, count: api.webhooksQuery.data?.length || undefined },
            { value: 'api-keys', label: 'API keys', icon: <KeyRound className="size-3.5" /> },
            { value: 'versions', label: 'Versions', icon: <History className="size-3.5" /> },
          ]}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-6">
        {section === 'overview' && (
          <OverviewPanel api={api} deployment={deployment} toolCount={countTools(agent.tools)} onNavigate={setSection} />
        )}
        {section === 'targets' && <TargetsPanel deployment={deployment} agentId={agent.id} onNavigate={setSection} />}
        {section === 'widget' && <WidgetStudioPanel api={api} deployment={deployment} agentName={agent.name} />}
        {section === 'webhooks' && <WebhooksPanel api={api} deployment={deployment} />}
        {section === 'api-keys' && <ApiKeysManager workspaceId={api.workspaceId} />}
        {section === 'versions' && <VersionsPanel api={api} deployment={deployment} onPublish={openPublish} />}
      </div>

      <PublishDialog api={api} deployment={deployment} open={publishOpen} initialVersion={publishVersion} onOpenChange={setPublishOpen} />
    </div>
  );
}
