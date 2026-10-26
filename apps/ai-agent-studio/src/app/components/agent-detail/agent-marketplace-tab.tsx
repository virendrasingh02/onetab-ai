import { agentsApi, queryKeys } from '@org/api-client';
import type { AIAgentDetail, MarketplaceListing, MarketplaceVisibility } from '@org/types';
import { Badge, Button, Card, confirm, ErrorState, Field, Input, LoadingState, SegmentedControl, Textarea, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe, Lock, Rocket, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WEB_APP_URL } from '../../auth-redirect.js';
import { useStudioSession } from '../../session-guard.js';
import { AgentTabPage, AgentTabSection } from './agent-tab-page.js';
import { errorMessage } from './deployment/use-deployment.js';

const VISIBILITY_OPTIONS = [
  { value: 'WORKSPACE', label: 'My workspace', hint: 'Only members of this workspace can find and install it' },
  { value: 'PUBLIC', label: 'Everyone', hint: 'Every workspace can find and install it' },
] as const;

const publishedVersion = (agent: AIAgentDetail): number | null => {
  const config = agent.configuration as { status?: unknown; currentVersion?: unknown };
  return config.status === 'published' ? Number(config.currentVersion) || 1 : null;
};

/**
 * Where an agent built here is shared. The marketplace is the only way agents
 * reach a workspace's sidebar from outside, so "publish" in Studio ends here:
 * a listing carrying a snapshot of the agent's latest published version.
 */
