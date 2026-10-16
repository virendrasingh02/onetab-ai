import {
  CONNECTOR_CATEGORIES,
  actionPermission,
  customActionDefinition,
  validateCustomConnector,
  type CustomConnectorAuthType,
  type CustomConnectorMethod,
  type CustomConnectorParamType,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  CodeBlock,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  SegmentedControl,
  Switch,
  Textarea,
  confirm,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { ArrowLeft, ChevronDown, ChevronRight, Play, Plug, Plus, Save, Trash2, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  blankAction,
  draftFromDefinition,
  blankDraft,
  inputFromDraft,
  actionFromDraft,
  missingInputs,
  newKey,
  newParam,
  type ActionDraft,
  type Draft,
  type Row,
  type TriggerDraft,
} from '../components/connectors/custom-connector-draft.js';
import { SchemaFields, coerceSchemaInput, missingRequired } from '../components/connectors/schema-fields.js';
import {
  createCustomConnector,
  deleteCustomConnector,
  errorMessage,
  testCustomAction,
  updateCustomConnector,
  useConnectorDetail,
  useInvalidateConnectors,
} from '../services/connectors.js';
import { useStudioSession } from '../session-guard.js';

const AUTH_OPTIONS: Array<{ value: CustomConnectorAuthType; label: string }> = [
  { value: 'BEARER', label: 'Bearer token' },
  { value: 'API_KEY_HEADER', label: 'API key in a header' },
  { value: 'API_KEY_QUERY', label: 'API key in the URL' },
  { value: 'BASIC', label: 'Username & password' },
  { value: 'NONE', label: 'No sign-in' },
];
const METHODS: CustomConnectorMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const TYPE_OPTIONS: Array<{ value: CustomConnectorParamType; label: string }> = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'json', label: 'JSON' },
];
const CATEGORY_OPTIONS = CONNECTOR_CATEGORIES.map((c) => ({ value: c.id, label: c.label }));
const METHOD_STYLE: Record<CustomConnectorMethod, string> = {
  GET: 'bg-success/15 text-success-text',
  POST: 'bg-primary/15 text-primary-text',
  PUT: 'bg-warning/15 text-warning-text',
  PATCH: 'bg-warning/15 text-warning-text',
  DELETE: 'bg-destructive/15 text-destructive-text',
};

/**
 * Builds — or edits — a connector the workspace defines itself: the API it
 * talks to, the sign-in it needs, and the actions (and optional events) it
 * offers. Saved, it is a connector like any other: agents get its actions as
 * tools, workflows as steps, and its events can start an agent.
 */
export function CustomConnectorPage() {
  const { connectorId } = useParams();
  const navigate = useNavigate();
  const detail = useConnectorDetail(connectorId);

  if (!connectorId) return <Builder key="new" initial={blankDraft()} />;
  if (detail.isLoading) return <LoadingState fullPage label="Loading connector…" />;
  const def = detail.data?.customDefinition;
  if (detail.isError || !detail.data || !def || !detail.data.customIntegrationId) {
    return (
      <Page>
        <ErrorState
          title="This connector can’t be edited"
          description={
            detail.isError ? errorMessage(detail.error, 'It may not exist.') : 'Only connectors built in the Studio can be edited. Built-in apps are managed by the platform.'
          }
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/connectors')}>
              All connectors
            </Button>
          }
        />
      </Page>
    );
  }
  return <Builder key={connectorId} initial={draftFromDefinition(def)} integrationId={detail.data.customIntegrationId} provider={detail.data.provider} />;
}

