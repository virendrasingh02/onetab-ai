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
  usePluginSDK,
  useRegisterPlugin,
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
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
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
