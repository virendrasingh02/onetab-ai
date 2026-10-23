import type { AgentDeploymentEnvironment, AgentDeploymentView, AgentVersion } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
} from '@org/ui';
import { Camera, History, Radio, RotateCcw, Rocket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage, publishableVersions, type DeploymentApi } from './use-deployment.js';

const ENVIRONMENTS: Array<{ value: AgentDeploymentEnvironment; label: string }> = [
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'STAGING', label: 'Staging' },
  { value: 'DEVELOPMENT', label: 'Development' },
];

const VISIBLE = 6;

/** "5 min ago" for recent versions, a date once it's older than a week. */
export function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} h ago`;
  if (min < 10_080) return `${Math.round(min / 1440)} d ago`;
  return new Date(iso).toLocaleDateString();
}

const versionLabel = (v: AgentVersion) => v.versionTag || `v${v.version}.0.0`;

/** Puts a published version of the agent live on this deployment. */
export function PublishDialog({
  api,
  deployment,
  open,
  initialVersion,
  onOpenChange,
}: {
  api: DeploymentApi;
  deployment: AgentDeploymentView;
  open: boolean;
  initialVersion?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = useMemo(() => publishableVersions(api.versionsQuery.data), [api.versionsQuery.data]);
  const [version, setVersion] = useState<string>('');
  const [environment, setEnvironment] = useState<AgentDeploymentEnvironment>(deployment.environment);

  useEffect(() => {
    if (!open) return;
    setVersion(String(initialVersion ?? versions[0]?.version ?? ''));
    setEnvironment(deployment.environment);
  }, [open, initialVersion, versions, deployment.environment]);

  const empty = versions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!version) return;
            api.publish.mutate({ versionNumber: Number(version), environment }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="size-5 text-primary" /> Change live version
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pick which published version this deployment serves. Every embed, API call and webhook switches to it straight away. To create a new version from your latest edits, use Publish in the agent’s header.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 text-xs">
            {empty ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning">
                This agent has no published version yet. Use <strong>Publish</strong> in the agent’s header to create v1, then come back here.
              </p>
            ) : (
              <>
                <Field label="Version">
                  <AppSelect
                    value={version}
                    onValueChange={setVersion}
                    options={versions.map((v) => ({
                      value: String(v.version),
                      label: `${versionLabel(v)}${v.version === deployment.versionNumber ? ' (live now)' : ''}`,
                      description: v.changeSummary,
                    }))}
                  />
                </Field>
                <Field label="Environment">
                  <AppSelect value={environment} onValueChange={(v) => setEnvironment(v as AgentDeploymentEnvironment)} options={ENVIRONMENTS} />
                </Field>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={api.publish.isPending} disabled={empty || !version} className="gap-1.5 font-semibold">
              Go live
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VersionsPanel({
  api,
  deployment,
  onPublish,
}: {
  api: DeploymentApi;
  deployment: AgentDeploymentView;
  onPublish: (version: number) => void;
}) {
  const { versionsQuery } = api;
  const versions = publishableVersions(versionsQuery.data);
  const [showAll, setShowAll] = useState(false);
  const liveVersion = versions.find((v) => v.version === deployment.versionNumber);
  const others = versions.filter((v) => v !== liveVersion);
  const shown = showAll ? others : others.slice(0, VISIBLE);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [summary, setSummary] = useState('');

  const rollback = async (v: AgentVersion) => {
    const ok = await confirm({
      title: `Roll back to ${versionLabel(v)}?`,
      description: 'All live widgets, embeds and API calls answer with that version’s instructions and tools straight away.',
      confirmLabel: 'Roll back',
      destructive: true,
    });
    if (ok) api.rollback.mutate({ versionNumber: v.version, summary: 'Rolled back from the Deploy tab' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Versions</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Published versions of this agent, and which one is live on this deployment.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setSnapshotOpen(true)} className="gap-1.5 text-xs">
          <Camera className="size-3.5" /> Save a snapshot
        </Button>
      </div>

      {versionsQuery.isLoading ? (
        <LoadingState label="Loading versions…" />
      ) : versionsQuery.isError ? (
        <ErrorState title="Couldn’t load versions" description={errorMessage(versionsQuery.error)} onRetry={() => void versionsQuery.refetch()} />
      ) : versions.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No published versions"
          description="Use Publish in the agent’s header to create the first version. It then shows up here."
        />
      ) : (
        <div className="space-y-5">
          {liveVersion ? (
            <section aria-label="Live version" className="rounded-2xl border border-success/40 bg-success/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Radio className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">{versionLabel(liveVersion)}</span>
                      <Badge variant="success" className="text-2xs">Live · {deployment.environment.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{liveVersion.changeSummary || 'No summary'}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground/80">
                      {deployment.publishedAt ? `Went live ${formatWhen(deployment.publishedAt)}` : 'Serving every embed, API call and webhook'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section aria-label="Version history" className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              History <span className="font-normal normal-case">· {others.length}</span>
            </h4>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80">
              {shown.map((v) => {
                const newer = v.version > deployment.versionNumber;
                const busy = api.rollback.isPending && api.rollback.variables?.versionNumber === v.version;
                return (
                  <li key={v.version} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{versionLabel(v)}</span>
                        {newer ? <Badge variant="outline" className="px-1.5 py-0 text-2xs">Newer than live</Badge> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground" title={v.changeSummary || undefined}>
                        {v.changeSummary || 'No summary'}
                      </p>
                    </div>
                    <time className="shrink-0 text-2xs text-muted-foreground" dateTime={v.publishedAt ?? undefined} title={v.publishedAt ? new Date(v.publishedAt).toLocaleString() : undefined}>
                      {formatWhen(v.publishedAt)}
                    </time>
                    {newer ? (
                      <Button size="sm" onClick={() => onPublish(v.version)} className="w-28 gap-1.5 text-xs">
                        <Rocket className="size-3.5" /> Go live
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void rollback(v)} loading={busy} className="w-28 gap-1.5 text-xs">
                        <RotateCcw className="size-3.5" /> Roll back
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {others.length > VISIBLE ? (
              <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAll((x) => !x)}>
                {showAll ? 'Show fewer' : `Show ${others.length - VISIBLE} older versions`}
              </Button>
            ) : null}
          </section>
        </div>
      )}

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              api.createSnapshot.mutate(summary.trim() || undefined, {
                onSuccess: () => {
                  setSnapshotOpen(false);
                  setSummary('');
                },
              });
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="size-5 text-primary" /> Save a snapshot
              </DialogTitle>
              <DialogDescription className="text-xs">Keeps the agent as it is now so you can come back to it. It doesn’t change what is live.</DialogDescription>
            </DialogHeader>
            <DialogBody className="text-xs">
              <Field label="What changed?" hint="Optional.">
                <Input autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Added the refund approval step" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSnapshotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={api.createSnapshot.isPending} className="font-semibold">
                Save snapshot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
