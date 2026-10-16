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
  Label,
} from '@org/ui';
import type { IntegrationCapabilities } from '@org/types';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface ConnectCredentialsApp {
  name: string;
  icon: ReactNode;
  capabilities: IntegrationCapabilities;
}

/**
 * Connects an API-key app (Jira, HubSpot, Stripe, Shopify…) from the fields
 * its provider adapter declares (`credentialFields`). The server checks the
 * credentials against the app before storing them encrypted, so a bad key
 * comes back here as an error instead of a broken connection.
 */
export function ConnectCredentialsDialog({
  app,
  onOpenChange,
  onSubmit,
}: {
  /** The app being connected; `null` closes the dialog. */
  app: ConnectCredentialsApp | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = app?.capabilities.credentialFields ?? [];
  const scopes = app?.capabilities.scopes ?? [];
  const missing = fields.some((f) => !f.optional && !values[f.key]?.trim());

  const close = () => {
    setValues({});
    setError(null);
    onOpenChange(false);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        Object.fromEntries(
          fields
            .map((f) => [f.key, values[f.key]?.trim() ?? ''] as const)
            .filter(([, value]) => value !== ''),
        ),
      );
      close();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Couldn't connect ${app?.name ?? 'this app'}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={app !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="gap-3 flex items-center">
            <span className="size-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised">
              {app?.icon}
            </span>
            <div>
              <DialogTitle>Connect {app?.name}</DialogTitle>
              <DialogDescription>
                {app?.capabilities.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!missing && !busy) void submit();
          }}
        >
          <DialogBody className="space-y-4">
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label
                    htmlFor={`cred-${f.key}`}
                    className="text-xs font-medium text-foreground"
                  >
                    {f.label}
                    {f.optional ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id={`cred-${f.key}`}
                    type={f.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={values[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                  {f.help ? (
                    <p className="text-[11px] text-muted-foreground">{f.help}</p>
                  ) : null}
                </div>
              ))}
            </div>

            {scopes.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-foreground">
                  It will be able to
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {scopes.slice(0, 6).map((s) => (
                    <li key={s.scope} className="gap-1.5 flex">
                      <ShieldCheck
                        className="mt-0.5 size-3.5 shrink-0 text-success"
                        aria-hidden
                      />
                      <span>{s.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="gap-1.5 text-[11px] flex items-start text-muted-foreground">
              <KeyRound className="mt-0.5 size-3 shrink-0" aria-hidden />
              Credentials are encrypted at rest and never sent back to the
              browser.
            </p>

            {error ? (
              <div
                role="alert"
                className="p-3 text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive-text"
              >
                {error}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={busy} disabled={missing}>
              Check and connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
