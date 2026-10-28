import React, { useState } from 'react';
import type { MarketplaceListingDetail } from '@org/types';
import { Button } from '@org/ui';
import {
  KindBadge,
  OriginBadge,
  ListingActionButton,
  SectionTabs,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';
import {
  CheckGrid,
  CommandList,
  DetailDescription,
  DetailSection,
  EmptyNote,
  FactsCard,
  InfoPanel,
  ListingDetailHeader,
  ListingDetailLayout,
  ListingDetailSkeleton,
  commonFacts,
} from './listing-detail-ui';
import {
  ArrowUpRight,
  Archive,
  Cpu,
  Database,
  Globe,
  Lock,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';

type AgentTab = 'overview' | 'commands' | 'safety';

const AGENT_TABS: { value: AgentTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'commands', label: 'Commands' },
  { value: 'safety', label: 'Safety & data' },
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

  if (isLoading) return <ListingDetailSkeleton />;

  const action = listingActionState(agent);
  const canChat = Boolean(action.installed && onStartChat);
  const prompts = agent.examplePrompts ?? [];
  const facts = commonFacts(agent);
  const security = agent.security;

  return (
    <ListingDetailLayout
      backLabel="Back to agents"
      onBack={onBack}
      header={
        <ListingDetailHeader
          listing={agent}
          badges={
            <>
              <KindBadge kind={agent.kind} long />
              <VerifiedBadge
                badge={agent.badge}
                label={agent.badge === 'OFFICIAL' ? 'Official agent' : 'Verified publisher'}
              />
              <OriginBadge listing={agent} />
            </>
          }
          actions={
            <>
              {canChat && (
                <Button variant="primary" size="sm" onClick={() => onStartChat?.()}>
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
            </>
          }
        />
      }
      tabs={
        <SectionTabs
          variant="underline"
          aria-label="Agent details"
          value={activeTab}
          onValueChange={setActiveTab}
          items={AGENT_TABS}
        />
      }
      rail={
        <FactsCard
          title="About this agent"
          rows={[
            { label: 'Type', value: 'AI agent' },
            facts.publisher,
            facts.category,
            facts.version,
            {
              label: 'Access',
              value: agent.requiresAdmin ? 'Admin approval' : 'Anyone can install',
            },
            facts.pricing,
            facts.updated,
          ]}
        />
      }
    >
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <DetailDescription listing={agent} />

          {prompts.length > 0 && (
            <DetailSection
              title="Try asking"
              icon={<Sparkles className="size-4 text-accent-amber" aria-hidden />}
              description={
                canChat
                  ? 'Pick a prompt to start a chat with this agent.'
                  : 'Install the agent, then start with one of these.'
              }
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => (canChat ? onStartChat?.(prompt) : onInstall())}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface p-3.5 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="leading-snug">“{prompt}”</span>
                    <ArrowUpRight
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary-text"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </DetailSection>
          )}

          <DetailSection title="What it does">
            {agent.capabilities && agent.capabilities.length > 0 ? (
              <CheckGrid items={agent.capabilities} />
            ) : (
              <EmptyNote>The publisher hasn’t listed this agent’s capabilities yet.</EmptyNote>
            )}
          </DetailSection>
        </div>
      )}

      {activeTab === 'commands' && (
        <DetailSection
          title="Slash commands"
          description="Use these in any channel or DM where the agent is present. You can also @mention it or chat with it directly."
        >
          <CommandList
            commands={agent.commands}
            emptyText="This agent has no slash commands — @mention it or chat with it directly."
          />
        </DetailSection>
      )}

      {activeTab === 'safety' && (
        <DetailSection
          title="Safety & data"
          description="What this agent can read, where it sends data, and the limits it works within."
        >
          <InfoPanel
            rows={[
              {
                label: 'Data it can read',
                icon: <Database aria-hidden />,
                value:
                  security?.dataAccessed?.join(', ') ||
                  'Channel messages and files explicitly shared with it.',
              },
              {
                label: 'Model provider',
                icon: <Cpu aria-hidden />,
                value: security?.modelProvider || 'Onetab orchestrator',
              },
              ...(security?.externalServices?.length
                ? [
                    {
                      label: 'External services',
                      icon: <Globe aria-hidden />,
                      value: security.externalServices.join(', '),
                    },
                  ]
                : []),
              {
                label: 'Data retention',
                icon: <Archive aria-hidden />,
                value:
                  security?.dataStorage || 'Prompts and reasoning are not stored outside Onetab.',
              },
              {
                label: 'Workspace boundaries',
                icon: <Lock aria-hidden />,
                value:
                  security?.dataBoundaries ||
                  'Works only inside the workspace it is installed in and never shares data across workspaces.',
              },
              ...(security?.approvalRequiredActions?.length
                ? [
                    {
                      label: 'Needs your approval to',
                      icon: <ShieldAlert aria-hidden />,
                      value: (
                        <ul className="list-disc space-y-0.5 pl-4">
                          {security.approvalRequiredActions.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </DetailSection>
      )}
    </ListingDetailLayout>
  );
};
