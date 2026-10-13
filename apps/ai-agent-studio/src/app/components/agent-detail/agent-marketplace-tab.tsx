import { agentsApi, queryKeys } from '@org/api-client';
import type { AIAgentDetail, MarketplaceListing, MarketplaceVisibility } from '@org/types';
import { Badge, Button, Card, confirm, ErrorState, Field, Input, LoadingState, SegmentedControl, Textarea, toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe, Lock, Rocket, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WEB_APP_URL } from '../../auth-redirect.js';
import { useStudioSession } from '../../session-guard.js';
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
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Marketplace</h2>
            <p className="text-xs text-muted-foreground">
              Publish {agent.name} to the marketplace. Members add it to their sidebar from there; each install is an independent copy of the version you publish.
            </p>
          </div>
        </div>

        {listing && (
          <Card className="space-y-3 p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{listing.name}</span>
              <Badge variant={live ? 'success' : 'outline'} className="text-[10px] font-semibold uppercase tracking-wider">
                {live ? 'Live' : 'Removed'}
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {listing.visibility === 'PUBLIC' ? <Globe className="size-3" /> : <Lock className="size-3" />}
                {listing.visibility === 'PUBLIC' ? 'Everyone' : 'My workspace'}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                v{listing.version}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {listing.installCount} install{listing.installCount === 1 ? '' : 's'}
              {listing.ratingCount > 0 ? ` · ${listing.rating.toFixed(1)} ★ (${listing.ratingCount})` : ''}
            </p>
            {behind && (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                Studio is on v{version}; the listing still serves v{listing.version}. Update the listing to ship the newer version.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <a href={marketplaceHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" /> View in marketplace
                </a>
              </Button>
              {live && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => void onUnpublish()} loading={unpublish.isPending}>
                  Remove from marketplace
                </Button>
              )}
            </div>
          </Card>
        )}

        {version === null ? (
          <Card className="p-4 text-sm text-muted-foreground shadow-2xs">
            Publish this agent first (the Draft chip in the header). Only a published version can be shared — the draft on your canvas never is.
          </Card>
        ) : (
          <Card className="space-y-4 p-4 shadow-2xs">
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-foreground">Who can install it</span>
              <SegmentedControl
                aria-label="Who can install it"
                options={VISIBILITY_OPTIONS}
                value={visibility}
                onChange={(next) => setVisibility(next as MarketplaceVisibility)}
                size="sm"
              />
              <p className="text-[11px] text-muted-foreground">{VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}</p>
            </div>
            <Field label="Tagline" hint="One line shown on the listing card.">
              <Input value={tagline} maxLength={160} onChange={(e) => setTagline(e.target.value)} placeholder="What does it do for the team?" />
            </Field>
            <Field label="Category">
              <Input value={category} maxLength={60} onChange={(e) => setCategory(e.target.value)} placeholder="Productivity, Support, Engineering…" />
            </Field>
            <Field label="What's new" optional>
              <Textarea value={changeNotes} maxLength={500} rows={2} onChange={(e) => setChangeNotes(e.target.value)} placeholder="Shown in the listing's changelog" />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">Publishes v{version}. Tools that need credentials must be reconnected by whoever installs it.</p>
              <Button size="sm" className="gap-1.5 text-xs font-semibold" onClick={() => publish.mutate()} loading={publish.isPending}>
                <Rocket className="size-3.5" /> {live ? 'Update listing' : 'Publish to marketplace'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
