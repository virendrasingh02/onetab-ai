import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@org/ui';
import { ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import {
  AUTH_LABELS,
  connectApp,
  credentialFieldsFor,
  customApiConfig,
  type ConnectorSummary,
} from '../../services/connectors.js';
import { useStudioSession } from '../../session-guard.js';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';

/**
 * Connects one app: OAuth apps go to the provider's consent screen in a
 * popup; API-key apps take their credentials here, which the server checks
 * against the app before storing them encrypted.
 */
export function ConnectDialog({
  connector,
  open,
  onOpenChange,
  onConnected,
}: {
  connector: ConnectorSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}) {
  const { activeWorkspace } = useStudioSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForPopup, setWaitingForPopup] = useState(false);

  if (!connector) return null;
  const fields = credentialFieldsFor(connector);
  const isOAuth = connector.authType === 'OAUTH2';

  const close = (next: boolean) => {
    if (!next) {
      setValues({});
      setError(null);
      setWaitingForPopup(false);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!activeWorkspace) return;
    setBusy(true);
    setError(null);
    const credentials = fields
      ? connector.supports.customEndpoints
        ? customApiConfig(values)
        : Object.fromEntries(fields.map((f) => [f.key, values[f.key]?.trim() ?? '']))
      : undefined;
    const outcome = await connectApp(activeWorkspace.id, connector, credentials);
    setBusy(false);
    if (outcome.kind === 'error') {
      setError(outcome.message);
    } else if (outcome.kind === 'oauth') {
      if (!outcome.popup) {
        setError('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.');
        return;
      }
      setWaitingForPopup(true);
    } else {
      onConnected();
      close(false);
    }
  };

  const missing = fields?.some((f) => (f.key === 'apiKeyHeader' ? false : !values[f.key]?.trim())) ?? false;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-raised">
              <AppConnectorIcon connectorId={connector.slug} name={connector.name} category={connector.category} size={24} />
            </span>
            <div>
              <DialogTitle>Connect {connector.name}</DialogTitle>
              <DialogDescription>{AUTH_LABELS[connector.authType] ?? connector.authType}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {waitingForPopup ? (
            <div className="rounded-lg border border-border bg-surface-raised p-3 text-xs text-muted-foreground" role="status" aria-live="polite">
              Finish signing in to {connector.name} in the window that opened. This page updates by itself when you’re done.
            </div>
          ) : isOAuth ? (
            <p className="text-sm text-muted-foreground">
              You’ll sign in to {connector.name} and approve access. Agents then act in {connector.name} with your permissions —
              never more than you allowed.
            </p>
          ) : fields ? (
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label htmlFor={`cred-${f.key}`} className="text-xs font-medium text-foreground">
                    {f.label}
                  </label>
                  <Input
                    id={`cred-${f.key}`}
                    type={f.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={values[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                  {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                </div>
              ))}
            </div>
          ) : null}

          {connector.scopes.length > 0 && !waitingForPopup && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground">It will be able to</div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {connector.scopes.slice(0, 6).map((s) => (
                  <li key={s.scope} className="flex gap-1.5">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                    <span>{s.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <KeyRound className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            Credentials are encrypted at rest and never sent back to the browser.
          </p>

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-text">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => close(false)}>
            {waitingForPopup ? 'Close' : 'Cancel'}
          </Button>
          {!waitingForPopup && (
            <Button size="sm" onClick={submit} loading={busy} disabled={missing}>
              {isOAuth ? (
                <>
                  Continue to {connector.name}
                  <ExternalLink className="ml-1 size-3.5" aria-hidden="true" />
                </>
              ) : (
                'Check and connect'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
