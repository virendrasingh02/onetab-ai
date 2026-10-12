import type { AgentDeploymentEnvironment, AgentDeploymentView, AgentVersion } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
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
import { Camera, History, RotateCcw, Rocket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage, publishableVersions, type DeploymentApi } from './use-deployment.js';

const ENVIRONMENTS: Array<{ value: AgentDeploymentEnvironment; label: string }> = [
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'STAGING', label: 'Staging' },
  { value: 'DEVELOPMENT', label: 'Development' },
];

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
              <Rocket className="size-5 text-primary" /> Publish to this deployment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every embed, API call and webhook switches to the version you pick as soon as you publish.
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
              Publish now
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
        <ul className="space-y-3">
          {versions.map((v) => {
            const live = v.version === deployment.versionNumber;
            const newer = v.version > deployment.versionNumber;
            return (
              <li key={v.version}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-2xs">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{versionLabel(v)}</span>
                      {live ? <Badge variant="success" className="text-[10px]">Live · {deployment.environment.toLowerCase()}</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {v.changeSummary || 'No summary'}
                      {v.publishedAt ? ` · ${new Date(v.publishedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  {!live ? (
                    newer ? (
                      <Button size="sm" onClick={() => onPublish(v.version)} className="gap-1.5 text-xs">
                        <Rocket className="size-3.5" /> Publish
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void rollback(v)} loading={api.rollback.isPending && api.rollback.variables?.versionNumber === v.version} className="gap-1.5 text-xs">
                        <RotateCcw className="size-3.5" /> Roll back to this
                      </Button>
                    )
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
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
