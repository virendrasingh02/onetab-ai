import type { PluginManifest } from '@org/types';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  KeyRound,
  Puzzle,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Panel, QueryState, ViewHeader, ViewShell } from './marketplace-ui.js';
import { Storefront } from './storefront-view.js';
import {
  usePluginRegistration,
  usePluginSDK,
  useRegisterPlugin,
  useRotatePluginKey,
  useSetPluginStatus,
  useValidateManifest,
} from './use-marketplace.js';

type Tab = 'browse' | 'build';

const STARTER_MANIFEST = `{
  "name": "My Plugin",
  "slug": "my-plugin",
  "version": "1.0.0",
  "sdkVersion": "1.0.0",
  "runtime": "SANDBOXED_JS",
  "entryPoint": "dist/plugin.js",
  "scopes": ["read:channels", "read:messages"],
  "surfaces": ["channel.toolbar"]
}`;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="px-2 py-1 rounded gap-1 flex items-center bg-surface-raised text-[11px] text-foreground transition hover:bg-muted"
    >
      {copied ? (
        <Check className="w-3 h-3 text-success" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** SDK reference: what a manifest may declare, and which scopes need consent. */
function SDKReference() {
  const sdk = usePluginSDK();

  return (
    <QueryState isLoading={sdk.isLoading} error={sdk.error}>
      {sdk.data ? (
        <div className="xl:grid-cols-3 gap-6 grid grid-cols-1">
          <Panel
            title="Runtimes"
            subtitle={`Host SDK v${sdk.data.sdkVersion}`}
            className="xl:col-span-1"
          >
            <ul className="space-y-2">
              {sdk.data.runtimes.map((runtime) => (
                <li
                  key={runtime}
                  className="gap-2 text-xs flex items-start text-foreground"
                >
                  <Terminal className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent-blue" />
                  <div>
                    <code className="text-foreground">{runtime}</code>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {runtime === 'SANDBOXED_JS'
                        ? 'Runs in-process in a locked-down worker. Needs an entryPoint.'
                        : runtime === 'WEBHOOK'
                          ? 'Events are POSTed to your https endpoint. Needs a webhookUrl.'
                          : 'Renders your own origin in a sandboxed iframe.'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Permission scopes"
            subtitle="Amber scopes require an explicit grant from a workspace admin"
            className="xl:col-span-2"
          >
            <div className="gap-1.5 flex flex-wrap">
              {sdk.data.scopes.map((scope) => {
                const privileged = sdk.data.privilegedScopes.includes(scope);
                return (
                  <code
                    key={scope}
                    className={`px-2 py-1 rounded border text-[11px] ${
                      privileged
                        ? 'border-warning/40 bg-warning/15 text-warning'
                        : 'border-border bg-surface-raised text-foreground'
                    }`}
                  >
                    {scope}
                  </code>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="font-semibold tracking-wide mb-2 text-[11px] text-muted-foreground uppercase">
                UI surfaces
              </h4>
              <div className="gap-1.5 flex flex-wrap">
                {sdk.data.surfaces.map((surface) => (
                  <code
                    key={surface}
                    className="px-2 py-1 rounded border border-border bg-surface-raised text-[11px] text-foreground"
                  >
                    {surface}
                  </code>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </QueryState>
  );
}

/**
 * Manifest validator and registration.
 *
 * Validation runs server-side against the same code that gates registration,
 * so a manifest that passes here cannot fail at publish for a different reason.
 */
function ManifestConsole() {
  const [source, setSource] = useState(STARTER_MANIFEST);
  const [registerSlug, setRegisterSlug] = useState('');
  const validate = useValidateManifest();
  const register = useRegisterPlugin();

  const parsed = useMemo(() => {
    try {
      return { manifest: JSON.parse(source) as PluginManifest, error: null };
    } catch (error) {
      return { manifest: null, error: (error as Error).message };
    }
  }, [source]);

  const result = validate.data;
  const credentials = register.data;

  return (
    <div className="xl:grid-cols-2 gap-6 grid grid-cols-1">
      <Panel
        title="Plugin manifest"
        subtitle="Declare your runtime, scopes and UI surfaces"
        actions={<CopyButton value={source} label="Copy" />}
      >
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          spellCheck={false}
          rows={16}
          aria-label="Plugin manifest JSON"
          className="px-3 py-2 text-xs w-full resize-y rounded-lg border border-border bg-background font-mono text-foreground transition outline-none focus:border-border"
        />

        {parsed.error ? (
          <p className="mt-2 gap-1.5 flex items-center text-[11px] text-destructive">
            <AlertTriangle className="w-3 h-3" /> Invalid JSON: {parsed.error}
          </p>
        ) : null}

        <div className="gap-2 mt-3 flex flex-wrap items-center">
          <button
            type="button"
            disabled={!parsed.manifest || validate.isPending}
            onClick={() => validate.mutate(parsed.manifest as PluginManifest)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background transition hover:bg-foreground/85 disabled:opacity-50"
          >
            {validate.isPending ? 'Validating…' : 'Validate manifest'}
          </button>

          <input
            value={registerSlug}
            onChange={(event) => setRegisterSlug(event.target.value)}
            placeholder="listing slug to register against"
            aria-label="Listing slug"
            className="px-3 py-1.5 text-xs min-w-[12rem] flex-1 rounded-lg border border-border bg-background text-foreground transition outline-none placeholder:text-muted-foreground focus:border-border"
          />
          <button
            type="button"
            disabled={
              !parsed.manifest || !registerSlug.trim() || register.isPending
            }
            onClick={() =>
              register.mutate({
                slug: registerSlug.trim(),
                manifest: parsed.manifest as PluginManifest,
              })
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-success-foreground transition hover:bg-success/90 disabled:opacity-50"
          >
            {register.isPending ? 'Registering…' : 'Register plugin'}
          </button>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Validation result">
          {!result ? (
            <p className="text-xs text-muted-foreground">
              Validate a manifest to see which scopes it requests and whether
              the host SDK accepts it.
            </p>
          ) : result.valid ? (
            <div className="space-y-3">
              <p className="text-xs gap-1.5 flex items-center text-success">
                <Check className="w-3.5 h-3.5" /> The manifest is valid against
                SDK v{result.normalised.sdkVersion}.
              </p>
              {result.requiresConsent.length > 0 ? (
                <div className="p-3 rounded-lg border border-warning/40 bg-warning/15">
                  <p className="font-semibold gap-1.5 mb-1.5 flex items-center text-[11px] text-warning">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Needs an admin&apos;s explicit consent at install time
                  </p>
                  <div className="gap-1 flex flex-wrap">
                    {result.requiresConsent.map((scope) => (
                      <code
                        key={scope}
                        className="px-1.5 py-0.5 rounded bg-warning/15 text-[10px] text-warning"
                      >
                        {scope}
                      </code>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Requests read-only scopes — installs without a consent prompt.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {result.errors.map((error) => (
                <li
                  key={error}
                  className="text-xs gap-1.5 flex items-start text-destructive"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {error}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="API credentials"
          subtitle="Shown once — the server stores only a hash"
        >
          {register.error ? (
            <p className="text-xs gap-1.5 flex items-start text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {register.error instanceof Error
                ? register.error.message
                : 'Registration failed.'}
            </p>
          ) : credentials ? (
            <div className="space-y-2">
              <div className="gap-2 flex items-center">
                <KeyRound className="w-4 h-4 shrink-0 text-warning" />
                <code className="px-2 py-1.5 rounded flex-1 border border-border bg-background text-[11px] break-all text-warning">
                  {credentials.apiKey}
                </code>
                <CopyButton value={credentials.apiKey} label="Copy key" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Registered{' '}
                <code className="text-muted-foreground">
                  {credentials.listingSlug}
                </code>{' '}
                against SDK v{credentials.sdkVersion} with{' '}
                {credentials.scopes.length} scopes. Store this key now — it
                cannot be retrieved again, only rotated.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Register a validated manifest against a published PLUGIN listing
              to issue an API key.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PluginManagementConsole() {
  const [lookupSlug, setLookupSlug] = useState('');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [newRotatedKey, setNewRotatedKey] = useState<string | null>(null);

  const regQuery = usePluginRegistration(activeSlug);
  const rotateKey = useRotatePluginKey();
  const setStatus = useSetPluginStatus();

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupSlug.trim()) return;
    setActiveSlug(lookupSlug.trim().toLowerCase());
    setNewRotatedKey(null);
  };

  const handleRotate = async () => {
    if (!activeSlug) return;
    try {
      const res = await rotateKey.mutateAsync(activeSlug);
      setNewRotatedKey(res.apiKey);
    } catch {
      // handled by mutation state
    }
  };

  const handleToggleStatus = async () => {
    if (!activeSlug || !regQuery.data) return;
    const nextStatus = regQuery.data.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await setStatus.mutateAsync({ slug: activeSlug, status: nextStatus });
    void regQuery.refetch();
  };

  return (
    <Panel
      title="Plugin Key & Registration Management"
      subtitle="Inspect live registration, rotate production API keys, or manage access status"
    >
      <form onSubmit={handleLookup} className="flex gap-2 mb-4">
        <input
          value={lookupSlug}
          onChange={(e) => setLookupSlug(e.target.value)}
          placeholder="Enter registered plugin slug (e.g. github-sync)"
          className="px-3 py-1.5 text-xs flex-1 rounded-lg border border-border bg-background text-foreground transition outline-none placeholder:text-muted-foreground focus:border-border"
        />
        <button
          type="submit"
          disabled={!lookupSlug.trim() || regQuery.isFetching}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background transition hover:bg-foreground/85 disabled:opacity-50"
        >
          {regQuery.isFetching ? 'Loading…' : 'Inspect'}
        </button>
      </form>

      {regQuery.error ? (
        <p className="text-xs gap-1.5 flex items-start text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {regQuery.error instanceof Error
            ? regQuery.error.message
            : 'Plugin registration not found or error loading.'}
        </p>
      ) : regQuery.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-background">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {activeSlug}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    regQuery.data.status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  }`}
                >
                  {regQuery.data.status}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  v{regQuery.data.sdkVersion} · {regQuery.data.runtime}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Key prefix:{' '}
                <code className="text-foreground font-mono">
                  {regQuery.data.apiKeyPrefix || 'None'}
                </code>{' '}
                · Last updated:{' '}
                {new Date(regQuery.data.updatedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={setStatus.isPending}
                className="px-2.5 py-1 text-xs rounded border border-border text-foreground hover:bg-muted transition"
              >
                {regQuery.data.status === 'ACTIVE'
                  ? 'Suspend Plugin'
                  : 'Activate Plugin'}
              </button>

              <button
                type="button"
                onClick={handleRotate}
                disabled={rotateKey.isPending}
                className="px-2.5 py-1 text-xs rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 transition"
              >
                {rotateKey.isPending ? 'Rotating…' : 'Rotate API Key'}
              </button>
            </div>
          </div>

          {newRotatedKey ? (
            <div className="p-3 rounded-lg border border-warning/40 bg-warning/10 space-y-2">
              <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> New Production API Key Generated
              </p>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1.5 rounded flex-1 border border-border bg-background text-[11px] break-all font-mono text-warning">
                  {newRotatedKey}
                </code>
                <CopyButton value={newRotatedKey} label="Copy Key" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Copy and store this new key immediately. The old API key has been revoked and can no longer be used.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

/**
 * Phase 12 — Plugin SDK.
 *
 * Two audiences in one screen: admins installing plugins, and developers
 * building them. Tabs rather than separate routes, because the SDK reference is
 * most useful next to the catalog it publishes into.
 */
export function PluginSDKView() {
  const [tab, setTab] = useState<Tab>('browse');

  if (tab === 'browse') {
    return (
      <Storefront
        kind="PLUGIN"
        title="Plugin SDK & Directory"
        description="Install sandboxed third-party plugins, or build your own against the SDK"
        icon={<Puzzle />}
        listingIcon={() => <Puzzle className="w-5 h-5" />}
        emptyMessage="No plugins match these filters."
      >
        <TabBar tab={tab} onChange={setTab} />
      </Storefront>
    );
  }

  return (
    <ViewShell>
      <ViewHeader
        icon={<Code2 />}
        title="Plugin SDK & Directory"
        description="Validate a manifest, register a plugin, and collect its API key"
      />
      <TabBar tab={tab} onChange={setTab} />
      <div className="space-y-6">
        <SDKReference />
        <ManifestConsole />
        <PluginManagementConsole />
      </div>
    </ViewShell>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { value: Tab; label: string }[] = [
    { value: 'browse', label: 'Browse plugins' },
    { value: 'build', label: 'Build a plugin' },
  ];

  return (
    <div className="gap-1 mb-5 flex border-b border-border">
      {tabs.map((entry) => (
        <button
          key={entry.value}
          type="button"
          onClick={() => onChange(entry.value)}
          aria-current={tab === entry.value}
          className={`px-3 py-2 text-xs font-semibold -mb-px border-b-2 transition ${
            tab === entry.value
              ? 'border-accent-blue/40 text-accent-blue'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
