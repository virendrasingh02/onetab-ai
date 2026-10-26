import type { AgentInstallScope, MarketplaceInstallation } from '@org/types';
import {
  Alert,
  AlertDescription,
  AppSelect,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@org/ui';
import { Check, ShieldAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from './AgentInstallDialog';
import { EntityIcon } from './marketplace-ui';
import {
  toAgentInstallError,
  useAgentApprovals,
  useAgentAudit,
  useAgentInstallMutations,
  useAgentInstallPreview,
  type AgentInstallError,
} from './use-agent-install';

const ACTION_LABELS: Record<string, string> = {
  'agent.install.requested': 'requested install of',
  'agent.install.approved': 'approved install of',
  'agent.install.rejected': 'rejected install of',
  'agent.install.completed': 'installed',
  'agent.install.failed': 'install failed for',
  'agent.update.completed': 'updated',
  'agent.update.failed': 'update failed for',
  'agent.enabled': 'enabled',
  'agent.disabled': 'disabled',
  'agent.access.changed': 'changed access to',
  'agent.uninstalled': 'uninstalled',
  'agent.purged': 'removed all data of',
};

/** Approval queue and audit history — shown to workspace admins only (the API enforces it too). */
export function AgentAdminPanel({ workspaceId }: { workspaceId: string }) {
  const approvals = useAgentApprovals(workspaceId, true);
  const audit = useAgentAudit(workspaceId, true);
  const [reviewing, setReviewing] = useState<MarketplaceInstallation | null>(null);
  const [rejecting, setRejecting] = useState<MarketplaceInstallation | null>(null);

  const pending = approvals.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="p-5 gap-4">
        <div className="gap-2.5 flex items-center">
          <div className="size-8 flex items-center justify-center rounded-lg bg-warning/10 text-warning-text">
            <ShieldAlert className="size-4" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Agent approval queue{pending.length > 0 ? ` (${pending.length})` : ''}</h3>
            <p className="text-xs text-muted-foreground">Members ask here when an agent needs sensitive access or their role can’t install on its own.</p>
          </div>
        </div>

        {approvals.isLoading && <Skeleton className="h-16 w-full" />}
        {approvals.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {toAgentInstallError(approvals.error).message}{' '}
              <button type="button" className="underline" onClick={() => approvals.refetch()}>Retry</button>
            </AlertDescription>
          </Alert>
        )}
        {!approvals.isLoading && !approvals.isError && pending.length === 0 && (
          <EmptyState title="Nothing waiting" description="New requests from members will show up here." />
        )}

        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card empty:hidden">
          {pending.map((req) => (
            <li key={req.id} className="gap-3 p-4 md:flex-row md:items-center flex flex-col justify-between">
              <div className="min-w-0 gap-3 flex items-start">
                <EntityIcon iconUrl={req.listing.iconUrl} kind="AGENT" />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">{req.listing.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    Requested by <span className="font-medium text-foreground">{req.requesterName ?? 'a member'}</span> · v{req.listing.version}
                  </p>
                  {req.requestReason && <p className="mt-1 text-xs italic text-muted-foreground">“{req.requestReason}”</p>}
                </div>
              </div>
              <div className="gap-2 flex shrink-0 self-end md:self-auto">
                <Button variant="outline" size="xs" onClick={() => setRejecting(req)} className="border-destructive/30 text-destructive-text">
                  <XCircle aria-hidden />
                  Reject
                </Button>
                <Button variant="primary" size="xs" onClick={() => setReviewing(req)}>
                  <Check aria-hidden />
                  Review & approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 gap-3">
        <h3 className="text-sm font-semibold text-foreground">Audit history</h3>
        {audit.isLoading && <Skeleton className="h-24 w-full" />}
        {audit.isError && <p className="text-xs text-destructive-text">{toAgentInstallError(audit.error).message}</p>}
        {audit.data && audit.data.length === 0 && <EmptyState title="No activity yet" description="Installs, approvals, updates and removals are recorded here." />}
        <ul className="divide-y divide-border/60">
          {audit.data?.map((e) => (
            <li key={e.id} className="gap-2 py-2 text-xs flex flex-wrap items-baseline justify-between">
              <span>
                <span className="font-medium text-foreground">{e.actor?.name ?? e.actor?.email ?? 'System'}</span>{' '}
                <span className="text-muted-foreground">{ACTION_LABELS[e.action] ?? e.action}</span>{' '}
                <span className="font-mono text-foreground">{e.target}</span>
                {e.action.endsWith('failed') && typeof e.metadata?.['message'] === 'string' && (
                  <span className="text-destructive-text"> — {e.metadata['message'] as string}</span>
                )}
              </span>
              <time className="text-muted-foreground" dateTime={e.createdAt}>
                {new Date(e.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </Card>

      {reviewing && <ApproveDialog workspaceId={workspaceId} request={reviewing} onClose={() => setReviewing(null)} />}
      {rejecting && <RejectDialog workspaceId={workspaceId} request={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function ApproveDialog({ workspaceId, request, onClose }: { workspaceId: string; request: MarketplaceInstallation; onClose: () => void }) {
  const slug = request.listing.slug;
  const preview = useAgentInstallPreview(workspaceId, slug);
  const { resolve } = useAgentInstallMutations(workspaceId);
  const [approved, setApproved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<AgentInstallScope>('PERSONAL');
  const [error, setError] = useState<AgentInstallError | null>(null);

  const sensitive = preview.data?.permissions.filter((p) => p.sensitive) ?? [];
  const fields = preview.data?.configFields ?? [];
  const ready = (sensitive.length === 0 || approved) && fields.every((f) => !f.required || (values[f.key] ?? '').trim());

  const approve = async () => {
    setError(null);
    try {
      await resolve.mutateAsync({
        slug,
        input: {
          action: 'APPROVE',
          scope,
          settings: Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
          approvedPermissions: approved ? sensitive.map((p) => p.id) : [],
        },
      });
      onClose();
    } catch (err) {
      setError(toAgentInstallError(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !resolve.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve {request.listing.name}</DialogTitle>
          <DialogDescription>Installs it for {request.requesterName ?? 'the requester'} once the permissions below are approved.</DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[60vh] space-y-4 overflow-y-auto">
          {preview.isLoading && <Skeleton className="h-24 w-full" />}
          {error && <ErrorAlert error={error} />}
          {preview.data && (
            <>
              <ul className="space-y-1.5">
                {preview.data.permissions.map((p) => (
                  <li key={p.id} className="gap-2 text-xs flex items-start">
                    <Badge variant={p.sensitive ? 'warning' : 'neutral'}>{p.sensitive ? 'Sensitive' : 'Standard'}</Badge>
                    <span>
                      <span className="block font-medium text-foreground">{p.label}</span>
                      <span className="text-muted-foreground">{p.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Field label="Who can use it">
                <AppSelect
                  value={scope}
                  onValueChange={(v) => setScope(v as AgentInstallScope)}
                  options={[
                    { value: 'PERSONAL', label: 'Only the requester' },
                    { value: 'WORKSPACE', label: 'Everyone in the workspace' },
                    { value: 'ADMIN_MANAGED', label: 'Administrators only' },
                  ]}
                />
              </Field>
              {fields.map((f) => (
                <Field key={f.key} label={f.label} required={f.required} optional={!f.required} hint={f.description} error={error?.fields?.[f.key]}>
                  <Input type={f.type === 'secret' ? 'password' : 'text'} autoComplete="off" value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                </Field>
              ))}
              {sensitive.length > 0 && (
                <label className="gap-2.5 text-xs flex cursor-pointer items-center">
                  <Checkbox checked={approved} onCheckedChange={(c) => setApproved(c === true)} aria-label="Approve sensitive permissions" />
                  I approve the {sensitive.length} sensitive permission{sensitive.length === 1 ? '' : 's'}
                </label>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={resolve.isPending}>Cancel</Button>
          <Button variant="primary" onClick={approve} disabled={!ready || !preview.data} loading={resolve.isPending}>
            Approve & install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ workspaceId, request, onClose }: { workspaceId: string; request: MarketplaceInstallation; onClose: () => void }) {
  const { resolve } = useAgentInstallMutations(workspaceId);
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject {request.listing.name}?</DialogTitle>
          <DialogDescription>The requester isn’t notified of your reason unless you add one.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Reason" optional>
            <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            loading={resolve.isPending}
            onClick={async () => {
              await resolve.mutateAsync({ slug: request.listing.slug, input: { action: 'REJECT', rejectionReason: reason.trim() || undefined } }).then(onClose, () => undefined);
            }}
          >
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