function Builder({ initial, integrationId, provider }: { initial: Draft; integrationId?: string; provider?: string }) {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const invalidate = useInvalidateConnectors();
  const editing = !!integrationId;
  const [draft, setDraft] = useState<Draft>(initial);
  const [openAction, setOpenAction] = useState<string | null>(editing ? null : (initial.actions[0]?.key ?? null));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
  const setAction = (key: string, next: Partial<ActionDraft>) =>
    setDraft((d) => ({ ...d, actions: d.actions.map((a) => (a.key === key ? { ...a, ...next } : a)) }));

  const input = inputFromDraft(draft);
  const readActions = draft.actions.filter((a) => actionPermission(a) === 'read' && !a.params.some((p) => p.required));
  const needsSecret =
    !editing &&
    ((draft.authType === 'BEARER' && !draft.bearerToken.trim()) ||
      ((draft.authType === 'API_KEY_HEADER' || draft.authType === 'API_KEY_QUERY') && !draft.apiKey.trim()) ||
      (draft.authType === 'BASIC' && !draft.basicPassword.trim()));

  const save = async () => {
    if (!activeWorkspace) return;
    const problems = validateCustomConnector(input);
    if (needsSecret) problems.push('Enter the API key, token or password the API expects.');
    setErrors(problems);
    if (problems.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      const saved = editing
        ? await updateCustomConnector(activeWorkspace.id, integrationId, input)
        : await createCustomConnector(activeWorkspace.id, input);
      await invalidate();
      toast.success(editing ? `${draft.name} updated.` : `${draft.name} is ready to use.`);
      navigate(`/connectors/${saved.provider.toLowerCase()}`);
    } catch (error) {
      setErrors([errorMessage(error, 'Couldn’t save the connector.')]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!activeWorkspace || !integrationId) return;
    const ok = await confirm({
      title: `Delete ${draft.name}?`,
      description: 'Its actions disappear for good. Agents and workflows that use this connector stop working until you rebuild it.',
      confirmLabel: 'Delete connector',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCustomConnector(activeWorkspace.id, integrationId);
      await invalidate();
      toast.success(`${draft.name} deleted.`);
      navigate('/connectors');
    } catch (error) {
      toast.error(errorMessage(error, 'Couldn’t delete the connector.'));
    }
  };

  return (
    <Page>
      <Button
        variant="link"
        size="xs"
        type="button"
        onClick={() => navigate(editing && provider ? `/connectors/${provider.toLowerCase()}` : '/connectors')}
        className="mb-3 h-auto gap-1 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> {editing ? draft.name : 'App Connectors'}
      </Button>
      <PageHeader
        title={editing ? `Edit ${draft.name || 'connector'}` : 'Build a connector'}
        description="Describe an API and the actions it offers. Once saved, agents can use each action as a tool, workflows as a step, and its events can start an agent."
        icon={<Plug />}
        actions={
          <div className="flex items-center gap-2">
            {editing && (
              <Button size="sm" variant="outline" onClick={remove} leadingIcon={<Trash2 />} className="text-destructive-text">
                Delete
              </Button>
            )}
            <Button size="sm" onClick={save} loading={saving} leadingIcon={<Save />}>
              {editing ? 'Save changes' : 'Create connector'}
            </Button>
          </div>
        }
      />

      {errors.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-text">
          <div className="mb-1 font-medium">{errors.length === 1 ? 'One thing to fix' : `${errors.length} things to fix`}</div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-5 pb-24">
        <Section step={1} title="About this connector" description="How it appears in the connector list and in the agent builder.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="cc-name" required>
              <Input id="cc-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Acme Orders" maxLength={60} />
            </Field>
            <Field label="Category" htmlFor="cc-category">
              <AppSelect value={draft.category} onValueChange={(v) => patch({ category: v as Draft['category'] })} options={CATEGORY_OPTIONS} searchable />
            </Field>
          </div>
          <Field label="What is it for?" htmlFor="cc-desc" hint="Agents read this to decide when to use the connector.">
            <Textarea id="cc-desc" rows={2} value={draft.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Looks up and manages customer orders in Acme." />
          </Field>
          {!editing && (
            <Field label="Who can use it" hint={draft.scope === 'WORKSPACE' ? 'Everyone in the workspace can use it in their agents.' : 'Only you can use it.'}>
              <SegmentedControl<'WORKSPACE' | 'USER'>
                aria-label="Who can use this connector"
                size="sm"
                value={draft.scope}
                onChange={(scope) => patch({ scope })}
                options={[
                  { value: 'WORKSPACE', label: 'Whole workspace' },
                  { value: 'USER', label: 'Only me' },
                ]}
              />
            </Field>
          )}
        </Section>

        <Section step={2} title="Connection" description="Where the API lives and how it signs requests. Secrets are encrypted and never sent back to the browser.">
          <Field label="Base URL" htmlFor="cc-url" required hint="Every action’s path is added to this.">
            <Input id="cc-url" value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} placeholder="https://api.example.com/v1" inputMode="url" autoComplete="off" />
          </Field>
          <Field label="Sign-in">
            <AppSelect value={draft.authType} onValueChange={(v) => patch({ authType: v as CustomConnectorAuthType })} options={AUTH_OPTIONS} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            {draft.authType === 'BEARER' && (
              <Secret id="cc-bearer" label="Bearer token" value={draft.bearerToken} onChange={(v) => patch({ bearerToken: v })} editing={editing} />
            )}
            {(draft.authType === 'API_KEY_HEADER' || draft.authType === 'API_KEY_QUERY') && (
              <>
                {draft.authType === 'API_KEY_HEADER' ? (
                  <Field label="Header name" htmlFor="cc-keyhdr" required>
                    <Input id="cc-keyhdr" value={draft.apiKeyHeader} onChange={(e) => patch({ apiKeyHeader: e.target.value })} placeholder="X-API-Key" />
                  </Field>
                ) : (
                  <Field label="URL parameter" htmlFor="cc-keyq" required>
                    <Input id="cc-keyq" value={draft.apiKeyQueryParam} onChange={(e) => patch({ apiKeyQueryParam: e.target.value })} placeholder="api_key" />
                  </Field>
                )}
                <Secret id="cc-key" label="API key" value={draft.apiKey} onChange={(v) => patch({ apiKey: v })} editing={editing} />
              </>
            )}
            {draft.authType === 'BASIC' && (
              <>
                <Field label="Username" htmlFor="cc-user" required>
                  <Input id="cc-user" value={draft.basicUsername} onChange={(e) => patch({ basicUsername: e.target.value })} autoComplete="off" />
                </Field>
                <Secret id="cc-pass" label="Password" value={draft.basicPassword} onChange={(v) => patch({ basicPassword: v })} editing={editing} />
              </>
            )}
          </div>
          <RowsEditor
            label="Extra headers"
            hint="Sent with every request, e.g. an API version. Values are stored encrypted."
            rows={draft.headerRows}
            onChange={(headerRows) => patch({ headerRows })}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
            secretValues
            addLabel="Add a header"
          />
        </Section>

        <Section
          step={3}
          title="Actions"
          description="Each action is one request. Use {{name}} anywhere in the path, query or body for a value the agent supplies."
          aside={<Badge variant="neutral">{draft.actions.length}</Badge>}
        >
          <div className="space-y-3">
            {draft.actions.map((a) => (
              <ActionEditor
                key={a.key}
                action={a}
                draft={draft}
                integrationId={integrationId}
                open={openAction === a.key}
                onToggle={() => setOpenAction(openAction === a.key ? null : a.key)}
                onChange={(next) => setAction(a.key, next)}
                onRemove={() => {
                  setDraft((d) => ({
                    ...d,
                    actions: d.actions.filter((x) => x.key !== a.key),
                    triggers: d.triggers.filter((t) => t.actionId !== (a.id || actionFromDraft(a).id)),
                  }));
                }}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            leadingIcon={<Plus />}
            onClick={() => {
              const next = blankAction();
              setDraft((d) => ({ ...d, actions: [...d.actions, next] }));
              setOpenAction(next.key);
            }}
          >
            Add an action
          </Button>
        </Section>

        <Section
          step={4}
          title="Events (optional)"
          description="Let something in this API start an agent. The platform checks a read action every minute and starts one run for each new item."
          aside={<Zap className="size-4 text-warning" aria-hidden="true" />}
        >
          {draft.triggers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {readActions.length
                ? 'No events yet. Add one to start agents when a new order, ticket or record appears.'
                : 'Events watch a read action that needs no inputs (for example “List orders”). Add one first.'}
            </p>
          )}
          {draft.triggers.map((t) => (
            <TriggerEditor
              key={t.key}
              trigger={t}
              readActions={readActions.map((a) => ({ value: actionFromDraft(a).id, label: a.label || actionFromDraft(a).id }))}
              onChange={(next) => setDraft((d) => ({ ...d, triggers: d.triggers.map((x) => (x.key === t.key ? { ...x, ...next } : x)) }))}
              onRemove={() => setDraft((d) => ({ ...d, triggers: d.triggers.filter((x) => x.key !== t.key) }))}
            />
          ))}
          <Button
            size="sm"
            variant="outline"
            leadingIcon={<Plus />}
            disabled={readActions.length === 0}
            onClick={() => {
              const first = readActions[0];
              const trigger: TriggerDraft = {
                key: newKey(),
                id: `new_${draft.triggers.length + 1}`,
                label: '',
                actionId: first ? actionFromDraft(first).id : '',
                itemsPath: '',
                idField: 'id',
              };
              setDraft((d) => ({ ...d, triggers: [...d.triggers, trigger] }));
            }}
          >
            Add an event
          </Button>
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {editing ? 'Changes apply to agents and workflows the moment you save.' : 'Saving checks that the API can be reached with these credentials.'}
          </p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button size="sm" variant="outline" onClick={() => navigate(editing && provider ? `/connectors/${provider.toLowerCase()}` : '/connectors')}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving} leadingIcon={<Save />}>
              {editing ? 'Save changes' : 'Create connector'}
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Section({ step, title, description, aside, children }: { step: number; title: string; description: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary-text">{step}</span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, htmlFor, hint, required, children }: { label: string; htmlFor?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="flex items-center gap-1 text-xs font-medium text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-label="required">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Secret({ id, label, value, onChange, editing }: { id: string; label: string; value: string; onChange: (v: string) => void; editing: boolean }) {
  return (
    <Field label={label} htmlFor={id} required={!editing} hint={editing ? 'Leave blank to keep the saved one.' : undefined}>
      <Input id={id} type="password" autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={editing ? '••••••••' : undefined} />
    </Field>
  );
}

function RowsEditor({
  label,
  hint,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  secretValues,
}: {
  label: string;
  hint?: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  secretValues?: boolean;
}) {
  const set = (i: number, next: Partial<Row>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-foreground">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input aria-label={keyPlaceholder} value={r.k} onChange={(e) => set(i, { k: e.target.value })} placeholder={keyPlaceholder} className="text-xs" />
          <Input
            aria-label={valuePlaceholder}
            type={secretValues ? 'password' : 'text'}
            autoComplete="off"
            value={r.v}
            onChange={(e) => set(i, { v: e.target.value })}
            placeholder={valuePlaceholder}
            className="text-xs"
          />
          <Button variant="ghost" size="icon-xs" type="button" aria-label="Remove" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="xs" type="button" leadingIcon={<Plus />} onClick={() => onChange([...rows, { k: '', v: '' }])}>
        {addLabel}
      </Button>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ActionEditor({
  action: a,
  draft,
  integrationId,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  action: ActionDraft;
  draft: Draft;
  integrationId?: string;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Partial<ActionDraft>) => void;
  onRemove: () => void;
}) {
  const permission = actionPermission(a);
  const missing = missingInputs(a);
  const hasBody = a.method !== 'GET';
  const idShown = a.id || actionFromDraft(a).id;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold', METHOD_STYLE[a.method])}>{a.method}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{a.label || 'Untitled action'}</span>
          <span className="block truncate font-mono text-[11px] text-muted-foreground">{a.path || '/'}</span>
        </span>
        <Badge variant={permission === 'read' ? 'success' : permission === 'destructive' ? 'destructive' : 'warning'}>
          {permission === 'read' ? 'Reads' : permission === 'destructive' ? 'Deletes' : 'Writes'}
        </Badge>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Action name" htmlFor={`${a.key}-label`} required>
              <Input
                id={`${a.key}-label`}
                value={a.label}
                onChange={(e) => onChange({ label: e.target.value, ...(a.idTouched ? {} : { id: slugify(e.target.value) }) })}
                placeholder="Get order"
              />
            </Field>
            <Field label="Id" htmlFor={`${a.key}-id`} hint="Part of the tool name agents call. Lowercase letters, numbers and underscores.">
              <Input id={`${a.key}-id`} value={idShown} onChange={(e) => onChange({ id: e.target.value.toLowerCase(), idTouched: true })} className="font-mono text-xs" />
            </Field>
          </div>
          <Field label="What it does" htmlFor={`${a.key}-desc`} required hint="Written for the agent: when should it use this action?">
            <Textarea id={`${a.key}-desc`} rows={2} value={a.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Fetches one order by its id, including its items and status." />
          </Field>

          <div className="grid gap-3 md:grid-cols-[9rem_1fr]">
            <Field label="Method">
              <AppSelect value={a.method} onValueChange={(v) => onChange({ method: v as CustomConnectorMethod })} options={METHODS.map((m) => ({ value: m, label: m }))} />
            </Field>
            <Field label="Path" htmlFor={`${a.key}-path`} hint="Added to the base URL. Example: /orders/{{orderId}}">
              <Input id={`${a.key}-path`} value={a.path} onChange={(e) => onChange({ path: e.target.value })} placeholder="/orders/{{orderId}}" className="font-mono text-xs" />
            </Field>
          </div>

          {hasBody && a.method !== 'DELETE' && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2">
              <div>
                <div className="text-xs font-medium text-foreground">This only reads data</div>
                <div className="text-[11px] text-muted-foreground">For search endpoints that use POST. Agents then run it without asking, and events can watch it.</div>
              </div>
              <Switch aria-label="This only reads data" checked={a.permissionLevel === 'read'} onCheckedChange={(on) => onChange({ permissionLevel: on ? 'read' : undefined })} />
            </div>
          )}

          <RowsEditor
            label="Query parameters"
            rows={a.queryRows}
            onChange={(queryRows) => onChange({ queryRows })}
            keyPlaceholder="name"
            valuePlaceholder="value or {{input}}"
            addLabel="Add a parameter"
          />

          {hasBody && (
            <Field label="Body (JSON)" htmlFor={`${a.key}-body`} hint='Put placeholders in quotes: {"customer": "{{customer}}", "qty": "{{qty}}"}. Leave empty to send the inputs that aren’t in the path or query.'>
              <Textarea id={`${a.key}-body`} rows={5} value={a.body ?? ''} onChange={(e) => onChange({ body: e.target.value })} className="font-mono text-xs" placeholder={'{\n  "customer": "{{customer}}"\n}'} />
            </Field>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground">Inputs</div>
            {a.params.length === 0 && <p className="text-xs text-muted-foreground">No inputs. Add {'{{name}}'} to the path, query or body to ask the agent for a value.</p>}
            {a.params.map((p, i) => {
              const setParam = (next: Partial<typeof p>) => onChange({ params: a.params.map((x, idx) => (idx === i ? { ...x, ...next } : x)) });
              return (
                <div key={i} className="grid grid-cols-2 items-center gap-2 md:grid-cols-[1fr_7rem_5.5rem_1.4fr_auto]">
                  <Input aria-label="Input name" value={p.name} onChange={(e) => setParam({ name: e.target.value })} placeholder="orderId" className="font-mono text-xs" />
                  <AppSelect value={p.type} onValueChange={(v) => setParam({ type: v as CustomConnectorParamType })} options={TYPE_OPTIONS} />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch aria-label={`${p.name || 'Input'} is required`} checked={p.required} onCheckedChange={(required) => setParam({ required })} />
                    Required
                  </label>
                  <Input aria-label="Description" value={p.description ?? ''} onChange={(e) => setParam({ description: e.target.value })} placeholder="Shown to the agent" className="col-span-2 text-xs md:col-span-1" />
                  <Button variant="ghost" size="icon-xs" type="button" aria-label={`Remove ${p.name || 'input'}`} onClick={() => onChange({ params: a.params.filter((_, idx) => idx !== i) })}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="xs" type="button" leadingIcon={<Plus />} onClick={() => onChange({ params: [...a.params, newParam('')] })}>
                Add an input
              </Button>
              {missing.map((name) => (
                <Button key={name} variant="outline" size="xs" type="button" onClick={() => onChange({ params: [...a.params, newParam(name)] })}>
                  Add input “{name}”
                </Button>
              ))}
            </div>
          </div>

          <TestRun action={a} draft={draft} integrationId={integrationId} />

          <div className="flex justify-end border-t border-border pt-3">
            <Button variant="ghost" size="xs" type="button" onClick={onRemove} leadingIcon={<Trash2 />} className="text-destructive-text">
              Remove this action
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function slugify(label: string): string {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(id) || !id ? id : `a_${id}`.slice(0, 40);
}

/** Runs the action for real against the API with the form as it is now — nothing is saved. */
function TestRun({ action, draft, integrationId }: { action: ActionDraft; draft: Draft; integrationId?: string }) {
  const { activeWorkspace } = useStudioSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; data?: unknown } | null>(null);
  const built = actionFromDraft(action);
  const schema = customActionDefinition(built).inputSchema;
  const permission = actionPermission(action);
  const incomplete = missingRequired(schema, values);

  const run = async () => {
    if (!activeWorkspace) return;
    if (!draft.baseUrl.trim()) {
      setResult({ ok: false, message: 'Enter the base URL first (step 2).' });
      return;
    }
    if (permission !== 'read') {
      const ok = await confirm({
        title: `Run “${action.label || built.id}” for real?`,
        description: `This sends a ${action.method} request to ${draft.name || 'the API'} and ${permission === 'destructive' ? 'deletes' : 'changes'} real data.`,
        confirmLabel: 'Run it',
        destructive: permission === 'destructive',
      });
      if (!ok) return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await testCustomAction(activeWorkspace.id, {
        connector: inputFromDraft(draft),
        actionId: built.id,
        values: coerceSchemaInput(schema, values),
        confirm: permission !== 'read',
        ...(integrationId ? { integrationId } : {}),
      });
      setResult({ ok: res.success, message: res.message ?? (res.success ? 'Done.' : 'The API refused it.'), data: res.data });
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error, 'The test couldn’t run.') });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-foreground">Try it</div>
          <div className="text-[11px] text-muted-foreground">Sends a real request with the form as it is now. Nothing is saved.</div>
        </div>
        <Button size="xs" onClick={run} loading={running} disabled={incomplete.length > 0} leadingIcon={<Play />}>
          Run test
        </Button>
      </div>
      {built.params.length > 0 && <SchemaFields schema={schema} values={values} onChange={setValues} idPrefix={`${action.key}-test`} />}
      {result && (
        <div role="status" className={cn('rounded-lg border p-3 text-xs', result.ok ? 'border-success/30 bg-success/10 text-success-text' : 'border-destructive/30 bg-destructive/10 text-destructive-text')}>
          {result.message}
          {result.data !== undefined && (
            <CodeBlock variant="compact" className="mt-2 max-h-64 overflow-auto text-foreground" language="json" code={JSON.stringify(result.data, null, 2).slice(0, 20_000)} />
          )}
        </div>
      )}
    </div>
  );
}

function TriggerEditor({
  trigger: t,
  readActions,
  onChange,
  onRemove,
}: {
  trigger: TriggerDraft;
  readActions: Array<{ value: string; label: string }>;
  onChange: (next: Partial<TriggerDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Event name" htmlFor={`${t.key}-label`} required>
          <Input
            id={`${t.key}-label`}
            value={t.label}
            onChange={(e) => onChange({ label: e.target.value, id: slugify(e.target.value) || t.id })}
            placeholder="New order"
          />
        </Field>
        <Field label="Watches">
          <AppSelect value={t.actionId} onValueChange={(actionId) => onChange({ actionId })} options={readActions} placeholder="Pick a read action" />
        </Field>
        <Field label="Where the list is" htmlFor={`${t.key}-path`} hint="Path to the list in the response, like data.orders. Empty if the response is the list.">
          <Input id={`${t.key}-path`} value={t.itemsPath} onChange={(e) => onChange({ itemsPath: e.target.value })} placeholder="data.orders" className="font-mono text-xs" />
        </Field>
        <Field label="Field that identifies an item" htmlFor={`${t.key}-id`} hint="New ids are what start a run.">
          <Input id={`${t.key}-id`} value={t.idField} onChange={(e) => onChange({ idField: e.target.value })} placeholder="id" className="font-mono text-xs" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="xs" type="button" onClick={onRemove} leadingIcon={<Trash2 />} className="text-destructive-text">
          Remove this event
        </Button>
      </div>
    </div>
  );
}

export default CustomConnectorPage;
