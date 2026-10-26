import type {
  AgentConfigField,
  AgentInstallResult,
  AgentInstallScope,
  AgentPermissionRequest,
  MarketplaceListing,
} from '@org/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AppSelect,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Skeleton,
  Spinner,
  Switch,
  Textarea,
} from '@org/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EntityIcon, VerifiedBadge } from './marketplace-ui';
import {
  toAgentInstallError,
  useAgentInstallMutations,
  useAgentInstallPreview,
  type AgentInstallError,
} from './use-agent-install';

type Step = 'review' | 'configure' | 'installing' | 'done' | 'requested' | 'failed';

interface AgentInstallDialogProps {
  open: boolean;
  onClose: () => void;
  listing: MarketplaceListing;
  workspace: { id: string; name: string; slug: string };
  /** Opens the freshly installed agent in chat. */
  onOpenChat?: (agentId: string) => void;
}

const SCOPE_OPTIONS: Array<{ value: AgentInstallScope; label: string }> = [
  { value: 'WORKSPACE', label: 'Everyone in the workspace' },
  { value: 'ADMIN_MANAGED', label: 'Administrators only' },
  { value: 'PERSONAL', label: 'Only me' },
];

/**
 * Review → configure → install. Nothing here is optimistic: the dialog reads
 * "installed" only from the server's answer, which is itself only returned
 * after the agent was created and passed its health checks.
 */
