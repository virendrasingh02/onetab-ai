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
      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 flex items-center gap-1 transition"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Panel
            title="Runtimes"
            subtitle={`Host SDK v${sdk.data.sdkVersion}`}
            className="xl:col-span-1"
          >
            <ul className="space-y-2">
              {sdk.data.runtimes.map((runtime) => (
                <li
                  key={runtime}
                  className="flex items-start gap-2 text-xs text-slate-300"
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-slate-200">{runtime}</code>
                    <p className="text-[11px] text-slate-500 mt-0.5">
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
            <div className="flex flex-wrap gap-1.5">
              {sdk.data.scopes.map((scope) => {
                const privileged = sdk.data.privilegedScopes.includes(scope);
                return (
                  <code
                    key={scope}
                    className={`px-2 py-1 rounded text-[11px] border ${
                      privileged
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {scope}
                  </code>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase mb-2">
                UI surfaces
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {sdk.data.surfaces.map((surface) => (
                  <code
                    key={surface}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300"
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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-lg font-mono text-xs text-slate-200 outline-none resize-y transition"
        />

        {parsed.error ? (
          <p className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Invalid JSON: {parsed.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            disabled={!parsed.manifest || validate.isPending}
            onClick={() => validate.mutate(parsed.manifest as PluginManifest)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-semibold text-white transition"
          >
            {validate.isPending ? 'Validating…' : 'Validate manifest'}
          </button>

          <input
            value={registerSlug}
            onChange={(event) => setRegisterSlug(event.target.value)}
            placeholder="listing slug to register against"
            aria-label="Listing slug"
            className="flex-1 min-w-[12rem] px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 outline-none transition"
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
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-semibold text-white transition"
          >
            {register.isPending ? 'Registering…' : 'Register plugin'}
          </button>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Validation result">
          {!result ? (
            <p className="text-xs text-slate-500">
              Validate a manifest to see which scopes it requests and whether the
              host SDK accepts it.
            </p>
          ) : result.valid ? (
            <div className="space-y-3">
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> The manifest is valid against
                SDK v{result.normalised.sdkVersion}.
              </p>
              {result.requiresConsent.length > 0 ? (
                <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-3">
                  <p className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 mb-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Needs an admin&apos;s explicit consent at install time
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.requiresConsent.map((scope) => (
                      <code
                        key={scope}
                        className="px-1.5 py-0.5 bg-amber-950/60 rounded text-[10px] text-amber-300"
                      >
                        {scope}
                      </code>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Requests read-only scopes — installs without a consent prompt.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {result.errors.map((error) => (
                <li
                  key={error}
                  className="text-xs text-red-400 flex items-start gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
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
            <p className="text-xs text-red-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {register.error instanceof Error
                ? register.error.message
                : 'Registration failed.'}
            </p>
          ) : credentials ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <code className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-[11px] text-amber-300 break-all">
                  {credentials.apiKey}
                </code>
                <CopyButton value={credentials.apiKey} label="Copy key" />
              </div>
              <p className="text-[11px] text-slate-500">
                Registered <code className="text-slate-400">{credentials.listingSlug}</code>{' '}
                against SDK v{credentials.sdkVersion} with{' '}
                {credentials.scopes.length} scopes. Store this key now — it
                cannot be retrieved again, only rotated.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Register a validated manifest against a published PLUGIN listing to
              issue an API key.
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
        icon={<Puzzle className="w-6 h-6 text-blue-400" />}
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
        icon={<Code2 className="w-6 h-6 text-blue-400" />}
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
    <div className="flex gap-1 mb-5 border-b border-slate-800">
      {tabs.map((entry) => (
        <button
          key={entry.value}
          type="button"
          onClick={() => onChange(entry.value)}
          aria-current={tab === entry.value}
          className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition ${
            tab === entry.value
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
