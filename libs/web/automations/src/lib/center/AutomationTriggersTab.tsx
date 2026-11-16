import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Input,
  SearchInput,
  CodeInput,
  toast,
  AppSelect,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Plus,
  Send,
  Webhook,
  Zap,
} from 'lucide-react';
import { triggerWebhook, useWorkflows } from '../use-automations.js';
import { WORKFLOW_EVENTS } from '../workflow-catalog.js';

export function AutomationTriggersTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const workflowsQuery = useWorkflows(workspaceId);

  const [activeTab, setActiveTab] = useState<
    'events' | 'schedules' | 'webhooks'
  >('events');
  const [search, setSearch] = useState('');

  // Webhook tester state
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [webhookPayload, setWebhookPayload] = useState<string>(
    JSON.stringify(
      { event: 'external.lead_created', customer: 'Acme Corp', amount: 1200 },
      null,
      2,
    ),
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const workflows = workflowsQuery.data ?? [];
  const webhookWorkflows = workflows.filter((w) => w.triggerType === 'WEBHOOK');

  const filteredEvents = WORKFLOW_EVENTS.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.label.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)
    );
  });

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://app.onetab.ai';
  const sampleWebhookUrl = selectedWorkflowId
    ? `${baseUrl}/api/automations/workflows/${selectedWorkflowId}/webhook`
    : `${baseUrl}/api/automations/workflows/<WORKFLOW_ID>/webhook`;

  const curlSnippet = `curl -X POST "${sampleWebhookUrl}" \\
  -H "Content-Type: application/json" ${webhookSecret ? `\\\n  -H "x-webhook-secret: ${webhookSecret}" ` : ''}\\
  -d '${webhookPayload.replace(/\n\s*/g, ' ')}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
    toast.success('Curl command copied to clipboard');
  };

  const handleTestWebhook = async () => {
    if (!selectedWorkflowId) {
      toast.error('Select a workflow with a webhook trigger first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(webhookPayload);
      } catch {
        toast.error('Invalid JSON payload');
        setTesting(false);
        return;
      }

      const res = await triggerWebhook(
        workspaceId ?? '',
        selectedWorkflowId,
        parsed,
        webhookSecret || undefined,
      );
      setTestResult(JSON.stringify(res, null, 2));
      toast.success('Webhook triggered successfully!', {
        description: `Run initiated: ${res.executionId}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Webhook request failed';
      setTestResult(JSON.stringify({ error: msg }, null, 2));
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
        <div className="gap-2 sm:w-auto flex w-full border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'events'
                ? 'font-semibold border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Platform Events ({WORKFLOW_EVENTS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedules')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'schedules'
                ? 'font-semibold border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Scheduled & Cron Triggers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'webhooks'
                ? 'font-semibold border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Inbound Webhooks & API
          </button>
        </div>

        {activeTab === 'events' && (
          <div className="sm:w-64 w-full">
            <SearchInput
              placeholder="Search triggers by name or event…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        )}
      </div>

      {/* Platform Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Workflows can listen to real domain events fired across the
            platform. Whenever an event is dispatched with matching criteria,
            connected automations trigger automatically.
          </p>

          <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
            {filteredEvents.map((evt) => (
              <Card
                key={evt.value}
                className="p-4 flex flex-col justify-between transition-colors hover:border-primary/40"
              >
                <div>
                  <div className="gap-2 mb-1.5 flex items-center justify-between">
                    <span className="font-semibold text-sm gap-1.5 flex items-center text-foreground">
                      <Zap className="h-4 w-4 text-warning-text" />
                      {evt.label}
                    </span>
                    <Badge variant="outline" className="font-mono text-2xs">
                      {evt.value}
                    </Badge>
                  </div>
                  <p className="text-xs mb-3 line-clamp-2 text-muted-foreground">
                    Fires in real-time when this domain action occurs within the
                    workspace.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border/40">
                  <span className="text-meta text-muted-foreground">
                    Payload: JSON object
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 gap-1"
                    onClick={() => {
                      navigate(
                        `/w/${slug}/automations/builder/new?trigger=${encodeURIComponent(evt.value)}`,
                      );
                    }}
                  >
                    Build Workflow
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Triggers Tab */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-base mb-1 gap-2 flex items-center">
              <CalendarClock className="h-5 w-5 text-primary" />
              Time-based & Cron Scheduling
            </h3>
            <p className="text-sm mb-4 text-muted-foreground">
              Our high-reliability scheduler sweeps every minute with timezone
              awareness, daylight-saving compensation, and missed-run guards.
            </p>

            <div className="md:grid-cols-3 gap-4 mb-4 grid grid-cols-1">
              <div className="p-3.5 rounded-lg border bg-muted/20">
                <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
                  Preset Intervals
                </span>
                <p className="text-xs text-muted-foreground">
                  Hourly, Daily at specific times, Weekly on selected days, or
                  Monthly on the 1st.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-muted/20">
                <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
                  Custom 5-field Cron
                </span>
                <p className="text-xs text-muted-foreground">
                  Full standard Unix cron syntax (
                  <code className="font-mono text-meta text-primary">
                    0 9 * * 1-5
                  </code>{' '}
                  for business days at 9 AM).
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-muted/20">
                <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
                  Timezone Protection
                </span>
                <p className="text-xs text-muted-foreground">
                  Target explicit timezones (e.g. America/New_York, UTC,
                  Asia/Kolkata) without server clock drift.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() =>
                  navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)
                }
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Scheduled Automation
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Inbound Webhooks & API Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-base mb-1 gap-2 flex items-center">
              <Webhook className="h-5 w-5 text-accent-indigo" />
              Inbound Webhooks
            </h3>
            <p className="text-sm mb-4 text-muted-foreground">
              Expose a dedicated HTTP POST endpoint to trigger workflows from
              external systems (GitHub, Stripe, Shopify, custom microservices,
              etc.).
            </p>

            {/* Workflow selector */}
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
                  Target Automation Workflow
                </label>
                {webhookWorkflows.length === 0 ? (
                  <div className="p-3 text-xs flex items-center justify-between rounded-lg border bg-muted/30 text-muted-foreground">
                    <span>
                      No workflows currently have a Webhook trigger configured.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        navigate(
                          `/w/${slug}/automations/builder/new?trigger=WEBHOOK`,
                        )
                      }
                    >
                      Create Webhook Automation
                    </Button>
                  </div>
                ) : (
                  <AppSelect
                    value={selectedWorkflowId}
                    onValueChange={setSelectedWorkflowId}
                    placeholder="Select a webhook workflow…"
                    aria-label="Webhook workflow"
                    options={webhookWorkflows.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.isActive ? 'Active' : 'Paused'})`,
                    }))}
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
                  Optional Webhook Secret (
                  <code className="font-mono text-meta text-primary">
                    x-webhook-secret
                  </code>
                  )
                </label>
                <Input
                  placeholder="Optional secret token for HMAC / bearer validation"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Curl Command
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs gap-1"
                    onClick={handleCopyCurl}
                  >
                    {copiedCurl ? (
                      <Check className="h-3 w-3 text-success-text" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedCurl ? 'Copied' : 'Copy Curl'}
                  </Button>
                </div>
                <div className="p-3 text-xs overflow-x-auto rounded-lg bg-muted/80 font-mono text-foreground">
                  {curlSnippet}
                </div>
              </div>

              {/* Interactive test payload */}
              <div>
                <label className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
                  Interactive Test JSON Payload
                </label>
                <CodeInput
                  language="json"
                  value={webhookPayload}
                  onChange={setWebhookPayload}
                  minRows={4}
                  maxRows={12}
                />
              </div>

              <div className="gap-3 flex items-center">
                <Button
                  onClick={handleTestWebhook}
                  disabled={testing || !selectedWorkflowId}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {testing ? 'Sending…' : 'Send Test Webhook'}
                </Button>
              </div>

              {testResult && (
                <div className="mt-4 p-3 rounded-lg border bg-muted/40">
                  <span className="text-xs font-semibold mb-1 block text-muted-foreground">
                    Response Output:
                  </span>
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                    {testResult}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
