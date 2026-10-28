import { agentDeploymentsApi } from '@org/api-client';
import type { AgentDeploymentView, AgentDeploymentWebhookView } from '@org/types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
  Label,
  LoadingState,
} from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, RefreshCw, Server, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from './parts.js';
import { errorMessage, type DeploymentApi } from './use-deployment.js';

const EVENTS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'agent.run.completed', label: 'Run completed', hint: 'An agent run finished successfully.' },
  { id: 'agent.run.failed', label: 'Run failed', hint: 'A run ended with an error.' },
  { id: 'agent.approval.requested', label: 'Approval requested', hint: 'A run is paused waiting for a person.' },
];

/** A strong random signing secret, generated in the browser. */
function generateSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `whsec_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function Deliveries({ api, deployment, webhook }: { api: DeploymentApi; deployment: AgentDeploymentView; webhook: AgentDeploymentWebhookView }) {
  const query = useQuery({
    queryKey: ['webhook-deliveries', webhook.id, webhook.deliveriesCount, webhook.lastDeliveryAt],
    queryFn: () => agentDeploymentsApi.getDeliveries(api.workspaceId, deployment.agentId, deployment.id, webhook.id),
  });

  if (query.isLoading) return <LoadingState label="Loading deliveries…" />;
  if (query.isError) return <ErrorState title="Couldn’t load deliveries" description={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const deliveries = query.data ?? [];
  if (deliveries.length === 0) return <p className="py-2 text-xs text-muted-foreground">Nothing has been sent yet. Use “Send test event”.</p>;

  return (
    <ul className="divide-y divide-border/50 text-xs">
      {deliveries.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <Badge variant={d.status === 'SUCCESS' ? 'success' : 'destructive'} className="text-2xs">
              {d.statusCode ?? (d.status === 'SUCCESS' ? 'OK' : 'ERR')}
            </Badge>
            <span className="truncate font-mono text-foreground">{d.event}</span>
          </span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {d.latencyMs} ms · {d.attempts} attempt{d.attempts === 1 ? '' : 's'} · {new Date(d.createdAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function WebhooksPanel({ api, deployment }: { api: DeploymentApi; deployment: AgentDeploymentView }) {
  const { webhooksQuery } = api;
  const webhooks = webhooksQuery.data ?? [];

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>(EVENTS.map((e) => e.id));
  const [expanded, setExpanded] = useState<string | null>(null);

  const reset = () => {
    setUrl('');
    setSecret('');
    setEvents(EVENTS.map((e) => e.id));
  };

  const urlOk = /^https?:\/\/.+/i.test(url.trim());
  const secretOk = secret.length >= 8;

  const submit = () =>
    api.createWebhook.mutate(
      { url: url.trim(), secret, events },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Outbound webhooks</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Signed JSON POSTs to your server when this deployment’s runs finish, fail or need a decision.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-xs font-semibold">
          <Plus className="size-3.5" /> Add webhook
        </Button>
      </div>

      {webhooksQuery.isLoading ? (
        <LoadingState label="Loading webhooks…" />
      ) : webhooksQuery.isError ? (
        <ErrorState title="Couldn’t load webhooks" description={errorMessage(webhooksQuery.error)} onRetry={() => void webhooksQuery.refetch()} />
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={<Server />}
          title="No webhooks yet"
          description="Add an HTTPS endpoint to be told when runs complete, fail or wait for approval."
          action={
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-xs">
              <Plus className="size-3.5" /> Add the first webhook
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const isOpen = expanded === wh.id;
            return (
              <Card key={wh.id} className="space-y-3 p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Server className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-bold text-foreground">{wh.url}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={wh.isActive ? 'success' : 'outline'} className="text-2xs">
                          {wh.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <span>{wh.deliveriesCount ?? 0} deliveries</span>
                        {wh.lastDeliveryStatus ? <span>last: {wh.lastDeliveryStatus.toLowerCase()}</span> : null}
                        <span>secret {wh.secretMasked}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => api.testWebhook.mutate(wh.id)}
                      loading={api.testWebhook.isPending && api.testWebhook.variables === wh.id}
                      className="gap-1.5 text-xs"
                    >
                      <Zap className="size-3 text-warning" /> Send test event
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete webhook ${wh.url}`}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete this webhook?',
                          description: 'Your server stops being notified immediately. Delivery history is removed with it.',
                          destructive: true,
                        });
                        if (ok) api.deleteWebhook.mutate(wh.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
                  <span className="mr-1 text-2xs font-semibold uppercase text-muted-foreground">Events</span>
                  {wh.events.map((ev) => (
                    <Badge key={ev} variant="secondary" className="font-mono text-2xs">
                      {ev}
                    </Badge>
                  ))}
                </div>

                <div>
                  <Button type="button" variant="link" size="xs" className="h-auto gap-1" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : wh.id)}>
                    {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                    Delivery history
                  </Button>
                  {isOpen ? <Deliveries api={api} deployment={deployment} webhook={wh} /> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (urlOk && secretOk && events.length > 0) submit();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Server className="size-5 text-primary" /> Add a webhook
              </DialogTitle>
              <DialogDescription className="text-xs">Deliveries are signed with the secret below. Keep a copy: it can’t be shown again.</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 text-xs">
              <Field label="Endpoint URL" required error={url && !urlOk ? 'Enter a full http(s) URL.' : undefined}>
                <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/webhooks/agent" className="font-mono text-xs" />
              </Field>

              <Field label="Signing secret" required hint="At least 8 characters." error={secret && !secretOk ? 'Too short.' : undefined}>
                <Input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="font-mono text-xs"
                  trailingSlot={
                    <span className="flex items-center gap-0.5">
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Generate a secret" title="Generate a secret" onClick={() => setSecret(generateSecret())}>
                        <RefreshCw className="size-3.5" />
                      </Button>
                      {secret ? <CopyButton text={secret} label="" className="h-6 px-1.5" /> : null}
                    </span>
                  }
                />
              </Field>

              <div className="space-y-2">
                <Label>Events</Label>
                {EVENTS.map((ev) => (
                  <Label key={ev.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 p-2 font-normal">
                    <Checkbox
                      checked={events.includes(ev.id)}
                      onCheckedChange={(c) => setEvents((cur) => (c === true ? [...cur, ev.id] : cur.filter((x) => x !== ev.id)))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold text-foreground">{ev.label}</span>
                      <span className="block text-xs text-muted-foreground">{ev.hint}</span>
                    </span>
                  </Label>
                ))}
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={api.createWebhook.isPending} disabled={!urlOk || !secretOk || events.length === 0} className="font-semibold">
                Add webhook
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