export function AgentInstallDialog({ open, onClose, listing, workspace, onOpenChat }: AgentInstallDialogProps) {
  const preview = useAgentInstallPreview(workspace.id, listing.slug, open);
  const { install, requestApproval } = useAgentInstallMutations(workspace.id);

  const [step, setStep] = useState<Step>('review');
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [scope, setScope] = useState<AgentInstallScope>('WORKSPACE');
  const [approved, setApproved] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<AgentInstallError | null>(null);
  const [result, setResult] = useState<AgentInstallResult | null>(null);

  const data = preview.data;
  const sensitive = useMemo(() => data?.permissions.filter((p) => p.sensitive) ?? [], [data]);
  const fieldErrors = error?.code === 'INVALID_CONFIG' ? (error.fields ?? {}) : {};

  useEffect(() => {
    if (!open) return;
    setStep('review');
    setValues({});
    setApproved(false);
    setReason('');
    setError(null);
    setResult(null);
  }, [open, listing.slug]);

  useEffect(() => {
    if (data?.forcedScope) setScope(data.forcedScope);
  }, [data?.forcedScope]);

  const missingRequired = (data?.configFields ?? []).filter(
    (f) => f.required && f.type !== 'boolean' && !String(values[f.key] ?? '').trim(),
  );
  const canSubmit = !!data?.canInstall && missingRequired.length === 0 && (sensitive.length === 0 || approved);

  const submit = async () => {
    if (!data) return;
    setError(null);
    setStep('installing');
    try {
      const response = await install.mutateAsync({
        slug: listing.slug,
        input: {
          scope: data.forcedScope ?? scope,
          settings: cleanValues(values),
          approvedPermissions: approved ? sensitive.map((p) => p.id) : [],
        },
      });
      setResult(response);
      setStep('done');
    } catch (err) {
      const e = toAgentInstallError(err);
      setError(e);
      // Fixable input goes back to the form; everything else is a failed install.
      setStep(e.code === 'INVALID_CONFIG' || e.code === 'PERMISSION_APPROVAL_REQUIRED' ? 'configure' : 'failed');
    }
  };

  const submitRequest = async () => {
    setError(null);
    try {
      await requestApproval.mutateAsync({ slug: listing.slug, input: { reason: reason.trim() || undefined } });
      setStep('requested');
    } catch (err) {
      setError(toAgentInstallError(err));
    }
  };

  const needsRequest = !!data && !data.canInstall && data.requiresAdminApproval && !data.ownAgent;
  const busy = step === 'installing';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-w-xl" aria-busy={busy}>
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="gap-3 flex items-center">
            <EntityIcon iconUrl={listing.iconUrl} kind={listing.kind} />
            <div className="min-w-0">
              <DialogTitle className="truncate">Install {listing.name}</DialogTitle>
              <DialogDescription>
                v{listing.version} · {listing.publisher?.name ?? 'Community'} · into {workspace.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
          {preview.isLoading && <PreviewSkeleton />}

          {preview.isError && (
            <Alert variant="destructive">
              <XCircle aria-hidden />
              <AlertTitle>Could not load this agent</AlertTitle>
              <AlertDescription>
                {toAgentInstallError(preview.error).message}{' '}
                <button type="button" className="underline" onClick={() => preview.refetch()}>
                  Try again
                </button>
              </AlertDescription>
            </Alert>
          )}

          {data && step === 'review' && (
            <ReviewStep listing={listing} data={data} sensitive={sensitive} />
          )}

          {data && step === 'configure' && (
            <div className="space-y-4">
              {error && <ErrorAlert error={error} />}

              {!needsRequest && !data.forcedScope && (
                <Field label="Who can use it" hint="You can change this later in Installed.">
                  <AppSelect value={scope} onValueChange={(v) => setScope(v as AgentInstallScope)} options={SCOPE_OPTIONS} />
                </Field>
              )}
              {data.forcedScope && (
                <Alert>
                  <Lock aria-hidden />
                  <AlertDescription>This install is private to you. Admins can widen access later.</AlertDescription>
                </Alert>
              )}

              {!needsRequest &&
                data.configFields.map((field) => (
                  <ConfigInput
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    error={fieldErrors[field.key]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                  />
                ))}

              {!needsRequest && sensitive.length > 0 && (
                <label className="gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5 flex cursor-pointer items-start">
                  <Checkbox checked={approved} onCheckedChange={(c) => setApproved(c === true)} aria-label="Approve sensitive permissions" className="mt-0.5" />
                  <span className="text-xs text-foreground">
                    <span className="block font-semibold">
                      I approve {sensitive.length} sensitive permission{sensitive.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-muted-foreground">{sensitive.map((p) => p.label).join(' · ')}</span>
                  </span>
                </label>
              )}

              {needsRequest && (
                <Field label="Note for your admins" optional>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="What will you use it for?" />
                </Field>
              )}
            </div>
          )}

          {step === 'installing' && (
            <div className="gap-3 py-10 flex flex-col items-center text-center" role="status" aria-live="polite">
              <Spinner className="size-6" />
              <p className="text-sm font-medium text-foreground">Installing {listing.name}…</p>
              <p className="text-xs text-muted-foreground">Creating the agent and running health checks. This can take a few seconds.</p>
            </div>
          )}

          {step === 'done' && result && <DoneStep result={result} />}

          {step === 'requested' && (
            <div className="gap-2 py-8 flex flex-col items-center text-center" role="status">
              <CheckCircle2 className="size-8 text-success-text" aria-hidden />
              <p className="text-sm font-semibold text-foreground">Request sent</p>
              <p className="text-xs text-muted-foreground">A workspace admin will review the permissions. You’ll find it under Installed once approved.</p>
            </div>
          )}

          {step === 'failed' && error && (
            <div className="space-y-3">
              <ErrorAlert error={error} />
              <p className="text-xs text-muted-foreground">
                Nothing was left half-installed — anything created during this attempt was removed.
              </p>
            </div>
          )}

          {error && step === 'review' && <ErrorAlert error={error} />}
        </DialogBody>

        <DialogFooter>
          {step === 'review' && (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!data || !data.installable || (!data.canInstall && !data.requiresAdminApproval)}
                onClick={() => setStep('configure')}
              >
                {needsRequest ? 'Continue to request' : 'Continue'}
              </Button>
            </>
          )}
          {step === 'configure' && (
            <>
              <Button variant="ghost" onClick={() => setStep('review')}>Back</Button>
              {needsRequest ? (
                <Button variant="primary" onClick={submitRequest} loading={requestApproval.isPending}>
                  Request admin approval
                </Button>
              ) : (
                <Button variant="primary" onClick={submit} disabled={!canSubmit}>
                  Install agent
                </Button>
              )}
            </>
          )}
          {step === 'failed' && (
            <>
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button variant="primary" onClick={() => setStep('configure')} disabled={error?.retryable === false}>Try again</Button>
            </>
          )}
          {(step === 'done' || step === 'requested') && (
            <>
              <Button variant="ghost" onClick={onClose}>Done</Button>
              {step === 'done' && result?.installation.agentId && onOpenChat && (
                <Button variant="primary" onClick={() => onOpenChat(result.installation.agentId as string)}>
                  <MessageSquare aria-hidden />
                  Open in chat
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cleanValues(values: Record<string, string | boolean>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== undefined));
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading agent details" role="status">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function ReviewStep({
  listing,
  data,
  sensitive,
}: {
  listing: MarketplaceListing;
  data: NonNullable<ReturnType<typeof useAgentInstallPreview>['data']>;
  sensitive: AgentPermissionRequest[];
}) {
  return (
    <div className="space-y-4">
      {data.ownAgent && (
        <Alert>
          <ShieldCheck aria-hidden />
          <AlertTitle>Built in this workspace</AlertTitle>
          <AlertDescription>This agent already lives here — there is nothing to install.</AlertDescription>
        </Alert>
      )}
      {data.issues.length > 0 && (
        <Alert variant="destructive">
          <XCircle aria-hidden />
          <AlertTitle>This agent can’t be installed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {data.issues.map((i) => (
                <li key={i.message}>{i.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {data.reason && !data.canInstall && (
        <Alert>
          <Lock aria-hidden />
          <AlertDescription>{data.reason}</AlertDescription>
        </Alert>
      )}

      <div className="gap-2 text-xs flex flex-wrap items-center text-muted-foreground">
        {listing.publisher?.isVerified && <VerifiedBadge />}
        <Badge variant="neutral">{data.listing.visibility === 'WORKSPACE' ? 'Private to workspace' : 'Public'}</Badge>
        {data.compatibility && (
          <Badge variant="neutral">
            Needs platform ≥ {data.compatibility.minPlatformVersion}
            {data.compatibility.platforms.length ? ` · ${data.compatibility.platforms.join(', ')}` : ''}
          </Badge>
        )}
      </div>

      {listing.tagline && <p className="text-sm text-muted-foreground">{listing.tagline}</p>}

      <section aria-labelledby="perm-heading">
        <h4 id="perm-heading" className="mb-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          This agent will be able to
        </h4>
        <ul className="space-y-2">
          {data.permissions.map((p) => (
            <li
              key={p.id}
              className="gap-2.5 rounded-lg border border-border/60 bg-surface-raised/30 p-2.5 text-xs flex items-start"
            >
              {p.sensitive ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
              ) : p.kind === 'network' ? (
                <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{p.label}</span>
                <span className="text-muted-foreground">{p.description}</span>
              </span>
              {p.sensitive && <Badge variant="warning">Needs approval</Badge>}
            </li>
          ))}
        </ul>
        {sensitive.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Sensitive permissions are only granted after you approve them on the next step.
          </p>
        )}
      </section>

      {data.dependencies && (data.dependencies.connectors.length > 0 || data.dependencies.externalServices.length > 0) && (
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">Requires</h4>
          <div className="gap-1.5 flex flex-wrap">
            {data.dependencies.connectors.map((c) => (
              <Badge key={c} variant="info">{c} connection</Badge>
            ))}
            {data.dependencies.externalServices.map((u) => (
              <Badge key={u} variant="neutral" className="font-mono">{new URL(u).hostname}</Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConfigInput({
  field,
  value,
  error,
  onChange,
}: {
  field: AgentConfigField;
  value: string | boolean | undefined;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <div className="gap-3 rounded-xl border border-border/60 bg-surface-raised/40 p-3.5 flex items-center justify-between">
        <span className="text-xs">
          <span className="block font-semibold text-foreground">{field.label}</span>
          {field.description && <span className="text-muted-foreground">{field.description}</span>}
        </span>
        <Switch checked={value === true} onCheckedChange={onChange} aria-label={field.label} />
      </div>
    );
  }
  return (
    <Field label={field.label} required={field.required} optional={!field.required} hint={field.description} error={error}>
      {field.type === 'select' ? (
        <AppSelect
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          placeholder="Select…"
        />
      ) : (
        <Input
          type={field.type === 'secret' ? 'password' : field.type === 'url' ? 'url' : 'text'}
          autoComplete="off"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          prefix={field.type === 'secret' ? <KeyRound className="size-4" aria-hidden /> : undefined}
        />
      )}
    </Field>
  );
}

function DoneStep({ result }: { result: AgentInstallResult }) {
  const health = result.installation.health?.checks ? result.installation.health : null;
  return (
    <div className="space-y-3" role="status">
      <div className="gap-2 py-4 flex flex-col items-center text-center">
        <CheckCircle2 className="size-8 text-success-text" aria-hidden />
        <p className="text-sm font-semibold text-foreground">
          {result.alreadyInstalled ? 'Already installed' : 'Installed and ready'}
        </p>
        <p className="text-xs text-muted-foreground">Confirmed by the server after its health checks passed.</p>
      </div>
      {health && (
        <ul className="space-y-1.5">
          {health.checks.map((c) => (
            <li key={c.name} className="gap-2 text-xs flex items-center">
              {c.ok ? <CheckCircle2 className="size-4 text-success-text" aria-hidden /> : <AlertTriangle className="size-4 text-warning-text" aria-hidden />}
              <span className="text-foreground">{c.name}</span>
              {c.detail && <span className="text-muted-foreground">· {c.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ERROR_TITLES: Record<string, string> = {
  PERMISSION_APPROVAL_REQUIRED: 'Approve the sensitive permissions',
  INVALID_CONFIG: 'Check these settings',
  INVALID_PACKAGE: 'This agent’s package is invalid',
  INCOMPATIBLE: 'Not compatible with this platform version',
  MISSING_DEPENDENCY: 'A required connection is missing',
  HEALTH_CHECK_FAILED: 'The agent failed its health check',
  INSTALL_IN_PROGRESS: 'Another install is already running',
  INSTALL_NOT_PERMITTED: 'You can’t install agents here',
  APPROVAL_REQUIRED: 'An admin has to approve this agent',
  LISTING_UNAVAILABLE: 'This agent is no longer available',
};

export function ErrorAlert({ error }: { error: AgentInstallError }) {
  return (
    <Alert variant="destructive" role="alert">
      <XCircle aria-hidden />
      <AlertTitle>{ERROR_TITLES[error.code] ?? 'Installation failed'}</AlertTitle>
      <AlertDescription>
        {error.message}
        {error.permissions && (
          <ul className="mt-1 list-disc pl-4">
            {error.permissions.map((p) => (
              <li key={p.id}>{p.label}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
