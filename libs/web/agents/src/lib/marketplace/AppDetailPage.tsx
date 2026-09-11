import React, { useState } from 'react';
import type { MarketplaceListingDetail } from '@org/types';
import { Button, Card, SkeletonList } from '@org/ui';
import { renderEntityIcon } from './MarketplaceCard';
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Globe,
  Lock,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { cn } from '@org/utils';

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
  const [activeTab, setActiveTab] = useState<
    'overview' | 'features' | 'permissions' | 'security' | 'changelog'
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

  const isInstalled = Boolean(app.installed);
  const isPending = app.approvalStatus === 'PENDING';
  const requiresAdmin = Boolean(app.requiresAdmin);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-8">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to Directory
      </button>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/70">
        <div className="flex items-start gap-4 min-w-0">
          {renderEntityIcon(app.iconUrl ?? undefined, app.kind, 'size-16')}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {app.name}
              </h1>
              {app.badge === 'OFFICIAL' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="size-3.5" />
                  Official Integration
                </span>
              )}
              {app.badge === 'VERIFIED' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="size-3.5" />
                  Verified Publisher
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {app.tagline || app.description}
            </p>

            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              <span>By <strong className="text-foreground">{app.publisherName || 'OneTab AI'}</strong></span>
              <span>•</span>
              <span>{app.category}</span>
              <span>•</span>
              <span className="font-mono">v{app.version || '1.0.0'}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 self-start md:self-center flex-shrink-0">
          {isInstalled ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onConfigure}
                className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                <Check className="size-3.5 mr-1.5" />
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
              Install App
            </Button>
          )}
        </div>
      </div>

      {/* Main Content & Side Rail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Detail Tabs Bar */}
          <div className="flex items-center gap-1 border-b border-border/70 pb-2">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'features', label: 'Features & Commands' },
              { id: 'permissions', label: 'Permissions' },
              { id: 'security', label: 'Security & Compliance' },
              { id: 'changelog', label: 'Changelog' },
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
              {/* Screenshots preview */}
              {app.screenshots && app.screenshots.length > 0 && (
                <div className="rounded-2xl border border-border/80 overflow-hidden shadow-xs">
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
                  <h3 className="text-sm font-bold text-foreground">
                    Key Workflows & Capabilities
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {app.capabilities.map((cap, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border/70 text-xs text-foreground"
                      >
                        <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />
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
                <h3 className="text-sm font-bold text-foreground">
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

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">
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

                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0',
                        perm.level === 'ADMIN'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : 'bg-surface-raised border-border text-muted-foreground',
                      )}
                    >
                      {perm.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SECURITY & COMPLIANCE */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                Security, Data & Privacy
              </h3>

              <Card className="p-5 space-y-4 bg-surface border-border/80 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Data Accessed</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.dataAccessed?.join(', ') ||
                      'Only data explicitly submitted in channels where the app is present.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-bold text-foreground">Authentication</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.authentication || 'OAuth 2.0 with PKCE & workspace tokens'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-bold text-foreground">Data Retention</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.security?.dataStorage || 'Data processed in memory; no long-term persistent storage outside OneTab.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <h4 className="text-xs font-bold text-foreground">Data Boundaries</h4>
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
              <h3 className="text-sm font-bold text-foreground">
                Changelog & Releases
              </h3>

              {(!app.changelog || app.changelog.length === 0) ? (
                <div className="rounded-xl border border-border/70 p-4 bg-surface">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      v{app.version || '1.0.0'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • Initial Marketplace Release
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Initial official release for OneTab AI platform.
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
                        <span className="font-mono text-xs font-bold text-foreground">
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
          <Card className="p-5 bg-surface border-border/80 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Integration Details
            </h3>

            <div className="space-y-3 text-xs divide-y divide-border/60">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Developer</span>
                <span className="font-semibold text-foreground">
                  {app.publisherName || 'OneTab AI'}
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
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
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
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
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
