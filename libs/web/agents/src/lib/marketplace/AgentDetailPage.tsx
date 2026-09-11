import React, { useState } from 'react';
import type { MarketplaceListingDetail } from '@org/types';
import { Button, Card, SkeletonList } from '@org/ui';
import { renderEntityIcon } from './MarketplaceCard';
import {
  ArrowLeft,
  Bot,
  Check,
  Clock,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react';
import { cn } from '@org/utils';

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
  const [activeTab, setActiveTab] = useState<
    'overview' | 'capabilities' | 'tools' | 'security' | 'prompts'
  >('overview');

  if (isLoading) {
    return (
      <div className="py-6 space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-32 rounded-lg bg-surface-raised animate-pulse" />
        <div className="h-32 rounded-2xl bg-surface-raised animate-pulse" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  const isInstalled = Boolean(agent.installed);
  const isPending = agent.approvalStatus === 'PENDING';
  const requiresAdmin = Boolean(agent.requiresAdmin);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-8">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to Agents Directory
      </button>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/70">
        <div className="flex items-start gap-4 min-w-0">
          {renderEntityIcon(agent.iconUrl ?? undefined, agent.kind, 'size-16')}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {agent.name}
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Bot className="size-3.5" />
                Autonomous AI Agent
              </span>
              {agent.badge === 'OFFICIAL' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="size-3.5" />
                  Official Agent
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {agent.tagline || agent.description}
            </p>

            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              <span>By <strong className="text-foreground">{agent.publisherName || 'OneTab AI'}</strong></span>
              <span>•</span>
              <span>{agent.category}</span>
              <span>•</span>
              <span className="font-mono">v{agent.version || '1.0.0'}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 self-start md:self-center flex-shrink-0">
          {isInstalled ? (
            <div className="flex items-center gap-2">
              {onStartChat && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onStartChat()}
                  className="text-xs font-semibold shadow-xs"
                >
                  <MessageSquare className="size-3.5 mr-1.5" />
                  Chat with Agent
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onConfigure}
                className="text-xs"
              >
                Configure
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUninstall}
                className="text-xs text-rose-500 hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : isPending ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30"
            >
              <Clock className="size-3.5 mr-1.5 animate-pulse" />
              Approval Pending
            </Button>
          ) : requiresAdmin ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onRequestAccess}
              className="text-xs font-semibold shadow-xs"
            >
              <Lock className="size-3.5 mr-1.5" />
              Request Access
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onInstall}
              className="text-xs font-semibold shadow-xs"
            >
              Install Agent
            </Button>
          )}
        </div>
      </div>

      {/* Example Prompt Chips (Linear / AI-native style) */}
      {agent.examplePrompts && agent.examplePrompts.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-surface-raised/40 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Example Instructions & Prompts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {agent.examplePrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => (onStartChat ? onStartChat(prompt) : onInstall())}
                className="text-left text-xs px-3 py-1.5 rounded-xl bg-surface border border-border/80 hover:border-primary/60 text-muted-foreground hover:text-foreground transition-all shadow-xs"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content & Side Rail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Detail Tabs Bar */}
          <div className="flex items-center gap-1 border-b border-border/70 pb-2">
            {[
              { id: 'overview', label: 'Overview & Persona' },
              { id: 'capabilities', label: 'Capabilities & Boundaries' },
              { id: 'tools', label: 'Tools & Commands' },
              { id: 'security', label: 'Safety & Boundaries' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-surface-raised text-foreground font-semibold border border-border/80 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed whitespace-pre-line">
                {agent.description}
              </div>

              {agent.capabilities && (
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <h3 className="text-sm font-bold text-foreground">
                    Core Autonomous Behaviors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {agent.capabilities.map((cap, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border/70 text-xs text-foreground"
                      >
                        <Check className="size-4 text-purple-500 flex-shrink-0 mt-0.5" />
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
              <div className="rounded-xl border border-border/80 p-5 bg-surface space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Operational Scope & Safeguards
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {agent.security?.dataBoundaries ||
                    'Operates strictly inside the assigned workspace. Never shares reasoning or data across workspace boundaries.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB: TOOLS & COMMANDS */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">
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
                          <Terminal className="size-4 text-primary" />
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
              <h3 className="text-sm font-bold text-foreground">
                Data Privacy & Model Safety
              </h3>

              <Card className="p-5 space-y-4 bg-surface border-border/80 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Data Read Scope</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {agent.security?.dataAccessed?.join(', ') || 'Channel messages and explicit uploads only.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-bold text-foreground">LLM Provider</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {agent.security?.externalServices?.join(', ') || 'Internal OneTab Orchestrator'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-bold text-foreground">Retention Policy</h4>
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
          <Card className="p-5 bg-surface border-border/80 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
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
