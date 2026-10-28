import React, { useState } from 'react';
import type { MarketplaceListingDetail } from '@org/types';
import { Badge, Button } from '@org/ui';
import {
  KindBadge,
  ListingActionButton,
  OriginBadge,
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
import { Archive, Database, ExternalLink, KeyRound, Lock, Trash2 } from 'lucide-react';

type AppTab = 'overview' | 'features' | 'permissions' | 'security' | 'changelog';

const APP_TABS: { value: AppTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'features', label: 'Commands' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'security', label: 'Security & data' },
  { value: 'changelog', label: 'Changelog' },
];

interface AppDetailPageProps {
  app: MarketplaceListingDetail;
  isLoading?: boolean;
  onBack: () => void;
  onInstall: () => void;
  onRequestAccess: () => void;
  onConfigure: () => void;
  onUninstall: () => void;
}

export const AppDetailPage: React.FC<AppDetailPageProps> = ({
  app,
  isLoading,
  onBack,
  onInstall,
  onRequestAccess,
  onConfigure,
  onUninstall,
}) => {
  const [activeTab, setActiveTab] = useState<AppTab>('overview');

  if (isLoading) return <ListingDetailSkeleton />;

  const action = listingActionState(app);
  const facts = commonFacts(app);

  return (
    <ListingDetailLayout
      backLabel="Back to apps"
      onBack={onBack}
      header={
        <ListingDetailHeader
          listing={app}
          badges={
            <>
              <KindBadge kind={app.kind} />
              <VerifiedBadge
                badge={app.badge}
                label={app.badge === 'OFFICIAL' ? 'Official integration' : 'Verified publisher'}
              />
              <OriginBadge listing={app} />
            </>
          }
          actions={
            <>
              <ListingActionButton
                {...action}
                size="sm"
                installLabel="Install app"
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
                  aria-label="Uninstall app"
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
          aria-label="App details"
          value={activeTab}
          onValueChange={setActiveTab}
          items={APP_TABS}
        />
      }
      rail={
        <FactsCard
          title="About this app"
          rows={[
            facts.publisher,
            facts.category,
            facts.version,
            {
              label: 'Platforms',
              value: app.compatibility?.platforms?.join(', ') || 'Web, Desktop, Mobile',
            },
            facts.pricing,
            facts.updated,
          ]}
          footer={
            <a
              href="https://onetab.ai/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary-text hover:underline"
            >
              Documentation & setup
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          }
        />
      }
    >
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {app.screenshots && app.screenshots.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border/60 shadow-xs">
              <img
                src={app.screenshots[0]}
                alt={`${app.name} preview`}
                className="h-64 w-full object-cover"
              />
            </div>
          )}

          <DetailDescription listing={app} />

          <DetailSection title="What it does">
            {app.capabilities && app.capabilities.length > 0 ? (
              <CheckGrid items={app.capabilities} />
            ) : (
              <EmptyNote>The publisher hasn’t listed this app’s capabilities yet.</EmptyNote>
            )}
          </DetailSection>
        </div>
      )}

      {activeTab === 'features' && (
        <DetailSection
          title="Slash commands"
          description="Workspace members can run these in any channel or DM once the app is installed."
        >
          <CommandList
            commands={app.commands}
            emptyText="This app doesn’t declare any slash commands."
          />
        </DetailSection>
      )}

      {activeTab === 'permissions' && (
        <DetailSection
          title="Requested permissions"
          description="Access this app asks for inside your workspace."
        >
          {!app.permissions || app.permissions.length === 0 ? (
            <EmptyNote>This app doesn’t request any workspace permissions.</EmptyNote>
          ) : (
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
              {app.permissions.map((perm) => (
                <div key={perm.scope} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{perm.name}</span>
                      <code className="font-mono text-xs text-muted-foreground">{perm.scope}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">{perm.description}</p>
                  </div>
                  <Badge
                    variant={perm.level === 'ADMIN' ? 'destructive' : 'neutral'}
                    className="uppercase"
                  >
                    {perm.level}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {activeTab === 'security' && (
        <DetailSection
          title="Security & data"
          description="How this app authenticates, what it reads, and where data goes."
        >
          <InfoPanel
            rows={[
              {
                label: 'Data it can read',
                icon: <Database aria-hidden />,
                value:
                  app.security?.dataAccessed?.join(', ') ||
                  'Only data explicitly submitted in channels where the app is present.',
              },
              {
                label: 'Authentication',
                icon: <KeyRound aria-hidden />,
                value: app.security?.authentication || 'OAuth 2.0 with PKCE & workspace tokens',
              },
              {
                label: 'Data retention',
                icon: <Archive aria-hidden />,
                value:
                  app.security?.dataStorage ||
                  'Data processed in memory; no long-term persistent storage outside Onetab.',
              },
              {
                label: 'Workspace boundaries',
                icon: <Lock aria-hidden />,
                value:
                  app.security?.dataBoundaries ||
                  'Workspace-level isolation enforced cryptographically.',
              },
            ]}
          />
        </DetailSection>
      )}

      {activeTab === 'changelog' && (
        <DetailSection title="Changelog">
          <ol className="space-y-3">
            {(app.changelog && app.changelog.length > 0
              ? app.changelog
              : [
                  {
                    version: app.version || '1.0.0',
                    date: '',
                    notes: 'Initial release on the Onetab marketplace.',
                  },
                ]
            ).map((log) => (
              <li
                key={log.version}
                className="space-y-1 rounded-xl border border-border/70 bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    v{log.version}
                  </span>
                  {log.date ? (
                    <span className="text-xs text-muted-foreground">{log.date}</span>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{log.notes}</p>
              </li>
            ))}
          </ol>
        </DetailSection>
      )}
    </ListingDetailLayout>
  );
};
