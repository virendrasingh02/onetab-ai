import { FEATURE_REGISTRY, type FeatureState } from '@org/platform';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@org/ui';
import { useAppMetadata } from './app-metadata.js';
import { useDesktop } from './desktop-provider.js';
import { useAllFeatures, usePlatformSnapshot } from './use-feature.js';

const STATE_TONE: Record<FeatureState, 'success' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  DISABLED: 'warning',
  HIDDEN: 'neutral',
  WEB_ONLY: 'neutral',
  EXTERNAL: 'neutral',
  REQUIRES_PERMISSION: 'warning',
  REQUIRES_PLAN: 'warning',
  STORE_RESTRICTED: 'warning',
  OS_UNSUPPORTED: 'neutral',
  COMING_SOON: 'neutral',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}

/**
 * Internal-only screen showing exactly what the capability/feature engine
 * currently believes about this session — platform, runtime, distribution,
 * every capability, and every registered feature's resolved state and
 * reason. Never linked from anywhere in a production build; see
 * `PlatformDiagnosticsLink`, which is the only thing that routes here and
 * renders `null` outside of `import.meta.env.DEV`.
 */
export function PlatformDiagnosticsPage() {
  const { appInfo } = useDesktop();
  const metadata = useAppMetadata();
  const snapshot = usePlatformSnapshot();
  const features = useAllFeatures();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Platform &amp; feature diagnostics</h1>
        <p className="text-xs text-muted-foreground">
          Development-only — this route is not linked from anywhere once{' '}
          <code className="font-mono">import.meta.env.PROD</code> is true.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Runtime</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:grid-cols-3">
          <Field label="Application" value={metadata.productName} />
          <Field label="Version" value={metadata.version} />
          <Field label="Platform" value={snapshot.platform} />
          <Field label="Runtime" value={snapshot.runtime} />
          <Field label="Distribution" value={snapshot.distribution} />
          <Field label="Architecture" value={snapshot.architecture ?? 'unknown'} />
          <Field label="Packaged" value={appInfo ? String(appInfo.isPackaged) : 'n/a (web)'} />
          <Field label="macOS App Sandbox" value="Not declared — see DESKTOP_STORE_COMPLIANCE_AUDIT.md" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          {Object.entries(snapshot.capabilities).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="font-mono">{key}</span>
              <Badge variant={value ? 'success' : 'neutral'}>{value ? 'AVAILABLE' : 'UNAVAILABLE'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feature states ({features.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {FEATURE_REGISTRY[feature.id]?.name ?? feature.id}
                </p>
                {feature.reason ? (
                  <p className="text-[11px] text-muted-foreground">{feature.reason}</p>
                ) : null}
              </div>
              <Badge variant={STATE_TONE[feature.state]} className="shrink-0 font-mono">
                {feature.state}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