export function AgentMarketplaceTab({ agent }: { agent: AIAgentDetail }) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();
  const key = [...queryKeys.agents.detail(workspaceId, agent.id), 'marketplace'] as const;

  const listingQuery = useQuery({
    queryKey: key,
    queryFn: () => agentsApi.marketplaceListing(workspaceId, agent.id),
    enabled: !!workspaceId,
  });
  const listing: MarketplaceListing | null | undefined = listingQuery.data;
  const live = !!listing && listing.status === 'PUBLISHED';

  const [visibility, setVisibility] = useState<MarketplaceVisibility>('WORKSPACE');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('');
  const [changeNotes, setChangeNotes] = useState('');

  // Start the form from what's already listed, otherwise from the agent itself.
  useEffect(() => {
    if (listingQuery.isLoading) return;
    setVisibility(listing?.visibility ?? 'WORKSPACE');
    setTagline(listing?.tagline ?? agent.description ?? '');
    setCategory(listing?.category ?? agent.role ?? '');
    setChangeNotes('');
  }, [listingQuery.isLoading, listing?.id, listing?.version, listing?.visibility, agent.id]);

  const version = publishedVersion(agent);

  const publish = useMutation({
    mutationFn: () =>
      agentsApi.publishToMarketplace(workspaceId, agent.id, {
        visibility,
        tagline: tagline.trim() || undefined,
        category: category.trim() || undefined,
        changeNotes: changeNotes.trim() || undefined,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.all() });
      toast.success(live ? 'Listing updated' : 'Published to the marketplace', {
        description: `${next.name} v${next.version} · ${next.visibility === 'PUBLIC' ? 'visible to everyone' : 'visible to this workspace'}`,
      });
    },
    onError: (err) => toast.error('Could not publish', { description: errorMessage(err) }),
    meta: { disableToast: true },
  });

  // Dry run: what installers will be asked to approve, and whether the package is accepted at all.
  const validate = useMutation({
    mutationFn: () =>
      agentsApi.validateForMarketplace(workspaceId, agent.id, {
        visibility,
        tagline: tagline.trim() || undefined,
        category: category.trim() || undefined,
      }),
    onError: (err) => toast.error('Could not check the package', { description: errorMessage(err) }),
    meta: { disableToast: true },
  });

  const unpublish = useMutation({
    mutationFn: () => agentsApi.unpublishFromMarketplace(workspaceId, agent.id),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.all() });
      toast.success('Removed from the marketplace', { description: 'Workspaces that already installed it keep their copy.' });
    },
    onError: (err) => toast.error('Could not remove the listing', { description: errorMessage(err) }),
    meta: { disableToast: true },
  });

  const onUnpublish = async () => {
    const ok = await confirm({
      title: `Remove ${agent.name} from the marketplace?`,
      description: 'It stops appearing for new installs. Workspaces that already installed it keep their copy.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) unpublish.mutate();
  };

  if (listingQuery.isLoading) return <LoadingState label="Loading marketplace listing…" />;
  if (listingQuery.isError) {
    return (
      <ErrorState title="Couldn’t load the marketplace listing" description={errorMessage(listingQuery.error)} onRetry={() => void listingQuery.refetch()} />
    );
  }

  const marketplaceHref = `${WEB_APP_URL.replace(/\/+$/, '')}/w/${activeWorkspace.slug}/marketplace?tab=${
    listing ? `agents&agent=${listing.slug}` : 'workspace&type=agent'
  }`;
  const behind = live && version !== null && Number(listing?.version.split('.')[0]) < version;

  return (
    <AgentTabPage
      title="Marketplace"
      description={`Publish ${agent.name} to the marketplace. Members add it to their sidebar from there; each install is an independent copy of the version you publish.`}
      icon={<Store />}
      actions={
        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <a href={marketplaceHref} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> View in marketplace
          </a>
        </Button>
      }
    >
      <div className={cn('grid items-start gap-6', listing && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]')}>
        {version === null ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Publish this agent first (the Draft chip in the header). Only a published version can be shared — the draft on your canvas never is.
          </Card>
        ) : (
          <AgentTabSection title={live ? 'Update the listing' : 'Listing details'} icon={<Rocket />}>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-foreground">Who can install it</span>
              <SegmentedControl
                aria-label="Who can install it"
                options={VISIBILITY_OPTIONS}
                value={visibility}
                onChange={(next) => setVisibility(next as MarketplaceVisibility)}
                size="sm"
              />
              <p className="text-xs text-muted-foreground">{VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tagline" hint="One line shown on the listing card.">
                <Input value={tagline} maxLength={160} onChange={(e) => setTagline(e.target.value)} placeholder="What does it do for the team?" />
              </Field>
              <Field label="Category">
                <Input value={category} maxLength={60} onChange={(e) => setCategory(e.target.value)} placeholder="Productivity, Support, Engineering…" />
              </Field>
            </div>
            <Field label="What's new" optional>
              <Textarea value={changeNotes} maxLength={500} rows={2} onChange={(e) => setChangeNotes(e.target.value)} placeholder="Shown in the listing's changelog" />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
              <p className="text-xs text-muted-foreground">Publishes v{version}. Tools that need credentials must be reconnected by whoever installs it.</p>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => validate.mutate()} loading={validate.isPending}>
                <ShieldCheck className="size-3.5" /> Check &amp; preview
              </Button>
              <Button size="sm" className="gap-1.5 text-xs font-semibold" onClick={() => publish.mutate()} loading={publish.isPending}>
                <Rocket className="size-3.5" /> {live ? 'Update listing' : 'Publish to marketplace'}
              </Button>
            </div>
            {validate.data && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-surface-raised/40 p-3" role="status">
                {validate.data.valid ? (
                  <>
                    <p className="text-xs font-semibold text-foreground">Ready to publish as v{validate.data.version}. Installers will be shown:</p>
                    <ul className="space-y-1">
                      {validate.data.permissions.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs">
                          {p.sensitive ? <ShieldAlert className="size-3.5 text-warning-text" aria-hidden /> : <ShieldCheck className="size-3.5 text-success-text" aria-hidden />}
                          <span className="text-foreground">{p.label}</span>
                          {p.sensitive && <Badge variant="warning" className="text-2xs">Needs admin approval</Badge>}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-destructive-text">This package can’t be published yet:</p>
                    <ul className="list-disc pl-4 text-xs text-foreground">
                      {validate.data.issues.map((i) => (
                        <li key={i.message}>{i.message}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </AgentTabSection>
        )}

        {listing && (
          <AgentTabSection title="Current listing" icon={<Store />} className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{listing.name}</span>
              <Badge variant={live ? 'success' : 'outline'} className="text-2xs font-semibold uppercase tracking-wider">
                {live ? 'Live' : 'Removed'}
              </Badge>
              <Badge variant="outline" className="gap-1 text-2xs">
                {listing.visibility === 'PUBLIC' ? <Globe className="size-3" /> : <Lock className="size-3" />}
                {listing.visibility === 'PUBLIC' ? 'Everyone' : 'My workspace'}
              </Badge>
              <Badge variant="outline" className="font-mono text-2xs">
                v{listing.version}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {listing.installCount} install{listing.installCount === 1 ? '' : 's'}
              {listing.ratingCount > 0 ? ` · ${listing.rating.toFixed(1)} ★ (${listing.ratingCount})` : ''}
            </p>
            {listing.installStats && Object.keys(listing.installStats.byVersion).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Installed versions:{' '}
                {Object.entries(listing.installStats.byVersion)
                  .map(([v, n]) => `v${v} × ${n}`)
                  .join(', ')}
                {listing.installStats.behind > 0 ? ` — ${listing.installStats.behind} can update to v${listing.version}` : ''}
              </p>
            )}
            {behind && (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                Studio is on v{version}; the listing still serves v{listing.version}. Update the listing to ship the newer version.
              </p>
            )}
            {live && (
              <div>
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => void onUnpublish()} loading={unpublish.isPending}>
                  Remove from marketplace
                </Button>
              </div>
            )}
          </AgentTabSection>
        )}
      </div>
    </AgentTabPage>
  );
}
