import React, { useState } from 'react';
import type { MarketplaceListingDetail } from '@org/types';
import { Badge, Button, Card, Skeleton, SkeletonList } from '@org/ui';
import {
  EntityIcon,
  ListingActionButton,
  SectionTabs,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';
import { ArrowLeft, Check, ExternalLink, Globe, Terminal, Trash2 } from 'lucide-react';

type AppTab = 'overview' | 'features' | 'permissions' | 'security' | 'changelog';

const APP_TABS: { value: AppTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'features', label: 'Features & commands' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'security', label: 'Security & compliance' },
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

  if (isLoading) {
    return (
      <div className="py-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-32 rounded-2xl" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  const action = listingActionState(app);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft aria-hidden />
        Back to directory
      </Button>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/70">
        <div className="flex items-start gap-4 min-w-0">
          <EntityIcon iconUrl={app.iconUrl} kind={app.kind} className="size-16" />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
                {app.name}
              </h1>
              <VerifiedBadge
                badge={app.badge}
                label={
                  app.badge === 'OFFICIAL' ? 'Official integration' : 'Verified publisher'
                }
              />
            </div>

            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {app.tagline || app.description}
            </p>

            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              <span>By <strong className="text-foreground">{app.publisherName || 'Onetab AI'}</strong></span>
              <span>•</span>
              <span>{app.category}</span>
              <span>•</span>
              <span className="font-mono">v{app.version || '1.0.0'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="gap-2 flex shrink-0 items-center self-start md:self-center">
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
        </div>
      </div>

      {/* Main Content & Side Rail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6">
          <SectionTabs
            variant="underline"
            aria-label="App details"
            value={activeTab}
            onValueChange={setActiveTab}
            items={APP_TABS}
          />

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Screenshots preview */}
              {app.screenshots && app.screenshots.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-border/60 shadow-xs">
                  <img
                    src={app.screenshots[0]}
                    alt="App preview"
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              {/* Description body */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed whitespace-pre-line">
                {app.description}
              </div>

              {/* Capabilities */}
              {app.capabilities && app.capabilities.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <h3 className="text-sm font-semibold text-foreground">
                    Key Workflows & Capabilities
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {app.capabilities.map((cap, i) => (
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

          {/* TAB: FEATURES & COMMANDS */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Slash Commands
                </h3>
                <p className="text-xs text-muted-foreground">
                  Workspace members can execute these commands in any channel or direct message once this app is installed.
                </p>

                {(!app.commands || app.commands.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">
                    No slash commands declared for this application.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
                    {app.commands.map((cmd) => (
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

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Requested Scopes & Permissions
              </h3>
              <p className="text-xs text-muted-foreground">
                This integration requests the following access rights within your workspace:
              </p>

              <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
                {(app.permissions || []).map((perm) => (
                  <div
                    key={perm.scope}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {perm.name}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ({perm.scope})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {perm.description}
                      </p>
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
            </div>
          )}

          {/* TAB: SECURITY & COMPLIANCE */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Security, Data & Privacy
              </h3>

              <Card className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Data Accessed</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.dataAccessed?.join(', ') ||
                      'Only data explicitly submitted in channels where the app is present.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-semibold text-foreground">Authentication</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.authentication || 'OAuth 2.0 with PKCE & workspace tokens'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-semibold text-foreground">Data Retention</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.dataStorage || 'Data processed in memory; no long-term persistent storage outside Onetab.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-semibold text-foreground">Data Boundaries</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.dataBoundaries || 'Workspace-level isolation enforced cryptographically.'}
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* TAB: CHANGELOG */}
          {activeTab === 'changelog' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Changelog & Releases
              </h3>

              {(!app.changelog || app.changelog.length === 0) ? (
                <div className="rounded-xl border border-border/70 p-4 bg-surface">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      v{app.version || '1.0.0'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • Initial Marketplace Release
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Initial official release for Onetab AI platform.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {app.changelog.map((log) => (
                    <div
                      key={log.version}
                      className="rounded-xl border border-border/70 p-4 bg-surface space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          v{log.version}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.date}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {log.notes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Rail Column */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Integration Details
            </h3>

            <div className="space-y-3 text-xs divide-y divide-border/60">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Developer</span>
                <span className="font-semibold text-foreground">
                  {app.publisherName || 'Onetab AI'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-semibold text-foreground">
                  {app.category}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Pricing</span>
                <span className="font-semibold text-success-text">
                  {app.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono font-semibold text-foreground">
                  {app.version || '1.0.0'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Compatibility</span>
                <span className="font-semibold text-foreground">
                  {app.compatibility?.platforms?.join(', ') || 'Web, Desktop, Mobile'}
                </span>
              </div>
            </div>

            {/* Links */}
            <div className="pt-3 border-t border-border/60 space-y-2">
              <a
                href="https://onetab.ai/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary-text hover:underline"
              >
                <Globe className="size-3.5" />
                Documentation & Setup
                <ExternalLink className="size-3 ml-0.5" />
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
