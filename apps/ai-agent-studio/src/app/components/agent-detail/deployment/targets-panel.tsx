import type { AgentDeploymentView } from '@org/types';
import { Badge, Button, Card, CodeBlock } from '@org/ui';
import { cn } from '@org/utils';
import { ArrowRight, Code2, Laptop, Layers, Maximize2, MessageSquare, Server, Sparkles, Terminal, Zap, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { InstallCheck } from './install-check.js';
import type { DeploymentSection } from './overview-panel.js';
import { SnippetBlock } from './parts.js';
import { readWidgetForm } from './widget-config.js';
import { buildSnippets, type SnippetId } from './snippets.js';
import { apiBase } from './use-deployment.js';

type TargetId = 'widget' | 'inline' | 'iframe' | 'web-component' | 'react' | 'rest' | 'headless' | 'webhooks' | 'desktop';

interface Target {
  id: TargetId;
  label: string;
  icon: LucideIcon;
  badge?: string;
  title: string;
  description: string;
  /** What the person needs before this works. */
  needs?: 'api-key' | 'public-key';
}

const TARGETS: Target[] = [
  {
    id: 'widget',
    label: 'Floating chat widget',
    icon: MessageSquare,
    badge: 'Popular',
    title: 'Floating chat widget',
    description:
      'A chat button on any website. One script tag, no build step. It runs in a Shadow DOM, so your site’s CSS can’t break it.',
    needs: 'public-key',
  },
  {
    id: 'inline',
    label: 'Inline widget',
    icon: Layers,
    title: 'Inline widget',
    description: 'The assistant rendered inside a container on your page: a help centre, a dashboard panel.',
    needs: 'public-key',
  },
  {
    id: 'iframe',
    label: 'Iframe embed',
    icon: Maximize2,
    title: 'Iframe embed',
    description: 'For site builders and portals that don’t allow custom scripts (WordPress, Notion, Wix, Squarespace).',
    needs: 'public-key',
  },
  {
    id: 'web-component',
    label: 'Web component',
    icon: Code2,
    title: 'Web component (<onetab-agent>)',
    description: 'A standard custom element that works in Vue, Angular, Svelte or plain HTML.',
    needs: 'public-key',
  },
  {
    id: 'react',
    label: 'React',
    icon: Sparkles,
    title: 'React',
    description: 'A component that loads the widget on mount and removes it on unmount.',
    needs: 'public-key',
  },
  {
    id: 'rest',
    label: 'REST API',
    icon: Terminal,
    badge: 'API',
    title: 'REST API',
    description: 'Run the agent from any backend. The call is synchronous and returns the finished run.',
    needs: 'api-key',
  },
  {
    id: 'headless',
    label: 'Headless worker',
    icon: Server,
    title: 'Headless worker',
    description: 'Batch jobs, queues and cron: run tasks with no chat UI, and handle runs that wait for approval.',
    needs: 'api-key',
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: Zap,
    title: 'Webhooks & events',
    description: 'Signed HTTP POSTs when a run completes, fails, or needs approval.',
  },
  {
    id: 'desktop',
    label: 'Desktop app',
    icon: Laptop,
    title: 'Onetab desktop app',
    description: 'Call the agent from the desktop app’s renderer through its IPC bridge.',
  },
];

const SNIPPET_FOR: Partial<Record<TargetId, SnippetId>> = {
  widget: 'widget',
  inline: 'inline',
  iframe: 'iframe',
  'web-component': 'webComponent',
  react: 'react',
  headless: 'headless',
  desktop: 'desktop',
};

const WEBHOOK_VERIFY = `import { createHmac, timingSafeEqual } from 'node:crypto';

// \`rawBody\` must be the exact bytes received, before any JSON parsing.
export function verifyOneTabWebhook(rawBody, headers, secret) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = String(headers['x-onetab-signature'] ?? '').replace('sha256=', '');
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Body: { id, event, timestamp, payload }
// Headers: x-onetab-signature, x-onetab-event, x-onetab-delivery-id, x-onetab-timestamp`;

export function TargetsPanel({
  deployment,
  agentId,
  onNavigate,
  widgetDirty = false,
}: {
  deployment: AgentDeploymentView;
  agentId: string;
  onNavigate: (section: DeploymentSection) => void;
  widgetDirty?: boolean;
}) {
  const [active, setActive] = useState<TargetId>('widget');
  const [restLang, setRestLang] = useState<'curl' | 'node' | 'python'>('curl');

  const widgetTheme = String((deployment.widgetConfig as { appearance?: { theme?: string } })?.appearance?.theme ?? 'dark');
  const snippets = useMemo(
    () => buildSnippets({ apiBase: apiBase(), agentId, publicKey: deployment.publicKey, theme: widgetTheme }),
    [agentId, deployment.publicKey, widgetTheme],
  );

  const style = readWidgetForm(deployment.widgetConfig);
  const styleLabel = { panel: 'Panel', compact: 'Compact', pill: 'Pill' }[style.layout];

  const target = TARGETS.find((t) => t.id === active) ?? TARGETS[0];
  const snippetId = SNIPPET_FOR[active];
  const suspended = deployment.status !== 'ACTIVE';

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      <div className="space-y-1" role="tablist" aria-label="Deployment targets" aria-orientation="vertical">
        {TARGETS.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              variant={selected ? 'primary' : 'ghost'}
              onClick={() => setActive(item.id)}
              className="h-auto w-full justify-between rounded-xl px-3 py-2.5 text-left font-semibold"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge ? (
                <Badge variant="outline" className={cn('px-1.5 py-0 text-2xs uppercase', selected && 'border-background/30 text-background')}>
                  {item.badge}
                </Badge>
              ) : null}
            </Button>
          );
        })}
      </div>

      <div className="space-y-4 md:col-span-3">
        <Card className="space-y-4 p-6 shadow-2xs">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{target.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{target.description}</p>
          </div>

          {suspended ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning" role="status">
              This deployment is {deployment.status.toLowerCase()}, so embeds and API calls are refused until you reactivate it.
            </p>
          ) : null}

          {active === 'widget' || active === 'inline' || active === 'react' || active === 'web-component' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs" role="status">
              <span className="text-muted-foreground">
                Live style from your deployment: <strong className="text-foreground">{styleLabel}</strong> · {style.position === 'bottom-left' ? 'bottom left' : 'bottom right'} · {style.theme}
                <span className="ml-2 inline-block size-2.5 rounded-full align-middle" style={{ background: style.primaryColor }} />
                <span className="block">The script has no style option: it reads this from the API each time it loads, so saving in Widget Studio updates every site.</span>
                {widgetDirty ? <span className="block font-semibold text-warning">You have unsaved changes in Widget Studio. Save them or this snippet keeps serving {styleLabel}.</span> : null}
              </span>
              <Button type="button" variant="outline" size="xs" onClick={() => onNavigate('widget')}>Change style</Button>
            </div>
          ) : null}

          {target.needs === 'api-key' ? (
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Uses a private API key, never the public key.
              <Button type="button" variant="link" size="xs" className="h-auto" onClick={() => onNavigate('api-keys')}>
                Create one <ArrowRight className="size-3" />
              </Button>
            </p>
          ) : null}

          {active === 'rest' ? (
            <div className="space-y-3">
              <div role="radiogroup" aria-label="Language" className="inline-flex gap-1 rounded-lg border bg-muted/40 p-0.5">
                {(['curl', 'node', 'python'] as const).map((lang) => (
                  <Button
                    key={lang}
                    type="button"
                    role="radio"
                    aria-checked={restLang === lang}
                    variant={restLang === lang ? 'secondary' : 'ghost'}
                    size="xs"
                    onClick={() => setRestLang(lang)}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'node' ? 'Node' : 'Python'}
                  </Button>
                ))}
              </div>
              <SnippetBlock
                title={`POST /agents/${agentId}/execute`}
                code={snippets[restLang]}
                language={restLang === 'curl' ? 'bash' : restLang === 'node' ? 'javascript' : 'python'}
              />
              <p className="text-xs text-muted-foreground">
                The response holds <code className="text-foreground">status</code>, <code className="text-foreground">output</code>,{' '}
                <code className="text-foreground">runId</code> and the tool calls made. A run that needs a person ends in{' '}
                <code className="text-foreground">WAITING_FOR_APPROVAL</code>.
              </p>
            </div>
          ) : active === 'webhooks' ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Each request is signed with HMAC-SHA256 using the webhook’s secret. Verify the signature before trusting the body.
              </p>
              <div>
                <div className="mb-2 text-xs font-semibold text-foreground">Verify a delivery</div>
                <CodeBlock code={WEBHOOK_VERIFY} language="javascript" showLineNumbers={false} />
              </div>
              <Button type="button" size="sm" className="gap-1.5 text-xs" onClick={() => onNavigate('webhooks')}>
                Manage webhooks <ArrowRight className="size-3.5" />
              </Button>
            </div>
          ) : snippetId ? (
            <SnippetBlock
              title={active === 'react' ? 'React component' : active === 'desktop' ? 'Renderer snippet' : active === 'headless' ? 'Worker snippet' : 'Embed code'}
              code={snippets[snippetId]}
              language={active === 'iframe' || active === 'widget' || active === 'inline' || active === 'web-component' ? 'html' : 'javascript'}
            />
          ) : null}

          {target.needs === 'public-key' ? <InstallCheck deployment={deployment} /> : null}

          {active === 'widget' ? (
            <ol className="list-inside list-decimal space-y-1 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
              <li>Copy the script tag.</li>
              <li>
                Paste it just before <code className="text-foreground">&lt;/body&gt;</code> on every page that should show the widget.
              </li>
              <li>The widget starts a session with your public key and applies the branding saved in Widget Studio.</li>
            </ol>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
