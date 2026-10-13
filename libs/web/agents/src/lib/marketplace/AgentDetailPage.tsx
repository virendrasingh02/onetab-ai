import React, { useState } from 'react';
import type { MarketplaceListingDetail } from '@org/types';
import { Button, Card, Skeleton, SkeletonList } from '@org/ui';
import {
  EntityIcon,
  KindBadge,
  OriginBadge,
  ListingActionButton,
  SectionTabs,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';
import {
  ArrowLeft,
  Check,
  MessageSquare,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react';

type AgentTab = 'overview' | 'capabilities' | 'tools' | 'security';

const AGENT_TABS: { value: AgentTab; label: string }[] = [
  { value: 'overview', label: 'Overview & persona' },
  { value: 'capabilities', label: 'Capabilities & boundaries' },
  { value: 'tools', label: 'Tools & commands' },
  { value: 'security', label: 'Safety & boundaries' },
];

interface AgentDetailPageProps {
  agent: MarketplaceListingDetail;
  isLoading?: boolean;
  onBack: () => void;
  onInstall: () => void;
  onRequestAccess: () => void;
  onConfigure: () => void;
  onUninstall: () => void;
  onStartChat?: (prompt?: string) => void;
}

export const AgentDetailPage: React.FC<AgentDetailPageProps> = ({
  agent,
  isLoading,
  onBack,
  onInstall,
  onRequestAccess,
  onConfigure,
  onUninstall,
  onStartChat,
}) => {
  const [activeTab, setActiveTab] = useState<AgentTab>('overview');

  if (isLoading) {
    return (
      <div className="py-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-32 rounded-2xl" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  const action = listingActionState(agent);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft aria-hidden />
        Back to agents directory
      </Button>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/70">
        <div className="flex items-start gap-4 min-w-0">
          <EntityIcon iconUrl={agent.iconUrl} kind={agent.kind} className="size-16" />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
                {agent.name}
              </h1>
              <KindBadge kind={agent.kind} long />
              <OriginBadge listing={agent} />
              <VerifiedBadge
                badge={agent.badge}
                label={
                  agent.badge === 'OFFICIAL' ? 'Official agent' : 'Verified publisher'
                }
              />
            </div>

            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {agent.tagline || agent.description}
            </p>

            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              <span>By <strong className="text-foreground">{agent.publisher?.name || agent.publisherName || 'OneTab AI'}</strong></span>
              <span>•</span>
              <span>{agent.category}</span>
              <span>•</span>
              <span className="font-mono">v{agent.version || '1.0.0'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="gap-2 flex shrink-0 items-center self-start md:self-center">
          {action.installed && onStartChat && (
            <Button variant="primary" size="sm" onClick={() => onStartChat()}>
              <MessageSquare aria-hidden />
              Chat with agent
            </Button>
          )}
          <ListingActionButton
            {...action}
            size="sm"
            installLabel="Install agent"
            installedLabel="Configure"
            requestLabel="Request access"
            pendingLabel="Approval pending"
            onInstall={onInstall}
            onRequestAccess={onRequestAccess}
            onConfigure={onConfigure}
          />
          {action.installed && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onUninstall}
              aria-label="Uninstall agent"
              title="Uninstall"
              className="hover:text-destructive-text"
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Example prompts */}
      {agent.examplePrompts && agent.examplePrompts.length > 0 && (
        <Card className="p-4 gap-2.5 bg-surface-raised/40">
          <div className="gap-2 text-xs font-semibold flex items-center text-foreground">
            <Sparkles className="size-3.5 text-accent-amber" aria-hidden />
            <span>Example instructions & prompts</span>
          </div>
          <div className="gap-2 flex flex-wrap">
            {agent.examplePrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => (onStartChat ? onStartChat(prompt) : onInstall())}
                className="h-auto py-1.5 text-left font-normal whitespace-normal"
              >
                “{prompt}”
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Main Content & Side Rail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6">
          <SectionTabs
            variant="underline"
            aria-label="Agent details"
            value={activeTab}
            onValueChange={setActiveTab}
            items={AGENT_TABS}
          />

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed whitespace-pre-line">
                {agent.description}
              </div>

              {agent.capabilities && (
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <h3 className="text-sm font-semibold text-foreground">
                    Core Autonomous Behaviors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {agent.capabilities.map((cap, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border/70 text-xs text-foreground"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
                        <span>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: CAPABILITIES & BOUNDARIES */}
          {activeTab === 'capabilities' && (
            <div className="space-y-6">
              <Card className="p-5 space-y-3">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Operational Scope & Safeguards
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {agent.security?.dataBoundaries ||
                    'Operates strictly inside the assigned workspace. Never shares reasoning or data across workspace boundaries.'}
                </p>
              </Card>
            </div>
          )}

          {/* TAB: TOOLS & COMMANDS */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Available Slash Commands
                </h3>
                {(!agent.commands || agent.commands.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">
                    Invoke via direct chat or `@` mentions.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
                    {agent.commands.map((cmd) => (
                      <div key={cmd.command} className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <Terminal className="size-4 text-primary-text" aria-hidden />
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {cmd.command} {cmd.args || ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                          {cmd.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Data Privacy & Model Safety
              </h3>

              <Card className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Data Read Scope</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {agent.security?.dataAccessed?.join(', ') || 'Channel messages and explicit uploads only.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-semibold text-foreground">LLM Provider</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {agent.security?.externalServices?.join(', ') || 'Internal OneTab Orchestrator'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-semibold text-foreground">Retention Policy</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {agent.security?.dataStorage || 'No secondary storage of prompts or reasoning chains.'}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Side Rail Column */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agent Specifications
            </h3>

            <div className="space-y-3 text-xs divide-y divide-border/60">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-semibold text-foreground">AI Agent</span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Publisher</span>
                <span className="font-semibold text-foreground">
                  {agent.publisherName || 'OneTab AI'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-semibold text-foreground">
                  {agent.category}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Access Level</span>
                <span className="font-semibold text-foreground">
                  {agent.requiresAdmin ? 'Admin Approval Required' : 'User Installable'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Pricing</span>
                <span className="font-semibold text-success-text">
                  {agent.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
